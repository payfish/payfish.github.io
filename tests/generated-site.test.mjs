import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const SITE = new URL('https://payfish.github.io/');
const read = (path) => readFileSync(path, 'utf8');

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
}

const routeFile = (route) => join(
  PUBLIC,
  decodeURIComponent(route).replace(/^\//, ''),
  'index.html',
);
const routeHtml = (route) => {
  const path = routeFile(route);
  assert.ok(existsSync(path), `missing generated route ${route}`);
  return read(path);
};
const pageUrl = (htmlFile) => {
  const route = relative(PUBLIC, htmlFile)
    .split(sep)
    .join('/')
    .replace(/index\.html$/, '');
  return new URL(route, SITE);
};
const assetPattern = /\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i;
const decodePathname = (pathname) => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    assert.fail(`invalid URL encoding in local asset path ${pathname}`);
  }
};
const localAsset = (raw, base) => {
  const value = raw.trim().replaceAll('&amp;', '&');
  if (
    !value
    || /^(?:data:|mailto:|tel:|javascript:|#)/i.test(value)
    || value.startsWith('//')
  ) {
    return null;
  }

  let url;
  try {
    url = new URL(value, base);
  } catch {
    assert.fail(`invalid local asset URL ${raw}`);
  }

  if (!/^https?:$/.test(url.protocol) || url.origin !== SITE.origin) return null;
  if (!assetPattern.test(url.pathname)) return null;
  return decodePathname(url.pathname);
};
const assetFile = (pathname) => join(PUBLIC, pathname.replace(/^\//, ''));
const srcsetUrls = (srcset) => {
  const urls = [];
  let position = 0;

  while (position < srcset.length) {
    while (position < srcset.length && /[\s,]/.test(srcset[position])) position += 1;
    if (position >= srcset.length) break;

    const start = position;
    const dataCandidate = srcset.slice(position, position + 5).toLowerCase() === 'data:';
    while (
      position < srcset.length
      && !/\s/.test(srcset[position])
      && (dataCandidate || srcset[position] !== ',')
    ) {
      position += 1;
    }
    const rawCandidate = srcset.slice(start, position);
    const candidate = rawCandidate.replace(/,+$/, '');
    if (candidate) urls.push(candidate);
    if (!dataCandidate && srcset[position] === ',') {
      position += 1;
      continue;
    }
    if (rawCandidate.endsWith(',')) continue;

    while (position < srcset.length && srcset[position] !== ',') position += 1;
    if (srcset[position] === ',') position += 1;
  }

  return urls;
};
const htmlFiles = existsSync(PUBLIC)
  ? walk(PUBLIC).filter((path) => path.endsWith('.html'))
  : [];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('Redefine shell, routes, search, attribution, and dark mode are generated', () => {
  const home = routeHtml('/');

  assert.ok(home.includes('home-banner-container'), 'missing Redefine home banner');
  assert.ok(home.includes('tool-dark-light-toggle'), 'missing dark-mode tool');
  assert.ok(/Fu1sh(?:&#39;|')s BLOG/.test(home), 'missing site title');
  assert.ok(
    home.includes('github.com/EvanNotFound/hexo-theme-redefine'),
    'missing official Redefine repository footer link',
  );
  assert.ok(home.includes('Redefine v2.9.0'), 'missing Redefine v2.9.0 footer');

  const fixture = join(ROOT, 'tests', 'fixtures', 'legacy-routes.json');
  assert.ok(existsSync(fixture), 'missing legacy route fixture');
  for (const route of JSON.parse(read(fixture))) {
    assert.ok(existsSync(routeFile(route)), `missing legacy route ${route}`);
  }

  assert.ok(
    existsSync(join(PUBLIC, 'search.xml')) || existsSync(join(PUBLIC, 'search.json')),
    'missing generated search.xml or search.json',
  );
});

test('AI article routes, rendered titles, dates, and taxonomy are correct', () => {
  const posts = [
    ['/2026/03/11/RAG学习笔记/', 'RAG学习笔记', '2026-03-11', ['RAG', '大模型', '知识库']],
    ['/2026/03/15/NLP学习笔记/', 'NLP学习笔记', '2026-03-15', ['NLP', '大模型']],
  ];

  for (const [route, title, date, tags] of posts) {
    const html = routeHtml(route);
    const titlePattern = new RegExp(
      `<h1\\b[^>]*\\bclass\\s*=\\s*(["'])[^"']*\\barticle-title-(?:cover|regular)\\b[^"']*\\1[^>]*>\\s*${escapeRegex(title)}\\s*</h1>`,
      'gi',
    );
    const datePattern = new RegExp(
      `<span\\b[^>]*\\bclass\\s*=\\s*(["'])[^"']*\\b(?:desktop|mobile)\\b[^"']*\\1[^>]*>\\s*${date}(?:\\s+\\d{2}:\\d{2})?\\s*</span>`,
      'i',
    );

    assert.equal(
      html.match(titlePattern)?.length ?? 0,
      1,
      `expected one rendered title for ${title}`,
    );
    assert.match(html, datePattern, `missing exact article date for ${title}`);
    assert.match(routeHtml('/categories/AI学习/'), new RegExp(escapeRegex(title)));
    for (const tag of tags) {
      assert.match(routeHtml(`/tags/${tag}/`), new RegExp(escapeRegex(title)));
    }
  }

  assert.ok(
    !existsSync(join(PUBLIC, '2026', '08')),
    'obsolete August 2026 article routes must not be generated',
  );

  const rag = routeHtml('/2026/03/11/RAG学习笔记/');
  assert.match(rag, /build_prompt/);
  assert.match(rag, /\/images\/rag-architecture\.svg/);
  const codeClassSets = [...rag.matchAll(
    /<(?:figure|pre|code)\b[^>]*\bclass\s*=\s*(["'])([^"']*)\1[^>]*>/gi,
  )].map((match) => new Set(match[2].trim().split(/\s+/)));
  assert.ok(
    codeClassSets.some((tokens) => tokens.has('highlight') && tokens.has('python')),
    'RAG Python code element must include highlight and python class tokens',
  );
});

test('every generated HTML local asset exists, including lazy and srcset references', () => {
  assert.ok(htmlFiles.length > 0, 'no generated HTML files found');
  assert.ok(
    routeHtml('/').includes('home-banner-container'),
    'asset scan requires Redefine-generated HTML',
  );

  for (const htmlFile of htmlFiles) {
    const html = read(htmlFile);
    const refs = [...html.matchAll(
      /\b(?:data-original|data-src|src|href)\s*=\s*(["'])([^"']+)\1/gi,
    )].map((match) => match[2]);

    for (const match of html.matchAll(/\bsrcset\s*=\s*(["'])([^"']+)\1/gi)) {
      refs.push(...srcsetUrls(match[2]));
    }

    for (const ref of refs) {
      const pathname = localAsset(ref, pageUrl(htmlFile));
      if (pathname) {
        assert.ok(
          existsSync(assetFile(pathname)),
          `${relative(PUBLIC, htmlFile)} -> ${ref}`,
        );
      }
    }
  }
});

test('every generated CSS local asset exists and highlight styles are present', () => {
  assert.ok(existsSync(PUBLIC), 'public directory is not generated');
  const cssFiles = walk(PUBLIC).filter((path) => path.endsWith('.css'));
  assert.ok(cssFiles.length > 0, 'no generated CSS files found');

  for (const cssFile of cssFiles) {
    const cssRoute = relative(PUBLIC, cssFile).split(sep).join('/');
    for (const match of read(cssFile).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const pathname = localAsset(match[1], new URL(cssRoute, SITE));
      if (pathname) {
        assert.ok(
          existsSync(assetFile(pathname)),
          `${cssRoute} -> ${match[1]}`,
        );
      }
    }
  }

  const generatedCss = cssFiles.map(read).join('\n');
  assert.match(generatedCss, /(?:\.highlight\b|\.hljs\b)[^{]*\{/);
});
