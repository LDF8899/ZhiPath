const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  
  const sites = [
    { url: 'https://www.lagou.com/jobs/list_%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91', label: 'Lagou list' },
    { url: 'https://www.liepin.com/zhaopin/?key=%E5%89%8D%E7%AB%AF%E5%BC%80%E5%8F%91', label: 'Liepin' },
    { url: 'https://www.nowcoder.com/jobs?keyword=%E5%89%8D%E7%AB%AF', label: 'Nowcoder' },
  ];
  
  for (const { url, label } of sites) {
    try {
      console.log('\n=== ' + label + ' ===');
      await page.goto(url, { timeout: 20000, waitUntil: 'domcontentloaded' });
      
      // 等一小会看渲染结果
      let bodyLen = 0;
      for (let i = 0; i < 3; i++) {
        await page.waitForTimeout(2000);
        bodyLen = (await page.evaluate(() => document.body.innerText)).length;
        if (bodyLen > 200) break;
      }
      
      console.log('Body text length:', bodyLen);
      if (bodyLen > 0) {
        const text = await page.evaluate(() => document.body.innerText);
        console.log('Sample:', text.substring(0, 400));
        break; // 一个成功就行
      }
    } catch(e) {
      console.log(label, 'error:', e.message);
    }
  }
  
  await browser.close();
})();
