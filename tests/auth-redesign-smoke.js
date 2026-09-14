const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const cases = [
    ['small-phone', 320, 700],
    ['standard-phone', 390, 844],
    ['tablet-portrait', 768, 1024],
    ['tablet-landscape', 1024, 768]
  ];
  for (const [name, width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto('http://127.0.0.1:4173/auth.html');
    const result = await page.evaluate(() => {
      const ids = ['loginTab','signupTab','nameField','emailInput','pwInput','submitBtn','googleBtn','status'];
      const missing = ids.filter(id => !document.getElementById(id));
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      return { missing, overflow, width: innerWidth, height: innerHeight, scale: visualViewport?.scale };
    });
    if (result.missing.length || result.overflow || result.scale !== 1) throw new Error(`${name}: ${JSON.stringify(result)}`);
    await page.locator('#signupTab').click();
    if (await page.locator('#nameField').isHidden()) throw new Error(`${name}: signup name field did not show`);
    if ((await page.locator('#submitBtn').textContent()).trim() !== 'Create account') throw new Error(`${name}: signup CTA did not update`);
    await page.locator('#loginTab').click();
    if (!(await page.locator('#nameField').isHidden())) throw new Error(`${name}: login name field did not hide`);
    await page.close();
    console.log(`${name}: passed`);
  }
  await browser.close();
})();
