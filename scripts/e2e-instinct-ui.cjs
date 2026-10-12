// Isolated UI tests with mocked Auth/API; live backend checks are in e2e-instinct-api.mjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=process.env.INSTINCT_WEB_BUILD_DIR || '/tmp/coupon-instinct-web';
const server=http.createServer(async(req,res)=>{
 try { const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname); let file=path.join(root,name); if(!path.extname(name)) file=path.join(root,'index.html'); const data=await fs.readFile(file); const ext=path.extname(file); res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'})[ext]||'application/octet-stream'); res.end(data); }catch {res.statusCode=404;res.end('Not found');}
});
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 let created=false, revoked=false, creates=0;
 const user={id:'11111111-1111-4111-8111-111111111111',email:'qa@example.com',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{},factors:[{id:'factor',factor_type:'totp',status:'verified'}]};
 const profile={id:1,public_id:'qa-user',email:user.email,first_name:'בדיקת',last_name:'מנהל',is_admin:true,is_confirmed:true,is_deleted:false};
 const token=['e30',Buffer.from(JSON.stringify({sub:user.id,aal:'aal2',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake'].join('.');
 const session={access_token:token,refresh_token:'qa-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 await context.addInitScript(({session,profile})=>{ localStorage.setItem('sb-dugjsiyenazpsoiyduuz-auth-token',JSON.stringify(session));localStorage.setItem('coupon_master_legacy_session',JSON.stringify(profile)); },{session,profile});
 await context.route('https://dugjsiyenazpsoiyduuz.supabase.co/**',async route=>{
   const req=route.request(), u=new URL(req.url()); let body=[];
   if(u.pathname==='/auth/v1/user') body=user;
   else if(u.pathname.includes('/auth/v1/')) body={};
   else if(u.pathname==='/rest/v1/users') body=req.headers().accept?.includes('object') ? profile : [profile];
   else if(u.pathname.endsWith('/manage-instinct-keys')) {
     const data=req.postDataJSON();
     if(data.action==='create') { assert.equal(data.email,profile.email);assert.equal(data.consent,true);assert.equal(data.consent_version,'instinct-decrypted-v1');creates++;created=true; body={key:'cm_instinct_'+'a'.repeat(64),record:{id:'qa-key-id'}}; }
     else if(data.action==='revoke') {revoked=true;body={ok:true};}
     else body={keys:created?[{id:'qa-key-id',user_id:1,label:'Instinct QA',key_prefix:'cm_instinct_aaaaaaa',expires_at:'2027-01-01T00:00:00Z',last_used_at:null,revoked_at:revoked?'2026-10-12T00:00:00Z':null,users:{email:profile.email}}]:[]};
   } else if(u.pathname.includes('/instinct-api/schema')) body={tables:Array.from({length:8},(_,id)=>({id}))};
   else if(u.pathname.includes('/functions/')) body={data:[],ok:true};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
 await page.goto('http://127.0.0.1:4173/admin?tab=instinct');
 await page.getByText('חיבור ל-Instinct',{exact:true}).waitFor({timeout:30000});
 await page.getByText('יצירת מפתח API',{exact:true}).click({force:true});
 assert.equal(creates,0,'No creation without consent');
 assert.equal(await page.getByLabel('החשבון שלי',{exact:true}).getAttribute('readonly'),'');
 await page.screenshot({path:'/tmp/instinct-desktop.png',fullPage:true});
 await page.getByLabel('אישור שיתוף הנתונים שלי עם Instinct').check();
 await page.getByText('יצירת מפתח API',{exact:true}).click();
 await page.getByText('המפתח נוצר עבור qa@example.com').waitFor();
 assert.equal(creates,1);
 await page.getByText('בדיקת חיבור',{exact:true}).click();
 await page.getByText('החיבור תקין. 8 טבלאות זמינות למשתמש שנבחר.').waitFor();
 const downloadPromise=page.waitForEvent('download');
 await page.getByText('הורדת מדריך ל-Instinct',{exact:true}).click();
 const download=await downloadPromise;
 const guide=await fs.readFile(await download.path(),'utf8');
 assert.ok(guide.includes('/schema?apikey=<KEY>'));
 assert.ok(!guide.includes('cm_instinct_'));
 await page.setViewportSize({width:390,height:844});
 await page.getByText('המפתח נוצר עבור qa@example.com').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/instinct-mobile-key.png',fullPage:true});
 await page.getByText('המפתח נשמר - סגירה',{exact:true}).click();
 assert.equal(await page.getByText('cm_instinct_'+'a'.repeat(64),{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/instinct-mobile.png',fullPage:true});
 const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(bounds.scroll<=bounds.width,'No mobile horizontal overflow');
 await page.getByText('ביטול גישה',{exact:true}).click();
 await page.getByText('ביטול המפתח לצמיתות',{exact:true}).click();
 await page.getByText(/בוטל \| תוקף/).waitFor();
 assert.equal(revoked,true);
 assert.deepEqual(errors,[],'No browser runtime errors');
 console.log('PASS: desktop/mobile UI, explicit consent, self-only account, key creation, connection test, guide download without secret, hide key, revoke, no horizontal overflow. Auth and API responses mocked; live API tested separately.');
 } catch(e) { await page.screenshot({path:'/tmp/instinct-ui-failure.png',fullPage:true}); console.log((await page.locator('body').innerText()).slice(0,2000));throw e; }
 finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
