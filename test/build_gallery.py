import json, sys, html
from collections import OrderedDict
d = sys.argv[1]
m = json.load(open(d + '/manifest.json', encoding='utf-8'))
steps = OrderedDict()
for s in m: steps.setdefault(s['step'], []).append(s)
CSS = """:root{--bg:#f4efe4;--ink:#1d2a44;--muted:#6b6457;--card:#fffdf8;--line:#ddd3bf;--team:#1d4e89;--out:#b5532f;--proj:#5e7d5a;--admin:#8a6d1c}
@media (prefers-color-scheme:dark){:root{--bg:#161b26;--ink:#ece6d8;--muted:#a49c8c;--card:#20283a;--line:#33405a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.5 Verdana,'Segoe UI',sans-serif;letter-spacing:.01em}
header{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:2px solid var(--line);padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:22px;margin:0}.key{display:flex;gap:10px;flex-wrap:wrap}.chip{padding:3px 12px;border-radius:99px;color:#fff;font-size:14px;font-weight:bold}
.team{background:var(--team)}.outside{background:var(--out)}.projector{background:var(--proj)}.admin{background:var(--admin)}
img{display:block;width:100%;border-radius:6px;border:1px solid var(--line);background:#fff;cursor:zoom-in}
#zoom{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;overflow:auto;z-index:9;padding:20px;cursor:zoom-out}#zoom img{max-width:1100px;margin:auto;cursor:zoom-out}"""
ZOOM = """<div id=zoom onclick="this.style.display='none'"><img id=zi alt=""></div><script>document.querySelectorAll('main img').forEach(i=>i.onclick=()=>{zi.src=i.src;zoom.style.display='block';zoom.scrollTop=0});addEventListener('keydown',e=>{if(e.key==='Escape')zoom.style.display='none'})</script>"""
NAMES = {'team':'Team phone','outside':'Outside player','projector':'Projector','admin':'Host'}
key = '<div class=key>' + ''.join(f'<span class="chip {k}">{v}</span>' for k,v in NAMES.items()) + '</div>'
# Page A: every screen, one sheet, grouped by moment of the game
a = [f'<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Principals All Screens</title><style>{CSS}',
 'section{padding:18px 20px;border-bottom:1px solid var(--line)}h2{font-size:20px;margin:0 0 12px}.row{display:flex;gap:14px;align-items:flex-start;overflow-x:auto;padding-bottom:6px}',
 'figure{margin:0;flex:0 0 220px}figure.projector,figure.admin{flex-basis:420px}figcaption{font-size:14px;margin-top:6px;color:var(--muted)}figcaption b{color:var(--ink)}',
 '</style></head><body><header><h1>Principals: every screen</h1>', key, '<span style="color:var(--muted);font-size:14px">Click any screen to see it full size.</span></header><main>']
for st, xs in steps.items():
    a.append(f'<section><h2>{html.escape(st)}</h2><div class=row>')
    for x in xs: a.append(f'<figure class={x["view"]}><img loading=lazy src="{x["file"]}" alt="{html.escape(x["label"])}"><figcaption><span class="chip {x["view"]}">{NAMES[x["view"]]}</span> <b>{html.escape(x["label"])}</b></figcaption></figure>')
    a.append('</div></section>')
a.append('</main>' + ZOOM + '</body></html>')
open(d + '/all_screens.html','w',encoding='utf-8').write('\n'.join(a))
# Page B: one moment at a time, three views side by side
B = []
for st, xs in steps.items():
    cols = {v:[x for x in xs if x['view']==v] for v in ('team','outside','projector')}
    if not any(cols.values()): continue
    B.append({'step':st,'cols':{v:[[x['file'],x['label']] for x in c] for v,c in cols.items()}})
b = f"""<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Principals Three Views</title><style>{CSS}
nav{{display:flex;gap:8px;align-items:center;margin-left:auto}}button{{font:inherit;font-size:16px;padding:8px 16px;border-radius:8px;border:2px solid var(--ink);background:var(--card);color:var(--ink);cursor:pointer}}
#step{{font-size:22px;font-weight:bold;min-width:220px;text-align:center}}.dots{{display:flex;gap:4px;flex-wrap:wrap;padding:8px 20px}}.dots span{{width:14px;height:14px;border-radius:50%;background:var(--line);cursor:pointer}}.dots span.on{{background:var(--ink)}}
main{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,2.2fr);gap:18px;padding:12px 20px}}
@media (max-width:900px){{main{{grid-template-columns:1fr}}}}
.col h2{{margin:0 0 8px;font-size:18px}}.col .shot{{margin-bottom:14px}}.col .cap{{font-size:14px;color:var(--muted);margin-bottom:4px}}.empty{{color:var(--muted);font-style:italic;padding:20px 0}}
</style></head><body><header><h1>Principals: three views</h1><nav><button id=pv>&larr; Back</button><span id=step></span><button id=nx>Next &rarr;</button></nav></header>
<div class=dots id=dots></div><main id=m></main>{ZOOM.replace("document.querySelectorAll('main img').forEach(i=>i.onclick=","window.hook=()=>document.querySelectorAll('main img').forEach(i=>i.onclick=")}
<script>const B={json.dumps(B)};const N={{team:'Team phone',outside:'Outside player',projector:'Projector'}};let k=0;
function draw(){{const s=B[k];step.textContent=s.step;m.innerHTML=Object.keys(N).map(v=>'<div class=col><h2><span class="chip '+v+'">'+N[v]+'</span></h2>'+(s.cols[v].length?s.cols[v].map(([f,l])=>'<div class=shot><div class=cap>'+l+'</div><img src="'+f+'" alt="'+l+'"></div>').join(''):'<div class=empty>Nothing new on this screen.</div>')+'</div>').join('');
dots.innerHTML=B.map((b,i)=>'<span title="'+b.step+'" class="'+(i==k?'on':'')+'" onclick="k='+i+';draw()"></span>').join('');pv.disabled=k==0;nx.disabled=k==B.length-1;hook();scrollTo(0,0)}}
pv.onclick=()=>{{if(k>0){{k--;draw()}}}};nx.onclick=()=>{{if(k<B.length-1){{k++;draw()}}}};addEventListener('keydown',e=>{{if(e.key=='ArrowRight')nx.onclick();if(e.key=='ArrowLeft')pv.onclick()}});draw()</script></body></html>"""
open(d + '/three_views.html','w',encoding='utf-8').write(b)
print(len(steps), 'steps;', len(B), 'in three-view')
