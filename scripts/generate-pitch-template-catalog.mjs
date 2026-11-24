#!/usr/bin/env node
/**
 * 扫描 resource/pitch-templates 生成目录 JSON（薄封装，核心逻辑在 node/src/lib）
 *
 * 用法：
 *   node scripts/generate-pitch-template-catalog.mjs
 *   node scripts/generate-pitch-template-catalog.mjs --src "/path/to/通用项目计划书"
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const srcIdx = args.indexOf('--src');
const src =
  srcIdx >= 0 && args[srcIdx + 1] ? path.resolve(args[srcIdx + 1]) : undefined;

const libUrl = pathToFileURL(
  path.join(ROOT, 'node/src/lib/pitchTemplateCatalog.js')
).href;

const { rebuildPitchTemplateCatalog } = await import(libUrl);

const out = path.join(ROOT, 'resource/pitch-templates');
const result = rebuildPitchTemplateCatalog(
  src ? { src, out } : { src: out, out }
);

console.log(
  `完成：${result.categoryCount} 类，${result.totalFiles} 文件 → ${result.root}`
);
console.log(`generatedAt: ${result.generatedAt}`);
