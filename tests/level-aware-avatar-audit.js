const {chromium}=require('playwright');
const base=process.env.LEXORA_BASE_URL||'http://127.0.0.1:8000';
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const results=[];
  for(const viewport of [{width:390,height:844},{width:768,height:1024}]){
    const c=await b.newContext({viewport});
    const p=await c.newPage();
    await p.goto(`${base}/add-child-profile.html`,{waitUntil:'networkidle'});
    await p.locator('#childName').fill('Level Test');
    await p.locator('#toAge').click();
    await p.waitForFunction(()=>document.querySelectorAll('#avatarChoices .avatar-choice').length===8);
    results.push(`collection:Early Learner:${viewport.width}=PASS`);
    for(let i=0;i<8;i++){await p.locator('#avatarChoices .avatar-choice').nth(i).click();if(await p.locator('#avatarChoices .avatar-choice').nth(i).getAttribute('aria-pressed')!=='true')throw Error(`Early Learner avatar ${i+1} not selectable`);}
    results.push('early-learner-all-8-selectable=PASS');
    await p.locator('.age-option[data-age="Foundation"]').click();
    await p.waitForFunction(()=>document.querySelectorAll('#avatarChoices .avatar-choice').length===8);
    const foundationSrcs=await p.locator('#avatarChoices img').evaluateAll(xs=>xs.map(x=>x.getAttribute('src')));
    if(!foundationSrcs.every(src=>src.includes('assets/avatars/foundation/foundation-')))throw Error('Foundation collection path mismatch');
    if(!(await p.locator('#avatarPreviewImage').getAttribute('src')).includes('assets/avatars/foundation/foundation-01.png'))throw Error('Foundation preview missing');
    results.push('foundation-all-8-rendered=PASS');
    for(let i=0;i<8;i++){await p.locator('#avatarChoices .avatar-choice').nth(i).click();if(await p.locator('#avatarChoices .avatar-choice').nth(i).getAttribute('aria-pressed')!=='true')throw Error(`Foundation avatar ${i+1} not selectable`);}
    results.push('foundation-all-8-selectable=PASS');
    await p.locator('#avatarChoices .avatar-choice').nth(7).click();
    if(!(await p.locator('#avatarPreviewImage').getAttribute('src')).includes('foundation-08.png'))throw Error('Foundation preview did not update');
    await p.locator('#toReview').click();
    if(!(await p.locator('#reviewCard img').getAttribute('src')).includes('foundation-08'))throw Error('Foundation review preview mismatch');
    if((await p.locator('body').evaluate(()=>document.body.scrollWidth))>viewport.width)throw Error('responsive overflow');
    results.push(`foundation-review-and-layout:${viewport.width}=PASS`);
    await c.close();
  }
  const c=await b.newContext({viewport:{width:390,height:844}});
  const p=await c.newPage();
  await p.goto(`${base}/profile-picker.html`,{waitUntil:'networkidle'});
  await p.evaluate(()=>localStorage.setItem('lexoraChildProfiles',JSON.stringify([{name:'Early Child',avatar:'early-learner-08',ageBand:'Early Learner',avatarCollection:'early-learner'},{name:'Foundation Child',avatar:'foundation-08',ageBand:'Foundation',avatarCollection:'foundation'}])));
  await p.reload({waitUntil:'networkidle'});
  if(await p.locator('[data-profile="Early Child"] img').getAttribute('src')!=='assets/avatars/early-learner/early-learner-08.png')throw Error('Early Learner persistence failed');
  if(await p.locator('[data-profile="Foundation Child"] img').getAttribute('src')!=='assets/avatars/foundation/foundation-08.png')throw Error('Foundation persistence failed');
  if((await p.locator('[data-profile="Early Child"] .profile-meta').textContent())!=='Early Learner')throw Error('Early profile metadata isolation failed');
  if((await p.locator('[data-profile="Foundation Child"] .profile-meta').textContent())!=='Foundation')throw Error('Foundation profile metadata isolation failed');
  results.push('reload-persistence-and-profile-isolation=PASS');
  await c.close();
  await b.close();
  console.log(JSON.stringify({status:'PASS',checks:results}));
})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exit(1);});
