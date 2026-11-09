"""Build a narrated slide video. python make_video.py spec.json out.mp4
spec: {"title":..., "slides":[{"kicker","head","points":[...],"imgs":[{"src","y":0-100,"w":"phone|wide"}],"say","decide"?}]}
Slides render via headless Chrome (playwright, node), narration via edge-tts, joined by ffmpeg."""
import json, sys, subprocess, asyncio, html, pathlib, shutil
import edge_tts
spec = json.load(open(sys.argv[1], encoding='utf-8')); out = pathlib.Path(sys.argv[2]).resolve()
work = out.with_suffix(''); shutil.rmtree(work, ignore_errors=True); work.mkdir(parents=True)
CSS = """*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;background:#f4efe4;color:#1d2a44;font-family:Verdana,'Segoe UI',sans-serif;display:flex;overflow:hidden}
.l{flex:0 0 720px;padding:80px 70px;display:flex;flex-direction:column}.k{font-size:30px;color:#b5532f;font-weight:bold;letter-spacing:.06em;text-transform:uppercase}
h1{font-size:68px;line-height:1.15;margin:24px 0 40px}ul{list-style:none;padding:0;margin:0}li{font-size:38px;line-height:1.35;margin:0 0 26px;padding-left:40px;position:relative}
li:before{content:'';position:absolute;left:0;top:18px;width:18px;height:18px;border-radius:50%;background:#1d4e89}
.dec{margin-top:auto;background:#1d2a44;color:#fff;border-radius:16px;padding:26px 32px;font-size:34px;line-height:1.3}.dec b{color:#f2c14e;display:block;font-size:26px;letter-spacing:.08em}
.num{position:absolute;right:40px;bottom:26px;font-size:24px;color:#8a8070}
.r{flex:1;display:flex;gap:30px;padding:50px 60px 50px 0;align-items:stretch;justify-content:center}
.im{border-radius:18px;border:3px solid #ddd3bf;background-repeat:no-repeat;background-size:100% auto;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.phone{width:470px}.wide{flex:1}.cap{position:absolute}"""
slides = spec['slides']
for i, s in enumerate(slides):
    imgs = ''.join(f'<div class="im {g.get("w","phone")}" style="background-image:url(\'{pathlib.Path(g["src"]).resolve().as_uri()}\');background-position:0 {g.get("y",0)}%"></div>' for g in s.get('imgs', []))
    pts = ''.join(f'<li>{html.escape(p)}</li>' for p in s.get('points', []))
    dec = f'<div class=dec><b>{html.escape(s.get("decide_label","YOU DECIDE"))}</b>{html.escape(s["decide"])}</div>' if s.get('decide') else ''
    body = f'<div class=l><div class=k>{html.escape(s.get("kicker",""))}</div><h1>{html.escape(s["head"])}</h1><ul>{pts}</ul>{dec}</div>'
    if imgs: body += f'<div class=r>{imgs}</div>'
    else: body = body.replace('class=l', 'class=l style="flex:1;padding:100px 160px"')
    (work / f's{i:02}.html').write_text(f'<!doctype html><meta charset=utf-8><style>{CSS}</style><body>{body}<div class=num>{i+1} / {len(slides)}</div></body>', encoding='utf-8')
node = r"""const {createRequire}=require('module');const r=createRequire(require('child_process').execSync('npm root -g').toString().trim()+'/x');
const {chromium}=r('playwright');(async()=>{const b=await chromium.launch({channel:'chrome'});const p=await b.newPage({viewport:{width:1920,height:1080}});
for(const f of process.argv.slice(2)){await p.goto('file:///'+f.replace(/\\/g,'/'));await p.waitForTimeout(300);await p.screenshot({path:f.replace('.html','.png')});}await b.close()})()"""
(work / 'r.cjs').write_text(node, encoding='utf-8')
subprocess.run(['node', str(work / 'r.cjs')] + [str(work / f's{i:02}.html') for i in range(len(slides))], check=True)
async def tts():
    for i, s in enumerate(slides):
        await edge_tts.Communicate(s['say'], spec.get('voice', 'en-US-AndrewNeural'), rate='-4%').save(str(work / f's{i:02}.mp3'))
asyncio.run(tts())
parts = []
for i in range(len(slides)):
    seg = work / f'seg{i:02}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', str(work / f's{i:02}.png'), '-i', str(work / f's{i:02}.mp3'),
                    '-af', 'apad=pad_dur=0.8', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '10', '-c:a', 'aac', '-shortest', str(seg)], check=True)
    parts.append(seg)
(work / 'list.txt').write_text(''.join(f"file '{p.as_posix()}'\n" for p in parts), encoding='utf-8')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(work / 'list.txt'), '-c', 'copy', str(out)], check=True)
# chapter list with start times, so a pause point is easy to find again
t = 0.0; ch = []
for i, p in enumerate(parts):
    ch.append(f'{int(t//60)}:{int(t%60):02}  {i+1}. {slides[i]["head"]}')
    t += float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)], capture_output=True, text=True).stdout)
out.with_suffix('.chapters.txt').write_text('\n'.join(ch), encoding='utf-8')
print(out, f'{t/60:.1f} min'); print('\n'.join(ch))
