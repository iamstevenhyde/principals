import React from 'react';
import {Composition, AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import durs from './durs.json';
import {Txt, Rect, Dot, Arrow, R, lerp} from './lib';
const PAD = 24;
const FR = (durs as number[]).map((d) => Math.ceil(d * 30) + PAD);
const TOTAL = FR.reduce((a, b) => a + b, 0);
const P = {bg: '#101a2b', ink: '#f2f4f8', a: '#f2b84b', b: '#3fc1b0', c: '#e2605a', dim: '#6b7a93', panel: '#1b2a44'};
const S1 = (p: number) => (<>
  <Txt x={960} y={110} s="PRINCIPALS" size={90} color={P.a} bold w={1200} o={R(p, 0, 0.1)} />
  <Rect x={760} y={590} w={560} h={600} fill={P.panel} stroke={P.a} r={24} o={R(p, 0.1, 0.2)} />
  <Txt x={760} y={340} s="Your card" size={44} color={P.ink} bold o={R(p, 0.15, 0.25)} />
  {[['Answers to', P.b, 0.3], ['Could lose', P.c, 0.5], ['Secret goal', P.a, 0.7]].map(([t, c, s], i) => (
    <Rect key={i} x={760} y={470 + i * 140} w={440} h={100} fill={c as string} r={16} o={R(p, s as number, (s as number) + 0.1)}><span style={{fontSize: 44, fontWeight: 700, color: '#101a2b'}}>{t}</span></Rect>
  ))}
  <Arrow x1={1120} y1={470} x2={1260} y2={470} p={R(p, 0.3, 0.4)} color={P.b} />
  <Dot x={1380} y={470} r={50} fill={P.b} o={R(p, 0.3, 0.4)} /><Txt x={1380} y={555} s="a group" size={34} color={P.ink} o={R(p, 0.3, 0.4)} />
  <Arrow x1={1120} y1={610} x2={1260} y2={610} p={R(p, 0.5, 0.6)} color={P.c} />
  <Txt x={1420} y={610} s="a penalty" size={34} color={P.c} o={R(p, 0.5, 0.6)} />
  <Arrow x1={1120} y1={750} x2={1260} y2={750} p={R(p, 0.7, 0.8)} color={P.a} />
  <Rect x={1380} y={750} w={110} h={110} fill="#000" r={16} o={R(p, 0.7, 0.8)}><span style={{fontSize: 70, color: P.a}}>?</span></Rect>
  <Txt x={1600} y={750} s="only you know" size={32} color={P.ink} w={300} o={R(p, 0.72, 0.82)} />
</>);
const S2 = (p: number) => {
  const pos = [[560, 520], [760, 420], [960, 380], [1160, 420], [1360, 520]];
  const votes = [P.b, P.b, P.c, P.b, P.c];
  return (<>
    <Txt x={960} y={110} s="The Chair calls the vote" size={60} color={P.a} bold w={1400} />
    <Rect x={960} y={620} w={900} h={120} fill={P.panel} r={60} />
    {pos.map(([x, y], i) => (<React.Fragment key={i}>
      <Dot x={x} y={y + 100} r={i === 2 ? 56 : 44} fill={i === 2 ? P.a : P.dim} stroke={i === 2 ? '#fff' : undefined} />
      <Rect x={x} y={y + 260} w={70} h={110} fill={R(p, 0.35 + i * 0.07, 0.4 + i * 0.07) > 0.5 ? votes[i] : '#2c3d5c'} r={10} stroke={P.ink} sw={3} />
    </React.Fragment>))}
    <Txt x={960} y={250} s="Chair" size={36} color={P.a} bold w={300} o={R(p, 0.05, 0.15)} />
    <Arrow x1={960} y1={290} x2={960} y2={350} p={R(p, 0.1, 0.25)} color={P.a} />
    <Txt x={960} y={930} s="Everyone votes on their own device" size={44} color={P.ink} w={1400} o={R(p, 0.3, 0.45)} />
    <Txt x={960} y={1000} s="then the board sees every vote" size={36} color={P.dim} w={1400} o={R(p, 0.8, 0.9)} />
  </>);
};
const S3 = (p: number) => {
  const used = R(p, 0.3, 0.9) * 0.82;
  return (<>
    <Txt x={960} y={110} s="Spend the budget on motions" size={60} color={P.a} bold w={1400} />
    <Rect x={960} y={330} w={1100} h={80} fill="#2c3d5c" r={14} />
    <div style={{position: 'absolute', left: 410, top: 290, width: 1100 * (1 - used), height: 80, background: P.b, borderRadius: 14}} />
    <Txt x={410} y={250} s="Budget" size={36} color={P.ink} align="left" w={300} />
    {[0, 1, 2].map((i) => (<React.Fragment key={i}>
      <Rect x={560 + i * 400} y={700} w={320} h={260} fill={P.panel} stroke={P.a} r={18} o={R(p, 0.05 + i * 0.08, 0.15 + i * 0.08)}>
        <span style={{fontSize: 40, color: P.ink, fontWeight: 600}}>Motion</span></Rect>
      <Arrow x1={560 + i * 400} y1={560} x2={lerp(560 + i * 400, 960, 0.5)} y2={390} p={R(p, 0.3 + i * 0.2, 0.45 + i * 0.2)} color={P.c} sw={6} />
    </React.Fragment>))}
    <Txt x={960} y={930} s="Each motion costs money" size={44} color={P.ink} w={1400} o={R(p, 0.5, 0.65)} />
  </>);
};
const S4 = (p: number) => {
  const facts = [['Fact one', true], ['Fact two', true], ['Fact three', false], ['Fact four', true]] as [string, boolean][];
  return (<>
    <Txt x={960} y={110} s="Every round, the company has a problem" size={60} color={P.a} bold w={1600} />
    <Rect x={420} y={330} w={420} h={140} fill={P.c} r={22} o={R(p, 0.05, 0.2)}><span style={{fontSize: 52, fontWeight: 800, color: '#101a2b'}}>PROBLEM</span></Rect>
    {facts.map(([t, ok], i) => { const vote = R(p, 0.3 + i * 0.07, 0.38 + i * 0.07);
      return (<React.Fragment key={i}>
        <Arrow x1={560} y1={400} x2={900} y2={480 + i * 120} p={R(p, 0.2 + i * 0.05, 0.3 + i * 0.05)} color={P.dim} sw={4} />
        <Rect x={1180} y={480 + i * 120} w={520} h={90} fill={P.panel} stroke={ok || vote < 0.5 ? P.b : P.c} sw={4} r={16} o={R(p, 0.2 + i * 0.05, 0.3 + i * 0.05)}>
          <span style={{fontSize: 40, color: ok || vote < 0.5 ? P.ink : P.dim, textDecoration: !ok && vote > 0.5 ? 'line-through' : 'none'}}>{t}</span></Rect>
        <Txt x={870} y={480 + i * 120} s={vote > 0.5 ? (ok ? '✓' : '✗') : ''} size={56} color={ok ? P.b : P.c} w={80} bold />
      </React.Fragment>); })}
    <Txt x={420} y={620} s="The board votes on each fact" size={36} color={P.ink} w={560} o={R(p, 0.35, 0.5)} />
    <Rect x={420} y={820} w={560} h={150} fill="#000" stroke={P.a} r={14} o={R(p, 0.6, 0.75)}><span style={{fontSize: 38, color: P.a}}>One shared statement</span></Rect>
    <Txt x={1180} y={1000} s="A fact left out can be found" size={44} color={P.c} w={900} o={R(p, 0.8, 0.95)} />
  </>);
};
const S5 = (p: number) => {
  const mv = R(p, 0.55, 0.85);
  return (<>
    <Txt x={960} y={110} s="The Street is watching" size={60} color={P.a} bold w={1400} />
    <Rect x={500} y={560} w={560} h={420} fill={P.panel} stroke={P.ink} r={20} o={R(p, 0.05, 0.15)} />
    <Txt x={500} y={400} s="Board meeting" size={36} color={P.ink} w={500} />
    {[0, 1, 2].map((i) => <Dot key={i} x={380 + i * 120} y={580} r={40} fill={P.dim} o={R(p, 0.1, 0.2)} />)}
    <Rect x={1400} y={380} w={500} h={260} fill="#000" stroke={P.a} r={14} o={R(p, 0.15, 0.3)}><span style={{fontSize: 44, color: P.a}}>Projector</span></Rect>
    {[0, 1, 2].map((i) => <Dot key={i} x={1250 + i * 140} y={800} r={40} fill={P.b} o={R(p, 0.2, 0.35)} />)}
    <Txt x={1390} y={890} s="The Street" size={38} color={P.b} w={500} o={R(p, 0.2, 0.35)} />
    <Arrow x1={1390} y1={740} x2={1390} y2={670} p={R(p, 0.3, 0.5)} color={P.b} sw={6} />
    <Dot x={lerp(1250, 620, mv)} y={lerp(800, 580, mv)} r={44} fill={P.b} stroke="#fff" o={R(p, 0.5, 0.6)} />
  </>);
};
const S6 = (p: number) => {
  const pts = [0.2, 0.3, 0.25, 0.45, 0.4, 0.6, 0.55, 0.75];
  const n = R(p, 0.1, 0.55);
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${590 + i * 105},${600 - v * 340}`).join(' ');
  const rev = R(p, 0.65, 0.8);
  return (<>
    <Txt x={960} y={110} s="The projector shows only the stock" size={60} color={P.a} bold w={1600} />
    <Rect x={960} y={430} w={1000} h={440} fill="#000" stroke={P.ink} r={14} />
    <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}><path d={d} stroke={P.b} strokeWidth={10} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - n} /></svg>
    {['Workers', 'Customers', 'Town', 'Public'].map((t, i) => (
      <Rect key={i} x={560 + i * 270} y={800} w={230} h={120} fill={rev > 0.5 ? P.panel : '#2c3d5c'} stroke={P.dim} r={14}>
        <span style={{fontSize: rev > 0.5 ? 34 : 60, color: rev > 0.5 ? P.ink : P.dim}}>{rev > 0.5 ? t : '?'}</span></Rect>
    ))}
    <Txt x={960} y={940} s="Everything else is revealed at the end" size={40} color={P.ink} w={1400} o={R(p, 0.6, 0.8)} />
  </>);
};
const S7 = (p: number) => (<>
  <Txt x={960} y={150} s="No single winner" size={80} color={P.a} bold w={1400} />
  {[0, 1, 2, 3, 4].map((i) => {
    const h = [260, 180, 320, 220, 280][i] * R(p, 0.1 + i * 0.08, 0.5);
    return <Rect key={i} x={560 + i * 200} y={760 - h / 2} w={140} h={h} fill={[P.b, P.a, P.c, P.dim, P.ink][i]} r={10} />;
  })}
  <Txt x={960} y={900} s="Check your card, then play" size={52} color={P.ink} w={1400} o={R(p, 0.55, 0.75)} />
</>);
const SC = [S1, S2, S3, S4, S5, S6, S7];
const Inner: React.FC<{i: number; n: number}> = ({i, n}) => {
  const f = useCurrentFrame(); const p = Math.min(1, f / (n - PAD));
  return <AbsoluteFill style={{background: P.bg, opacity: Math.min(1, f / 8)}}>{SC[i](p)}</AbsoluteFill>;
};
const V: React.FC = () => {
  let s = 0;
  return <AbsoluteFill style={{background: P.bg}}>{FR.map((n, i) => { const st = s; s += n;
    return <Sequence key={i} from={st} durationInFrames={n}><Inner i={i} n={n} /><Audio src={staticFile(`audio/r_${i + 1}.mp3`)} /></Sequence>; })}</AbsoluteFill>;
};
export const Root: React.FC = () => <Composition id="Rules" component={V} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />;
