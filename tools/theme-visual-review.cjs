// Offline visual review of the real web assets. No vehicle commands are sent.
// Set THEME_REFERENCE to the preview HTML and optionally PLAYWRIGHT_MODULE.
// Run from the repository root: node tools/theme-visual-review.cjs
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve('app/src/main/assets/web'), out=path.resolve('build/theme-review');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/api/')) {res.writeHead(200,{'Content-Type':'application/json'});return res.end('{}');}
 let p=u.pathname==='/reference.html'?process.env.THEME_REFERENCE:path.join(root,u.pathname.replace(/^\//,''));
 if(u.pathname==='/')p=path.join(root,'local/index.html');
 if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res);
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 const report=[];
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await context.addInitScript(t=>{localStorage.setItem('overdrive_theme',t);localStorage.setItem('yourdrive-theme',t);localStorage.setItem('byd_jwt','offline-visual-review');},theme);
  await context.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')?route.continue():route.abort());
  for(const name of ['reference','index','recording','trips','charging','notifications','performance','vehicle-control']){
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+(name==='reference'?'/reference.html':'/local/'+name+'.html'),{waitUntil:'load'});
   await page.waitForTimeout(400);
   await page.screenshot({path:path.join(out,name+'-'+theme+'.png'),fullPage:true,animations:'disabled'});
   report.push({page:name,theme,errors, ...await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily,accent:getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),panels:[...document.querySelectorAll('.card,.home-panel')].slice(0,4).map(e=>{let s=getComputedStyle(e);return{bg:s.backgroundColor,border:s.borderColor,radius:s.borderRadius}})}))});
   if(name==='index'){
    for(const width of [1280,850,540,360]){await page.setViewportSize({width,height:900});await page.waitForTimeout(350);await page.screenshot({path:path.join(out,'index-'+theme+'-'+width+'.png'),fullPage:false,animations:'disabled'}); report.push({page:name,theme,width,...await page.evaluate(()=>({scroll:document.documentElement.scrollWidth}))});}
    await page.setViewportSize({width:1280,height:720});
    await page.evaluate(()=>document.documentElement.dir='rtl');
    await page.screenshot({path:path.join(out,'index-'+theme+'-rtl.png'),fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>{document.documentElement.dir='ltr';document.documentElement.setAttribute('data-reduced-motion','true');});
    const initial=await page.evaluate(()=>({image:document.querySelector('.home-vehicle-art img').naturalWidth,ring:getComputedStyle(document.querySelector('#dashSocRing svg')).display,commands:document.querySelectorAll('.dash-command-grid-main button').length,details:document.querySelector('.home-vehicle-details').open}));
    if(!initial.image||initial.ring!=='none'||initial.commands!==6||initial.details) throw Error('Vehicle presentation contract failed: '+JSON.stringify(initial));
    await page.evaluate(()=>BYD.dashboard.updateFromStatus({acc:false,soc:{percent:82},range:{elecRangeKm:341},gpuSurveillance:true,recordingStatus:{gear:'P',isRecording:false},battery:{voltage:12.6,available:true}}));
    const readings=await page.evaluate(()=>({soc:document.getElementById('dashHeroSoc').textContent,range:document.getElementById('dashHeroRange').textContent,state:document.getElementById('dashDriveState').dataset.state}));
    if(!readings.soc.includes('82')||!readings.range.includes('341')||readings.state!=='parked') throw Error('Live reading rendering failed: '+JSON.stringify(readings));
    await page.screenshot({path:path.join(out,'index-'+theme+'-populated.png'),fullPage:true,animations:'disabled'});
    await page.locator('.home-vehicle-details summary').click();
    if(!await page.locator('#dashGlanceCar').isVisible()) throw Error('Sensor details cannot be opened');
    await page.screenshot({path:path.join(out,'index-'+theme+'-details.png'),fullPage:true,animations:'disabled'});

   }
   await page.close();
  }
  await context.close();
 }
 await browser.close();server.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pages:report.length,errors:report.filter(x=>x.errors?.length),overflow:report.filter(x=>x.scroll>x.width),accents:[...new Set(report.map(x=>x.accent).filter(Boolean))]},null,2));
 if(report.some(x=>x.scroll>x.width||x.errors?.length||x.accent&&(x.accent.toUpperCase()!==(x.theme==='light'?'#DB4F1C':'#FF8068')))) process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
