const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  try {
    const url = 'https://www.zhipin.com/job_detail/29349b5c691e71681HJ73N65GVFS.html';
    console.log('Opening...');
    await page.goto(url, { timeout: 30000, waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    console.log('Title:', title);
    
    // 截图
    await page.screenshot({ path: 'scripts/boss_page.png' });
    console.log('Screenshot saved to scripts/boss_page.png');
    
    // 导出 body 文本
    const bodyText = await page.evaluate(() => document.body.innerText);
    // 找关键片段
    const idx = bodyText.indexOf('前端');
    if (idx >= 0) {
      console.log('\n=== Text around 前端 ===');
      console.log(bodyText.substring(Math.max(0,idx-50), idx+200));
    }
    
    // 找 salary
    const salIdx = bodyText.search(/\d+[-~]\d+K/);
    if (salIdx >= 0) {
      console.log('\n=== Text around salary ===');
      console.log(bodyText.substring(Math.max(0,salIdx-30), salIdx+60));
    }
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
