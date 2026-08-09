import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
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

const decodePathname = (pathname) => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    assert.fail(`invalid URL encoding in local path ${pathname}`);
  }
};
const resolvePublicPath = (pathname, ...segments) => {
  const decoded = decodePathname(pathname).replace(/^[/\\]+/, '');
  const resolved = resolve(PUBLIC, decoded, ...segments);
  const publicRelative = relative(PUBLIC, resolved);

  assert.ok(
    publicRelative !== '..'
      && !publicRelative.startsWith(`..${sep}`)
      && !isAbsolute(publicRelative),
    `resolved path must stay within public: ${pathname}`,
  );

  return resolved;
};
const routeFile = (route) => resolvePublicPath(route, 'index.html');
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
  return url.pathname;
};
const assetFile = (pathname) => resolvePublicPath(pathname);
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

test('route and asset path mappings reject traversal outside public', () => {
  const traversalCases = [
    ['route', routeFile, '/../package.json'],
    ['encoded route', routeFile, '/%2e%2e/package.json'],
    ['encoded route separator', routeFile, '/%2e%2e%2fpackage.json'],
    ['asset', assetFile, '/../package.json'],
    ['encoded asset', assetFile, '/%2e%2e/package.json'],
  ];

  for (const [label, mapPath, pathname] of traversalCases) {
    assert.throws(
      () => mapPath(pathname),
      /must stay within public/,
      `${label} traversal must be rejected`,
    );
  }

  assert.equal(
    routeFile('/2026/03/11/RAG学习笔记/'),
    join(PUBLIC, '2026', '03', '11', 'RAG学习笔记', 'index.html'),
  );
  assert.equal(
    routeFile('/2026/03/15/NLP%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0/'),
    join(PUBLIC, '2026', '03', '15', 'NLP学习笔记', 'index.html'),
  );
  assert.equal(
    assetFile('/images/rag-architecture.svg'),
    join(PUBLIC, 'images', 'rag-architecture.svg'),
  );
});

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

test('every canonical URL preserves the exact generated route casing', () => {
  assert.ok(htmlFiles.length > 0, 'no generated HTML files found');

  for (const htmlFile of htmlFiles) {
    const html = read(htmlFile);
    const match = html.match(
      /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i,
    );
    assert.ok(match, `${relative(PUBLIC, htmlFile)} is missing a canonical URL`);

    const actual = new URL(match[1], SITE);
    const expected = pageUrl(htmlFile);
    assert.equal(actual.origin, expected.origin, `${relative(PUBLIC, htmlFile)} canonical origin`);
    assert.equal(
      decodePathname(actual.pathname),
      decodePathname(expected.pathname),
      `${relative(PUBLIC, htmlFile)} canonical route casing`,
    );
  }
});

test('disabled Redefine demo values and assets are absent from generated site', () => {
  assert.ok(htmlFiles.length > 0, 'no generated HTML files found');
  for (const htmlFile of htmlFiles) {
    assert.doesNotMatch(
      read(htmlFile),
      /wallhaven|custom-icon|you@example\.com/i,
      `${relative(PUBLIC, htmlFile)} contains a disabled demo value`,
    );
  }

  const demoAssets = [
    '/images/redefine-avatar.svg',
    '/images/redefine-favicon.svg',
    '/images/redefine-logo.svg',
    '/images/redefine-logo.webp',
    '/images/redefine-og.webp',
    '/images/wallhaven-wqery6-dark.webp',
    '/images/wallhaven-wqery6-light.webp',
  ];
  for (const asset of demoAssets) {
    assert.ok(!existsSync(assetFile(asset)), `unexpected generated demo asset ${asset}`);
  }

  for (const asset of ['/images/loading.svg', '/images/bookmark-placeholder.svg']) {
    assert.ok(existsSync(assetFile(asset)), `missing required runtime asset ${asset}`);
  }

  const home = routeHtml('/');
  const currentYear = new Date().getFullYear();
  assert.doesNotMatch(home, /2022|fa-heart|fa-beat/);
  assert.match(home, new RegExp(`2024[\\s\\S]*${currentYear}[\\s\\S]*fa-code`));
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
    !existsSync(routeFile('/2026/08/09/RAG学习笔记/')),
    'obsolete RAG route /2026/08/09/RAG学习笔记/ must not be generated',
  );
  assert.ok(
    !existsSync(routeFile('/2026/08/09/NLP学习笔记/')),
    'obsolete NLP route /2026/08/09/NLP学习笔记/ must not be generated',
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
