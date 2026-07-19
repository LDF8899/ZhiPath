const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  try {
    const url = 'https://www.zhipin.com/job_detail/29349b5c691e71681HJ73N65GVFS.html';
    await page.goto(url, { timeout: 25000, waitUntil: 'load' });
    
    // 等待直到 body 有实质内容（最长等 12 秒）
    let content = '';
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(2000);
      content = await page.evaluate(() => document.body.innerText);
      const len = content.length;
      console.log('Wait #' + i + ': body text length =', len);
      if (len > 500) {
        // 检查是否有岗位相关关键词
        const hasJob = content.includes('岗位') || content.includes('招聘') || content.includes('职责') || content.includes('薪资');
        console.log('Has job keywords:', hasJob);
        if (hasJob) break;
      }
    }
    
    console.log('\n=== Body text (first 1500 chars) ===');
    console.log(content.substring(0, 1500));
    
    // 也检查 HTML 中是否包含有用数据
    const html = await page.content();
    // 检查是否有 JSON-LD 或 script 中的结构化数据
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLd) console.log('\n=== JSON-LD ===\n', jsonLd[1].substring(0, 500));
    
    // 检查 Next.js 的 __NEXT_DATA__
    const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextData) console.log('\n=== __NEXT_DATA__ found ===');
    
    // 找 script 中的 window.__INITIAL_STATE__
    const initState = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (initState) console.log('\n=== __INITIAL_STATE__ ===\n', initState[1].substring(0, 2000));
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
})();
