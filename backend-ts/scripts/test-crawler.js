const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  try {
    // 测试 BOSS 直聘详情页
    const url = 'https://www.zhipin.com/job_detail/29349b5c691e71681HJ73N65GVFS.html';
    console.log('Opening:', url);
    await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // 等 JS Challenge 执行完
    
    const title = await page.title();
    console.log('Page title:', title);
    
    // 检查是否被拦截
    const html = await page.content();
    console.log('HTML length:', html.length);
    
    if (title.includes('请稍候') || html.length < 5000) {
      console.log('Blocked by JS challenge, trying wait...');
      await page.waitForTimeout(5000);
      console.log('After wait title:', await page.title());
    }
    
    // 找关键元素
    const selectors = [
      ['h1', 'h1 text'],
      ['.name', 'job name'],
      ['.job-name', 'job name'],
      ['.info-primary .name', 'job name primary'],
      ['.company-info a', 'company link'],
      ['.company-name', 'company name'],
      ['.salary', 'salary'],
      ['.job-salary', 'salary 2'],
      ['.text', 'text'],
      ['.job-sec', 'job section'],
      ['.detail-content', 'detail content'],
      ['.job-detail', 'job detail'],
    ];
    
    for (const [sel, label] of selectors) {
      try {
        const el = await page.$(sel);
        const text = el ? (await el.textContent()).trim().substring(0, 150) : 'N/A';
        console.log(label + ' (' + sel + '):', text);
      } catch {}
    }
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
