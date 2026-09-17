"""Write a self-contained browser review page from the generated atlases."""
from pathlib import Path
import base64, json, sys
root=Path(__file__).resolve().parents[1]
out=root/'assets/mascot/stories'
manifest=json.loads((out/'manifest.json').read_text())
copy={
 'wallet-review':('בודק את הארנק','12 שניות · ליד בועת היתרה במסך הבית','בדיקה בזכוכית המגדלת, הצגת היתרה ומנוחה.'),
 'merchant-match':('מצאתי את הקופון','12 שניות · בכותרת גיליון החברה','חיפוש בין קופונים, זיהוי התאמה ומחוות הצגה.'),
 'priority-pick':('בזה כדאי להתחיל','10 שניות · בראש מסך ״מה בסכנה״','בחינת התאריך ובחירת הקופון שכדאי לנצל קודם.'),
 'clean-month':('חודש נקי, עד כה','14 שניות · בראש הסיכום החודשי','בדיקת ספר החשבונות וסיום רגוע עם תחושת סיפוק.')}
for key,m in manifest.items():
 m['data']=('data:image/webp;base64,'+base64.b64encode((out/m['atlas']).read_bytes()).decode()) if '--standalone' in sys.argv else m['atlas']
 m['copy']=copy[key]
html='''<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>קופוני — ארבעה סיפורים חדשים</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f2f5fb;color:#17243d;font:16px system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:36px 20px 60px}.eyebrow{color:#346bd4;font-size:13px;font-weight:750}h1{font-size:clamp(28px,5vw,44px);margin:8px 0 12px;letter-spacing:-1px}.intro{max-width:680px;line-height:1.7;color:#57677d}.toolbar{position:sticky;top:10px;z-index:2;padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid #dbe3ee;border-radius:18px;box-shadow:0 8px 24px #182d4510;margin:26px 0}button{font:inherit;background:#2668e8;color:white;border:0;border-radius:10px;padding:10px 16px;cursor:pointer}button.secondary{background:#edf2fa;color:#223657}button:disabled{opacity:.5;cursor:wait}input{flex:1;min-width:110px;accent-color:#2869e5;direction:ltr}output{font:13px monospace;direction:ltr;min-width:70px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}article{background:#fff;border:1px solid #dbe3ee;border-radius:24px;padding:24px;overflow:hidden}.stage{border-radius:16px;background:#f0f4fa;display:flex;align-items:center;justify-content:center;aspect-ratio:1.35}.stage canvas{max-width:100%;width:280px;height:auto}h2{font-size:21px;margin:18px 0 6px}.place{font-size:13px;color:#3268c4;font-weight:650}p{line-height:1.65}.meta{font-size:13px;color:#69788d}.tag{display:inline-block;border:1px solid #dbe3ee;padding:4px 9px;border-radius:20px;color:#536981;font-size:12px;margin-top:12px}body.dark{background:#0c1423;color:#eef4ff}body.dark article,body.dark .toolbar{background:#172237;border-color:#2b3952}body.dark .stage{background:#0e192b}body.dark .intro,body.dark .meta{color:#a8b6cb}body.dark .place{color:#93b8ff}.foot{margin-top:25px;color:#63728a;font-size:13px;line-height:1.8}@media(max-width:640px){main{padding:24px 14px}.grid{grid-template-columns:1fr}article{padding:18px}.toolbar{top:5px;padding:10px}button{font-size:14px;padding:9px 12px}}
</style><main><div class="eyebrow">קופוני / סיפורים חדשים</div><h1>יותר זמן לספר משהו.</h1><p class="intro">ארבע אנימציות חדשות באורך 10–14 שניות. כל סיפור מתקדם מבדיקה למחווה ולמנוחה. אפשר לעצור, לגרור בזמן ולהחליף רקע כדי לבדוק את השקיפות.</p>
<div class="toolbar"><button id="play" disabled>טוען…</button><button id="replay" class="secondary" disabled>מההתחלה</button><button id="theme" class="secondary">רקע כהה</button><input id="seek" aria-label="מיקום בזמן" type="range" min="0" max="14" step="0.05" value="0"><output id="clock">0.0 / 14s</output></div><div class="grid" id="grid"></div><p class="foot">מותאם לבראנץ claude/kuponi-integration · קומיט 2763ba6. הפוזות חדשות; פריימי הביניים נוצרו באינטרפולציית תנועה. זו תצוגת נכסים לשילוב, לא צילום של האפליקציה. ללא קול. מנוחה בסיום ותמיכה בהעדפת תנועה מופחתת.</p></main>
<script>
const stories=__DATA__;
const grid=document.querySelector('#grid'),play=document.querySelector('#play'),replay=document.querySelector('#replay'),seek=document.querySelector('#seek'),clock=document.querySelector('#clock');
let time=0,running=false,last=null,ready=false,raf=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scenes=Object.entries(stories).map(([name,m])=>{
 const article=document.createElement('article');
 article.innerHTML='<div class="stage"><canvas width="320" height="320" role="img" aria-label="'+m.copy[0]+'"></canvas></div><h2>'+m.copy[0]+'</h2><div class="place">'+m.copy[1]+'</div><p>'+m.copy[2]+'</p><span class="tag">'+m.frameCount+' פריימים · 20fps · שקוף</span>';
 grid.append(article);
 const image=new Image(), canvas=article.querySelector('canvas');
 const done=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject});image.src=m.data;
 return {m,image,canvas,done};
});
function draw(){
 if(!ready)return;
 for(const {m,image,canvas} of scenes){
  const n=Math.min(m.frameCount-1,Math.floor(time*m.fps));
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,320,320);
  ctx.drawImage(image,(n%m.columns)*m.cellSize,Math.floor(n/m.columns)*m.cellSize,m.cellSize,m.cellSize,0,0,320,320);
 }
 seek.value=time;clock.value=time.toFixed(1)+' / 14s';
}
function stop(){running=false;last=null;if(raf!==null)cancelAnimationFrame(raf);raf=null;play.textContent='ניגון';}
function tick(t){if(!running)return;if(last!==null)time=Math.min(14,time+(t-last)/1000);last=t;draw();if(time>=14){stop();return}raf=requestAnimationFrame(tick)}
function start(){if(!ready)return;if(time>=14)time=0;stop();running=true;play.textContent='עצירה';raf=requestAnimationFrame(tick)}
play.onclick=()=>running?stop():start();replay.onclick=()=>{time=0;draw();start()};seek.oninput=()=>{stop();time=Number(seek.value);draw()};
document.querySelector('#theme').onclick=event=>{const dark=document.body.classList.toggle('dark');event.target.textContent=dark?'רקע בהיר':'רקע כהה'};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
reduced.addEventListener('change',e=>{if(e.matches){stop();time=14;draw()}});
Promise.all(scenes.map(s=>s.done)).then(()=>{ready=true;play.disabled=false;replay.disabled=false;play.textContent='ניגון';time=reduced.matches?14:0;draw()}).catch(()=>{play.textContent='טעינת תמונה נכשלה'});
</script></html>'''.replace('__DATA__',json.dumps(manifest,ensure_ascii=False))
(out/'kuponi-preview.html').write_text(html)
print(out/'kuponi-preview.html')
