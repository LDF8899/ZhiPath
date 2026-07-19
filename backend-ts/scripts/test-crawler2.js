const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  try {
    const url = 'https://www.zhipin.com/job_detail/29349b5c691e71681HJ73N65GVFS.html';
    console.log('Opening:', url);
    await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    
    // 获取主内容区
    const mainEl = await page.$('.job-box, .detail-box, [class*="job-detail"], .job-primary');
    console.log('mainEl found:', !!mainEl);
    
    // 尝试找所有可能包含岗位名的元素
    const allText = await page.evaluate(() => {
      // 找标题附近的文本
      const result = {};
      // 所有 h1/h2 标签
      const headings = document.querySelectorAll('h1, h2, h3');
      headings.forEach((h, i) => {
        const text = h.textContent.trim();
        if (text && text.length > 2 && text.length < 60) {
          result['heading_' + i] = text;
        }
      });
      // 特定 class
      const nameEl = document.querySelector('[class*="name"]:not([class*="company"])');
      if (nameEl) result['name_el'] = nameEl.textContent.trim().substring(0, 100);
      
      // 找薪资
      const salaryEl = document.querySelector('[class*="salary"], [class*="Salary"]');
      if (salaryEl) result['salary'] = salaryEl.textContent.trim().substring(0, 50);
      
      // 找公司
      const compEl = document.querySelector('[class*="company"], [ka^="job-detail-company"]');
      if (compEl) result['company'] = compEl.textContent.trim().substring(0, 50);
      
      return result;
    });
    console.log('Extracted:', JSON.stringify(allText, null, 2));
    
    // 保存 HTML 到文件分析
    const html = await page.content();
    // 找包含"得物"的片段
    const idx = html.indexOf('得物');
    if (idx > 0) console.log('\nAround 得物:', html.substring(Math.max(0,idx-200), idx+200));
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
