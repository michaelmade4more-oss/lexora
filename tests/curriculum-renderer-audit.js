const { chromium } = require('playwright');
const base=process.env.LEXORA_BASE_URL||'http://127.0.0.1:8000';
const cases=[
  [6,'sound-attention','sound-attention'],
  [9,'rhyming-and-syllables','rhyming-syllables'],
  [12,'oral-blending','oral-blending']
];
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const c=await b.newContext(); await c.addInitScript(()=>sessionStorage.setItem('lexoraSelectedProfile','Renderer Audit'));
 const p=await c.newPage(); const evidence=[];
 for(const [n,unit,renderer] of cases){
  await p.goto(`${base}/early-lesson-${String(n).padStart(2,'0')}.html`,{waitUntil:'networkidle'});
  const actual=await p.locator('.family-shell').getAttribute('data-renderer');
  const marker=await p.locator(`[data-family="${renderer}"]`).count();
  if(actual!==renderer||marker!==1) throw new Error(`Lesson ${n}: expected ${renderer}, got ${actual}/${marker}`);
  evidence.push({lesson:n,unit,renderer,marker});
 }
 await p.goto(`${base}/early-lesson-06.html`,{waitUntil:'networkidle'});
 await p.evaluate(()=>{sessionStorage.setItem('lexoraExpectedLesson','early-lesson-07');sessionStorage.setItem('lexoraExpectedRenderer','sound-attention');});
 await p.reload({waitUntil:'networkidle'});
 const identity=await p.locator('[role="alert"]').textContent();
 if(!identity.includes('does not match')) throw new Error('Identity guard did not fire');
 console.log(JSON.stringify({status:'PASS',evidence,identityGuard:'PASS'}));
 await b.close();
})().catch(async e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
