import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../docs/', import.meta.url));
const origin = 'https://pages.example';
const routes = ['', 'two-wheel/', 'three-wheel/'];
const failures = [];
let checked = 0;

function check(value, base, prefix) {
  if (!value || /^(data:|mailto:|tel:|https?:|\/\/)/.test(value)) return;
  const url = new URL(value.replaceAll('&amp;', '&'), base);
  if (url.origin !== origin) return;
  checked++;
  if (!url.pathname.startsWith(prefix)) {
    failures.push(`Escapes site prefix: ${value} from ${base}`);
    return;
  }
  let file = path.join(root, decodeURIComponent(url.pathname.slice(prefix.length)));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    failures.push(`Missing ${url.pathname} from ${base}`);
    return;
  }
  if (url.hash && file.endsWith('.html')) {
    const html = fs.readFileSync(file, 'utf8');
    const id = decodeURIComponent(url.hash.slice(1));
    if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) failures.push(`Missing anchor: ${url.href}`);
  }
}

function walk(folder) {
  return fs.readdirSync(folder, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const files = walk(root);
for (const prefix of ['/', '/ciney-website/']) {
  for (const route of routes) {
    const html = fs.readFileSync(path.join(root, route, 'index.html'), 'utf8');
    const page = origin + prefix + route;
    const baseTag = html.match(/<base\s+href="([^"]*)"/);
    const base = baseTag ? new URL(baseTag[1], page).href : page;
    for (const tag of html.matchAll(/<(?:a|img|video|source|link|script|button)\b[^>]*>/g)) {
      for (const attr of tag[0].matchAll(/\b(?:src|href|poster|data-src|data-mobile-src|data-move-src|data-move-poster)="([^"]*)"/g)) check(attr[1], base, prefix);
      const srcset = tag[0].match(/srcset="([^"]*)"/);
      if (srcset) for (const entry of srcset[1].split(',')) check(entry.trim().split(/\s+/)[0], base, prefix);
    }
    for (const style of html.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) check(style[1], base, prefix);
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1], {filename: route || 'home'});
  }
  for (const file of files.filter(file => file.endsWith('.css'))) {
    const base = origin + prefix + path.relative(root, file).replaceAll('\\', '/');
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)) check(match[1], base, prefix);
  }
  for (const chapter of ['unfold', 'lift', 'frame', 'drive', 'fold']) {
    for (const suffix of ['.mp4', '-mobile.mp4', '.webp']) check(`../assets/${chapter}-black-v02-4b096a2e${suffix}`, origin + prefix + 'three-wheel/', prefix);
  }
  check('../assets/film-1080-black-v02-4b096a2e.mp4', origin + prefix + 'three-wheel/', prefix);
}
for (const file of files.filter(file => file.endsWith('.js'))) new vm.Script(fs.readFileSync(file, 'utf8'), {filename: path.relative(root, file)});
for (const file of files) {
  if (fs.statSync(file).size >= 100 * 1024 * 1024) failures.push(`Exceeds GitHub per-file limit: ${file}`);
}
if (failures.length) throw new Error(failures.join('\n'));
console.log(JSON.stringify({pages: routes.length, hostingPrefixes: ['/', '/ciney-website/'], checkedReferences: checked, brokenReferences: 0, files: files.length, bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0), scripts: 'valid', tribotFilm: 'V02 desktop and mobile'}));
