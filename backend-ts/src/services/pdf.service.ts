import { Injectable } from '@nestjs/common';

/**
 * PDF 服务 — 使用 Puppeteer 生成 A4 PDF
 *
 * 优先使用系统安装的 Edge/Chrome，无需额外安装浏览器。
 */

/** 缓存系统浏览器路径 */
let cachedBrowserPath: string | null = null;

function findSystemBrowser(): string | null {
  if (cachedBrowserPath !== null) return cachedBrowserPath;

  const { execSync } = require('child_process');
  const candidates = [
    // Windows Edge
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Windows Chrome
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // macOS Chrome
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // macOS Edge
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];

  for (const p of candidates) {
    try {
      require('fs').accessSync(p);
      console.log(`[PdfService] Using browser: ${p}`);
      cachedBrowserPath = p;
      return p;
    } catch {}
  }

  // try `which` on Linux/macOS
  try {
    const result = execSync('which google-chrome 2>/dev/null || which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf8' }).trim();
    if (result) {
      console.log(`[PdfService] Using browser: ${result}`);
      cachedBrowserPath = result;
      return result;
    }
  } catch {}

  console.warn('[PdfService] No system browser found, will fall back to puppeteer bundled Chrome');
  return null;
}

@Injectable()
export class PdfService {
  /**
   * 生成 PDF
   * @param html HTML 内容
   * @returns PDF Buffer
   */
  async generatePdf(html: string): Promise<Buffer> {
    const puppeteer = await import('puppeteer');

    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };

    const systemBrowser = findSystemBrowser();
    if (systemBrowser) {
      launchOptions.executablePath = systemBrowser;
    }

    const browser = await puppeteer.default.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });

      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * 生成简历 PDF 并返回 Buffer
   * @param htmlContent 简历 HTML
   * @returns PDF Buffer
   */
  async generateResumePdf(htmlContent: string): Promise<Buffer> {
    // 包装为 A4 优化的完整 HTML 文档
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #333;
      font-size: 14px;
    }
    /* 关键板块不断页 */
    h1, h2, h3, h4 { page-break-after: avoid; }
    .resume-section { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    ul, ol { page-break-inside: avoid; }
    /* 避免孤行 */
    p { orphans: 2; widows: 2; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    return this.generatePdf(fullHtml);
  }
}
