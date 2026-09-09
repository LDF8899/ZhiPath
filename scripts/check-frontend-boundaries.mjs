import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [
  ['智途 Vite 端口', read('frontend/vite.config.ts'), /port:\s*5173/],
  ['智途客户端标识', read('frontend/src/api/platform.ts'), /clientApp:\s*['"]zhipath-web['"]/],
  ['智途 Token 键', read('frontend/src/api/platform.ts'), /zhpath_token/],
  ['智途页面标题', read('frontend/index.html'), /智途 ZhiPath/],
  ['CodeNova Vite 端口', read('codenovafrontend/vite.config.ts'), /port:\s*5180/],
  ['CodeNova 客户端标识', read('codenovafrontend/src/lib/api.ts'), /clientApp:\s*['"]codenova-web['"]/],
  ['CodeNova Token 键', read('codenovafrontend/src/lib/api.ts'), /codenova_token/],
  ['CodeNova 页面标题', read('codenovafrontend/index.html'), /<title>CodeNova<\/title>/],
];

const failures = checks.filter(([, content, pattern]) => !pattern.test(content));
if (failures.length) {
  console.error('前端边界检查失败：');
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log('前端边界检查通过：智途(5173/zhipath-web/zhpath_*) 与 CodeNova(5180/codenova-web/codenova_*) 保持独立');
