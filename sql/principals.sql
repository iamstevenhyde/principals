-- Principals: Supabase schema for project ziszzyvlevgsjiazgogr. Touches only dc_* objects. Safe to re-run.
-- NOT run yet. Steven pastes this into the SQL editor himself.
--
-- Why The System's pattern and not Parent Trap's: Parent Trap used open anon policies (a join code was the only
-- gate), which was fine when nothing on a team screen was secret. Principals deals every director a secret
-- objective and an exposure, runs private one-to-one messages, and (in the earlier design) a Street whose whole job was to find what
-- boards hide. With open anon policies any student could read every secret and every DM from the browser
-- console. So, as in The System:
--  * RLS on every table. Only dc_public (tickers, feed, the outside view) is readable by anon.
--  * All writes and private reads go through SECURITY DEFINER functions that check a host token or a seat token.
--    Tokens are stored as sha256 hashes.
--  * The host page holds the authoritative game state and publishes one private view per seat; a seat token can
--    read only its own view.
-- Known limit: the content bundle (all secret texts, not who holds which) ships with the static site.

create extension if not exists pgcrypto with schema extensions;

create table if not exists dc_sessions (
  code text primary key,
  host_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists dc_state (
  code text primary key references dc_sessions(code) on delete cascade,
  state jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists dc_seats (
  code text not null references dc_sessions(code) on delete cascade,
  seat_id text not null,
  name text not null,
  token_hash text not null,
  view jsonb,
  updated_at timestamptz not null default now(),
  primary key (code, seat_id)
);
create table if not exists dc_inbox (
  id bigserial primary key,
  code text not null references dc_sessions(code) on delete cascade,
  seat_id text not null,
  action jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists dc_inbox_code_id on dc_inbox (code, id);
create table if not exists dc_public (
  code text primary key references dc_sessions(code) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  version int not null default 0
);

alter table dc_sessions enable row level security;
alter table dc_state enable row level security;
alter table dc_seats enable row level security;
alter table dc_inbox enable row level security;
alter table dc_public enable row level security;
drop policy if exists dc_public_read on dc_public;
create policy dc_public_read on dc_public for select to anon, authenticated using (true);
-- no other policies: anon cannot read or write the other tables directly.

do $$ begin
  alter publication supabase_realtime add table dc_public;
exception when duplicate_object then null; end $$;

create or replace function dc_hash(t text) returns text language sql immutable as
$$ select encode(extensions.digest(t, 'sha256'), 'hex') $$;

create or replace function dc_check_host(p_code text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from dc_sessions where code = p_code and host_hash = dc_hash(p_token)) then
    raise exception 'not authorized';
  end if;
end $$;

-- Host creates a game. Returns the join code and a host token (kept in the admin browser).
create or replace function dc_create_session(p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; tok text;
begin
  loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1IL', 'XYZ'), 1, 5));
    exit when length(c) = 5 and not exists (select 1 from dc_sessions where code = c);
  end loop;
  tok := encode(extensions.gen_random_bytes(18), 'hex') || coalesce(p_pin, '');
  insert into dc_sessions(code, host_hash) values (c, dc_hash(tok));
  insert into dc_state(code, state) values (c, null);
  insert into dc_public(code, payload) values (c, jsonb_build_object('code', c, 'phase', 'lobby', 'round', 0, 'boards', '[]'::jsonb, 'feed', '[]'::jsonb, 'players', '[]'::jsonb));
  return jsonb_build_object('code', c, 'hostToken', tok);
end $$;

-- Join, or rejoin with a stored seat token. Joining stays open after the start (late arrivals wait unseated).
create or replace function dc_join(p_code text, p_name text, p_token text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s dc_seats; tok text; sid text; n text := trim(coalesce(p_name, ''));
begin
  if not exists (select 1 from dc_sessions where code = upper(p_code)) then raise exception 'no such game'; end if;
  if p_token is not null then
    select * into s from dc_seats where code = upper(p_code) and token_hash = dc_hash(p_token);
    if s.seat_id is not null then return jsonb_build_object('seatId', s.seat_id, 'token', p_token); end if;
  end if;
  if length(n) < 1 or length(n) > 40 then raise exception 'bad name'; end if;
  if (select count(*) from dc_seats where code = upper(p_code)) >= 60 then raise exception 'game is full'; end if;
  tok := encode(extensions.gen_random_bytes(18), 'hex');
  sid := 's' || encode(extensions.gen_random_bytes(5), 'hex');
  insert into dc_seats(code, seat_id, name, token_hash) values (upper(p_code), sid, n, dc_hash(tok));
  insert into dc_inbox(code, seat_id, action) values (upper(p_code), sid, jsonb_build_object('type', 'join', 'name', n));
  return jsonb_build_object('seatId', sid, 'token', tok);
end $$;

-- A seat sends one action (ballot, lock, chat). The host applies it.
create or replace function dc_submit(p_code text, p_token text, p_action jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s dc_seats;
begin
  select * into s from dc_seats where code = p_code and token_hash = dc_hash(p_token);
  if s.seat_id is null then raise exception 'not authorized'; end if;
  if pg_column_size(p_action) > 2000 then raise exception 'action too large'; end if;
  if (select count(*) from dc_inbox where code = p_code and seat_id = s.seat_id and created_at > now() - interval '10 seconds') > 40 then
    raise exception 'slow down';
  end if;
  insert into dc_inbox(code, seat_id, action) values (p_code, s.seat_id, p_action - 'by');
  return jsonb_build_object('ok', true);
end $$;

-- A seat reads its own private view plus the public payload.
create or replace function dc_seat_view(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s dc_seats;
begin
  select * into s from dc_seats where code = p_code and token_hash = dc_hash(p_token);
  if s.seat_id is null then raise exception 'not authorized'; end if;
  return jsonb_build_object('view', s.view, 'public', (select payload from dc_public where code = p_code));
end $$;

create or replace function dc_host_get(p_code text, p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform dc_check_host(p_code, p_token);
  return (select state from dc_state where code = p_code);
end $$;

create or replace function dc_host_inbox(p_code text, p_token text, p_after bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform dc_check_host(p_code, p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'seat_id', seat_id, 'action', action) order by id)
    from (select * from dc_inbox where code = p_code and id > p_after order by id limit 500) x), '[]'::jsonb);
end $$;

-- Host publishes: full state (private), the public payload, and changed seat views {seatId: view}.
create or replace function dc_host_publish(p_code text, p_token text, p_state jsonb, p_public jsonb, p_views jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb;
begin
  perform dc_check_host(p_code, p_token);
  if p_state is not null then update dc_state set state = p_state, updated_at = now() where code = p_code; end if;
  if p_public is not null then update dc_public set payload = p_public, version = version + 1 where code = p_code; end if;
  for k, v in select * from jsonb_each(coalesce(p_views, '{}'::jsonb)) loop
    update dc_seats set view = v, updated_at = now() where code = p_code and seat_id = k;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function dc_check_host(text, text) from public, anon, authenticated;
grant execute on function dc_create_session(text), dc_join(text, text, text), dc_submit(text, text, jsonb),
  dc_seat_view(text, text), dc_host_get(text, text), dc_host_inbox(text, text, bigint),
  dc_host_publish(text, text, jsonb, jsonb, jsonb) to anon, authenticated;
