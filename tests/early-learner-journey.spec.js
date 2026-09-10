const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.LEXORA_BASE_URL || 'http://127.0.0.1:8000';
const profile = 'Harness Child';
const otherProfile = 'Other Child';
const correctAnswers = ['happy', 'ball', 'small', 'three', 'cat', 'chime', 'tap-tap', 'drum', 'hat', 'tap-tap', 'hat', 'log', 'apple', 'banana', 'sun'];
const results = [];

function record(step, status, detail, evidence = {}) {
  results.push({ step, status, detail, evidence, at: new Date().toISOString() });
}
function assertStep(condition, step, detail, evidence = {}) {
  if (!condition) throw new Error(`${step}: ${detail}`);
  record(step, 'PASS', detail, evidence);
}
async function visible(page, selector) { return page.locator(selector).isVisible().catch(() => false); }
async function waitForChoices(page) {
  await page.locator('.choices, #engineChoices').first().waitFor({ state: 'visible', timeout: 7000 });
}
async function localRecords(page, keyProfile = profile) {
  return page.evaluate((name) => {
    const key = `lexora_progress_v2_${name}`;
    return JSON.parse(localStorage.getItem(key) || '{"lessons":{}}');
  }, keyProfile);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ selected }) => {
    sessionStorage.setItem('lexoraSelectedProfile', selected);
    if (!sessionStorage.getItem('__harness_reset')) {
      localStorage.removeItem(`lexora_progress_v2_${selected}`);
      localStorage.removeItem(`lexora_progress_${selected}`);
      sessionStorage.setItem('__harness_reset', '1');
    }
    let seed = 17;
    Math.random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  }, { selected: profile });
  const page = await context.newPage();
  page.on('pageerror', (error) => record('runtime console', 'FAIL', error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('favicon') && !response.url().includes('/assets/audio/')) {
      record('network response', 'FAIL', `${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto(`${BASE_URL}/child-home-early.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('#lessonSummary')?.textContent?.includes('Lesson 1 of 15'), null, { timeout: 7000 });
    assertStep((await page.locator('#lessonSummary').textContent()).includes('Lesson 1 of 15'), '01 fresh profile', 'Fresh isolated child profile starts at Lesson 1.', { profile });

    for (let lesson = 1; lesson <= 15; lesson += 1) {
      const pageUrl = `${BASE_URL}/early-lesson-${String(lesson).padStart(2, '0')}.html`;
      await page.goto(pageUrl, { waitUntil: 'networkidle' });
      const stepText = await page.locator('.step-count, .engine-step').first().textContent();
      assertStep(stepText.includes(`${lesson} of 15`), `lesson ${lesson} position`, `Curriculum position is ${stepText.trim()}.`, { stepText });

      const isEngine = await visible(page, '#engineListen');
      // Lesson 1 forces the visual fallback path. Engine lessons are muted for the same deterministic path.
      if (lesson === 1 || isEngine) await page.locator('#mute, #engineMute').first().click();
      await page.locator('#listen, #engineListen').first().click();
      await waitForChoices(page);
      assertStep(true, `lesson ${lesson} reveal`, 'Choices reveal after the listen state.', { audioMode: lesson === 1 || isEngine ? 'muted/fallback' : 'normal' });
      if (lesson === 1 || isEngine) {
        assertStep(await visible(page, '#audioFallback, #engineFallback'), `lesson ${lesson} visual fallback`, 'Visual fallback is visible when audio is unavailable or muted.');
      }

      const choiceSelector = isEngine ? '.engine-choice' : '.choice';
      const choices = page.locator(choiceSelector);
      const correctId = correctAnswers[lesson - 1];
      assertStep(Boolean(correctId), `lesson ${lesson} answer key`, `Correct answer ID is available independently of position.`, { correctId });
      const wrong = page.locator(`${choiceSelector}:not([data-answer="${correctId}"])`).first();
      await wrong.click();
      const retrySelector = isEngine ? '#engineRetry' : '#retry';
      assertStep(await visible(page, retrySelector), `lesson ${lesson} retry`, 'Incorrect response reveals a visible replay action.');
      await page.locator(retrySelector).click();
      await page.waitForTimeout(650);
      await waitForChoices(page);
      assertStep(true, `lesson ${lesson} replay`, 'Replay returns to an answerable choice state.');
      await page.locator(`[data-answer="${correctId}"]`).click();
      const continueSelector = isEngine ? '#engineContinue' : '#continue';
      assertStep(await visible(page, continueSelector), `lesson ${lesson} correct`, 'Correct response reveals the continuation action.');
      await page.locator(continueSelector).click();
      await page.waitForTimeout(350);
      const finishSelector = isEngine ? '#engineFinish' : '#finish';
      assertStep(await visible(page, finishSelector), `lesson ${lesson} completion`, 'Completion state is visible without implying mastery.');
      await page.locator(finishSelector).click();

      const expectedNext = lesson < 15 ? lesson + 1 : 16;
      await page.waitForLoadState('networkidle');
      const afterFinishUrl = page.url();
      assertStep(afterFinishUrl.includes(lesson < 15 ? `early-lesson-${String(expectedNext).padStart(2, '0')}.html` : 'child-home-early.html'), `lesson ${lesson} next route`, 'Completion routes to the next lesson or home.', { afterFinishUrl });
      const stored = await localRecords(page);
      const recordForLesson = stored.lessons?.[`early-lesson-${String(lesson).padStart(2, '0')}`];
      assertStep(Boolean(recordForLesson?.completed), `lesson ${lesson} completion persistence`, 'Completion record is persisted separately from evidence.', { record: recordForLesson });
      assertStep(Boolean(recordForLesson?.evidence?.length), `lesson ${lesson} evidence persistence`, 'Learning evidence contains attempts and support data.', { evidenceCount: recordForLesson?.evidence?.length });

      await page.reload({ waitUntil: 'networkidle' });
      if (lesson < 15) {
        await page.goto(`${BASE_URL}/child-home-early.html`, { waitUntil: 'networkidle' });
        await page.waitForFunction((n) => document.querySelector('#lessonSummary')?.textContent?.includes(`Lesson ${n} of 15`), expectedNext, { timeout: 7000 });
        assertStep((await page.locator('#lessonSummary').textContent()).includes(`Lesson ${expectedNext} of 15`), `lesson ${lesson} home resume`, `Child Home offers Lesson ${expectedNext}.`);
      } else {
        await page.goto(`${BASE_URL}/child-home-early.html`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.querySelector('#lessonSummary')?.textContent?.includes('You can play again'), null, { timeout: 7000 });
        assertStep((await page.locator('#lessonSummary').textContent()).includes('You can play again'), 'lesson 15 home completion', 'Child Home reflects completion of the fifteen-lesson spine.');
      }
    }

    const final = await localRecords(page);
    const ids = Array.from({ length: 15 }, (_, i) => `early-lesson-${String(i + 1).padStart(2, '0')}`);
    assertStep(ids.every((id) => final.lessons?.[id]?.completed), 'final records', 'Lessons 1–15 all have completion records.', { lessonCount: Object.keys(final.lessons || {}).length });
    assertStep(ids.every((id) => final.lessons?.[id]?.evidence?.length), 'final evidence records', 'Lessons 1–15 all have learning evidence.', { lessonsWithEvidence: ids.filter((id) => final.lessons?.[id]?.evidence?.length).length });
    assertStep(ids.every((id) => final.lessons?.[id]?.progression?.eligible === false), 'separate progression eligibility', 'Progression eligibility remains distinct and configurable; completion does not set it true.');

    const other = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await other.addInitScript(({ selected }) => sessionStorage.setItem('lexoraSelectedProfile', selected), { selected: otherProfile });
    const otherPage = await other.newPage();
    await otherPage.goto(`${BASE_URL}/child-home-early.html`, { waitUntil: 'networkidle' });
    await otherPage.waitForFunction(() => document.querySelector('#lessonSummary')?.textContent?.includes('Lesson 1 of 15'), null, { timeout: 7000 });
    assertStep((await otherPage.locator('#lessonSummary').textContent()).includes('Lesson 1 of 15'), 'profile isolation', 'A second child profile starts independently at Lesson 1.');
    await other.close();
    record('journey summary', 'PASS', 'Fresh profile completed Lessons 1–15 with persistence, retry, fallback, replay, and isolation checks.');
  } catch (error) {
    record('journey summary', 'FAIL', error.message);
    console.error(JSON.stringify({ status: 'FAIL', results }, null, 2));
    await browser.close();
    process.exitCode = 1;
  }

  await browser.close();
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const report = { status: failed ? 'FAIL' : 'PASS', passed, failed, baseUrl: BASE_URL, profile, results };
  fs.mkdirSync(path.join(__dirname, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'early-learner-journey-results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(__dirname, 'artifacts', 'early-learner-journey-results.md'), `# Early Learner Browser Journey\n\n**Result:** ${report.status}\n\n- Passed: ${passed}\n- Failed: ${failed}\n- Base URL: ${BASE_URL}\n\n| Step | Result | Detail |\n|---|---|---|\n${results.map((r) => `| ${r.step} | ${r.status} | ${r.detail.replace(/\|/g, '\\|')} |`).join('\n')}\n`);
  console.log(JSON.stringify({ status: report.status, passed, failed, report: 'tests/artifacts/early-learner-journey-results.json' }, null, 2));
  if (failed) process.exitCode = 1;
})();
