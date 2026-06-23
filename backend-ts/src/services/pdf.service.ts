import { Injectable } from '@nestjs/common';

/**
 * PDF 服务 — 使用 Puppeteer 生成 A4 PDF
 *
 * 注意：需要安装 puppeteer
 * npm install puppeteer
 */
@Injectable()
export class PdfService {
  /**
   * 生成 PDF
   * @param html HTML 内容
   * @returns PDF Buffer
   */
  async generatePdf(html: string): Promise<Buffer> {
    // 动态导入 puppeteer（避免启动时加载）
    const puppeteer = await import('puppeteer');

    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

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
    // 包装为完整的 HTML 文档
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 0;
    }
    @media print {
      body { padding: 0; }
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
