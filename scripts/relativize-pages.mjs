import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const outDir = path.resolve("out");

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) files.push(...walk(file));
    else files.push(file);
  }
  return files;
}

const prefixPattern = /(["'(=])\/(_next|brand|icon\.svg|favicon\.ico)/g;

for (const file of walk(outDir)) {
  // CSS urls are already relative to the stylesheet. JS checks that its
  // script URL contains "/_next/", so only the HTML document should change.
  if (!file.endsWith(".html")) continue;
  const depth = path.relative(outDir, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const relativeRoot = depth === 0 ? "./" : "../".repeat(depth);
  const source = readFileSync(file, "utf8");
  const rewritten = source.replace(prefixPattern, `$1${relativeRoot}$2`);
  if (rewritten !== source) writeFileSync(file, rewritten);
}
