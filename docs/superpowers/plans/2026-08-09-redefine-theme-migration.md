# Redefine Theme Migration Implementation Plan

> **For agentic workers:** Use `subagent-driven-development`. Every behavior change follows RED, GREEN, then refactor. Do not pause between tasks.

**Goal:** Replace Fluid with official Redefine 2.9.0, repair the two new AI posts, preserve historical routes, and publish a verified GitHub Pages build.

**Architecture:** Keep Hexo 7.1.1 and the existing `source`/`master` branch model. Redefine is an exact npm dependency, site overrides live in `_config.redefine.yml`, and Node built-in tests validate source metadata, merged theme behavior, generated routes, and local assets.

**Rollback baseline:** pre-migration source commit `6c52962`. Re-record remote `source` and `master` SHAs immediately before publishing.

## File Map

- Modify: `package.json`, `package-lock.json`, `_config.yml`
- Create: `_config.redefine.yml`
- Modify: `source/_posts/RAG学习笔记.md`, `source/_posts/NLP学习笔记.md`
- Create: `source/images/avatar.png`, `source/images/favicon.svg`, `source/images/home-banner.webp`, `source/images/rag-architecture.svg`
- Create: `tests/content-regressions.test.mjs`, `tests/theme-config.test.mjs`, `tests/generated-site.test.mjs`
- Create: `tests/fixtures/legacy-routes.json`

## Task 1: Repair Source Content with Two RED/GREEN Cycles

**Files:** `package.json`, `package-lock.json`, `tests/content-regressions.test.mjs`, both AI posts, `source/images/rag-architecture.svg`

- [ ] Install parser support and stage it with this task:

```bash
npm install --save-dev --save-exact hexo-front-matter@4.2.1
mkdir -p tests source/images
```

- [ ] Create `tests/content-regressions.test.mjs` with shared parsing helpers and the first two metadata/H1 tests:

```javascript
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import frontMatter from 'hexo-front-matter';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const parse = (path) => frontMatter.parse(read(path));
const chinaDate = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

test('RAG post has exact metadata and no duplicate body title', () => {
  const post = parse('source/_posts/RAG学习笔记.md');
  assert.equal(post.title, 'RAG学习笔记');
  assert.equal(chinaDate(post.date), '2026-03-11');
  assert.deepEqual(post.categories, ['AI学习']);
  assert.deepEqual(post.tags, ['RAG', '大模型', '知识库']);
  assert.doesNotMatch(post._content.trimStart(), /^#\s+/);
});

test('NLP post has exact metadata and no duplicate body title', () => {
  const post = parse('source/_posts/NLP学习笔记.md');
  assert.equal(post.title, 'NLP学习笔记');
  assert.equal(chinaDate(post.date), '2026-03-15');
  assert.deepEqual(post.categories, ['AI学习']);
  assert.deepEqual(post.tags, ['NLP', '大模型']);
  assert.doesNotMatch(post._content.trimStart(), /^#\s+/);
});
```

- [ ] Run `node --test tests/content-regressions.test.mjs`. Expected RED: both metadata tests fail because the files have no front matter. Fix syntax errors until failure is only the intended missing metadata.
- [ ] Add exact front matter and remove the leading `# RAG学习笔记` and `# NLP学习笔记` body headings:

```yaml
# RAG
---
title: RAG学习笔记
date: 2026-03-11
categories: [AI学习]
tags: [RAG, 大模型, 知识库]
---

# NLP
---
title: NLP学习笔记
date: 2026-03-15
categories: [AI学习]
tags: [NLP, 大模型]
---
```

- [ ] Re-run the test. Expected GREEN: 2 tests pass.
- [ ] Add a separate media/Prompt test, without changing production content yet:

```javascript
test('RAG post owns its Prompt example and architecture asset', () => {
  const post = parse('source/_posts/RAG学习笔记.md');
  assert.match(post._content, /def build_prompt\(context: str, question: str\) -> str:/);
  assert.match(post._content, /!\[RAG系统架构\]\(\/images\/rag-architecture\.svg\)/);
  assert.doesNotMatch(post._content, /[A-Z]:\\|pica\.zhimg\.com/i);
  assert.ok(existsSync(new URL('source/images/rag-architecture.svg', root)));
});
```

- [ ] Run the test. Expected RED: only the new test fails on the missing Prompt code, bad image URLs, and absent local SVG.
- [ ] Replace the missing screenshot with this copyable block:

```python
def build_prompt(context: str, question: str) -> str:
    return f"""你是一名企业知识助手。
请仅根据以下参考资料回答问题；资料不足时直接说明无法确定。

参考资料：
{context}

用户问题：
{question}
"""
```

- [ ] Create the complete `source/images/rag-architecture.svg`, then replace the hotlink with `![RAG系统架构](/images/rag-architecture.svg)`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" role="img" aria-labelledby="title desc">
  <title id="title">RAG系统架构</title>
  <desc id="desc">企业文档离线入库和用户问题在线检索生成的两条流程。</desc>
  <defs>
    <style>
      text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;fill:#172033;text-anchor:middle}
      .label{font-size:24px;font-weight:700;fill:#8f2435;text-anchor:start}.node{fill:#fff;stroke:#cbd5e1;stroke-width:2}.nodeText{font-size:20px}.arrow{stroke:#64748b;stroke-width:3;fill:none;marker-end:url(#arrow)}
    </style>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#64748b"/></marker>
  </defs>
  <rect width="1200" height="520" rx="24" fill="#f8fafc"/>
  <text class="label" x="60" y="70">离线知识入库</text>
  <g><rect class="node" x="60" y="105" width="210" height="78" rx="12"/><text class="nodeText" x="165" y="152">企业文档</text></g>
  <path class="arrow" d="M270 144H330"/>
  <g><rect class="node" x="335" y="105" width="210" height="78" rx="12"/><text class="nodeText" x="440" y="152">清洗与分块</text></g>
  <path class="arrow" d="M545 144H605"/>
  <g><rect class="node" x="610" y="105" width="210" height="78" rx="12"/><text class="nodeText" x="715" y="152">Embedding</text></g>
  <path class="arrow" d="M820 144H880"/>
  <g><rect class="node" x="885" y="105" width="255" height="78" rx="12"/><text class="nodeText" x="1012" y="152">向量数据库</text></g>
  <text class="label" x="60" y="280">在线检索生成</text>
  <g><rect class="node" x="35" y="320" width="150" height="78" rx="12"/><text class="nodeText" x="110" y="367">用户问题</text></g><path class="arrow" d="M185 359H220"/>
  <g><rect class="node" x="225" y="320" width="165" height="78" rx="12"/><text class="nodeText" x="307" y="367">Query向量化</text></g><path class="arrow" d="M390 359H425"/>
  <g><rect class="node" x="430" y="320" width="150" height="78" rx="12"/><text class="nodeText" x="505" y="367">检索召回</text></g><path class="arrow" d="M580 359H615"/>
  <g><rect class="node" x="620" y="320" width="150" height="78" rx="12"/><text class="nodeText" x="695" y="367">重排序</text></g><path class="arrow" d="M770 359H805"/>
  <g><rect class="node" x="810" y="320" width="145" height="78" rx="12"/><text class="nodeText" x="882" y="367">Prompt</text></g><path class="arrow" d="M955 359H990"/>
  <g><rect class="node" x="995" y="320" width="170" height="78" rx="12"/><text class="nodeText" x="1080" y="367">大模型回答</text></g>
</svg>
```

- [ ] Re-run the test. Expected GREEN: 3 tests pass.
- [ ] Stage and commit:

```bash
git add package.json package-lock.json tests/content-regressions.test.mjs \
  'source/_posts/RAG学习笔记.md' 'source/_posts/NLP学习笔记.md' source/images/rag-architecture.svg
git commit -m "fix: repair AI post metadata and images"
```

## Task 2: Add Deterministic Migration Contract Tests

**Files:** `tests/fixtures/legacy-routes.json`, `tests/theme-config.test.mjs`, `tests/generated-site.test.mjs`

- [ ] While Fluid is active, run `npm run clean && npm run build`. Generate the route fixture with this exact command:

```bash
node --input-type=module <<'NODE'
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const file = join(dir, name);
  return statSync(file).isDirectory() ? walk(file) : [file];
});
const articleRoutes = walk('public/2024').filter((file) => file.endsWith('/index.html')).map((file) => `/${relative('public', file).split(sep).join('/').replace(/index\.html$/, '')}`);
const routes = [...articleRoutes, '/about/', '/archives/', '/categories/', '/tags/'].sort();
mkdirSync('tests/fixtures', { recursive: true });
writeFileSync('tests/fixtures/legacy-routes.json', `${JSON.stringify(routes, null, 2)}\n`);
NODE
```

- [ ] Install structured YAML parsing: `npm install --save-dev --save-exact js-yaml@4.1.0`.
- [ ] Create this complete `tests/theme-config.test.mjs`. It parses YAML, deep-merges installed defaults when available, and turns missing pre-implementation state into assertion failures:

```javascript
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { load } from 'js-yaml';

const root = new URL('../', import.meta.url);
const file = (path) => new URL(path, root);
const read = (path) => readFileSync(file(path), 'utf8');
const readJson = (path) => JSON.parse(read(path));
const readYaml = (path) => load(read(path));
const merge = (base, override) => Object.entries(override ?? {}).reduce((result, [key, value]) => {
  result[key] = value && typeof value === 'object' && !Array.isArray(value)
    ? merge(result[key] ?? {}, value)
    : value;
  return result;
}, structuredClone(base ?? {}));

const pkg = readJson('package.json');
const themeDefaults = existsSync(file('node_modules/hexo-theme-redefine/_config.yml'))
  ? readYaml('node_modules/hexo-theme-redefine/_config.yml') : {};
const siteOverrides = existsSync(file('_config.redefine.yml')) ? readYaml('_config.redefine.yml') : {};
const theme = merge(themeDefaults, siteOverrides);

test('dependencies and scripts define one Redefine pipeline', () => {
  assert.equal(pkg.dependencies['hexo-theme-redefine'], '2.9.0');
  assert.equal(pkg.dependencies['hexo-generator-searchdb'], '1.5.0');
  assert.equal(pkg.dependencies['hexo-wordcount'], '6.0.1');
  assert.equal(pkg.devDependencies['hexo-front-matter'], '4.2.1');
  assert.equal(pkg.devDependencies['js-yaml'], '4.1.0');
  assert.equal(pkg.dependencies['hexo-lazyload-image'], undefined);
  assert.equal(pkg.scripts.test, 'node --test tests/*.test.mjs');
  assert.equal(pkg.scripts.verify, 'npm run clean && npm run build && npm test');
});

test('root Hexo contract is preserved while Redefine becomes active', () => {
  const config = readYaml('_config.yml');
  assert.equal(config.theme, 'redefine');
  assert.equal(config.url, 'https://payfish.github.io/');
  assert.equal(config.permalink, ':year/:month/:day/:title/');
  assert.equal(config.deploy.type, 'git');
  assert.equal(config.deploy.branch, 'master');
});

test('merged theme config uses only approved site behavior', () => {
  assert.equal(theme.defaults?.avatar, '/images/avatar.png');
  assert.equal(theme.defaults?.favicon, '/images/favicon.svg');
  assert.equal(theme.home_banner?.image?.light, '/images/home-banner.webp');
  assert.equal(theme.home_banner?.image?.dark, '/images/home-banner.webp');
  assert.equal(theme.navbar?.search?.enable, true);
  assert.equal(theme.comment?.enable, false);
  assert.equal(theme.global?.website_counter?.enable, false);
  assert.equal(theme.articles?.copyright?.enable, false);
  assert.equal(theme.footer?.runtime, false);
  assert.equal(theme.footer?.statistics, false);
  assert.equal(theme.colors?.default_mode, 'light');
  assert.equal(theme.articles?.code_block?.highlight_theme?.light, 'github');
  assert.equal(theme.articles?.code_block?.highlight_theme?.dark, 'vs2015');
  assert.doesNotMatch(JSON.stringify(siteOverrides), /wallhaven|Theme Redefine|redefine\.ohevan\.com/i);
});

test('installed theme retains its GPL license declaration', () => {
  assert.ok(existsSync(file('node_modules/hexo-theme-redefine/package.json')));
  const themePkg = readJson('node_modules/hexo-theme-redefine/package.json');
  assert.equal(themePkg.license, 'GPL-3.0');
  assert.match(read('node_modules/hexo-theme-redefine/LICENSE'), /GNU GENERAL PUBLIC LICENSE/);
});
```

- [ ] Create this complete `tests/generated-site.test.mjs`:

```javascript
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const SITE = new URL('https://payfish.github.io/');
const read = (path) => readFileSync(path, 'utf8');
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const routeFile = (route) => join(PUBLIC, decodeURIComponent(route), 'index.html');
const routeHtml = (route) => read(routeFile(route));
const pageUrl = (htmlFile) => {
  const route = relative(PUBLIC, htmlFile).split(sep).join('/').replace(/index\.html$/, '');
  return new URL(route, SITE);
};
const assetPattern = /\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i;
const localAsset = (raw, base) => {
  if (!raw || /^(?:data:|mailto:|tel:|javascript:|#)/i.test(raw) || raw.startsWith('//')) return null;
  const url = new URL(raw.replace(/&amp;/g, '&'), base);
  if (url.origin !== SITE.origin || !assetPattern.test(url.pathname)) return null;
  return decodeURIComponent(url.pathname);
};
const assetFile = (pathname) => join(PUBLIC, pathname.replace(/^\//, ''));
const htmlFiles = existsSync(PUBLIC) ? walk(PUBLIC).filter((path) => path.endsWith('.html')) : [];

test('Redefine shell, routes, search, attribution, and dark mode are generated', () => {
  const home = routeHtml('/');
  assert.match(home, /home-banner-container/);
  assert.match(home, /tool-dark-light-toggle/);
  assert.match(home, /Fu1sh(?:&#39;|')s BLOG/);
  assert.match(home, /github\.com\/EvanNotFound\/hexo-theme-redefine/);
  assert.match(home, /Redefine v2\.9\.0/);
  for (const route of JSON.parse(read(join(ROOT, 'tests/fixtures/legacy-routes.json')))) {
    assert.ok(existsSync(routeFile(route)), `missing legacy route ${route}`);
  }
  assert.ok(existsSync(join(PUBLIC, 'search.xml')) || existsSync(join(PUBLIC, 'search.json')));
});

test('AI article routes, rendered titles, dates, and taxonomy are correct', () => {
  const posts = [
    ['/2026/03/11/RAG学习笔记/', 'RAG学习笔记', '2026-03-11', ['RAG', '大模型', '知识库']],
    ['/2026/03/15/NLP学习笔记/', 'NLP学习笔记', '2026-03-15', ['NLP', '大模型']],
  ];
  for (const [route, title, date, tags] of posts) {
    const html = routeHtml(route);
    const titlePattern = new RegExp(`<h1[^>]*class="[^"]*article-title-(?:cover|regular)[^"]*"[^>]*>\\s*${title}\\s*</h1>`, 'g');
    assert.equal(html.match(titlePattern)?.length, 1, `expected one rendered title for ${title}`);
    assert.match(html, new RegExp(`<span class="(?:desktop|mobile)">${date}(?:\\s+\\d{2}:\\d{2})?</span>`));
    assert.match(routeHtml('/categories/AI学习/'), new RegExp(title));
    for (const tag of tags) assert.match(routeHtml(`/tags/${tag}/`), new RegExp(title));
  }
  assert.ok(!existsSync(routeFile('/2026/08/09/RAG学习笔记/')));
  assert.ok(!existsSync(routeFile('/2026/08/09/NLP学习笔记/')));
  const rag = routeHtml('/2026/03/11/RAG学习笔记/');
  assert.match(rag, /build_prompt/);
  assert.match(rag, /\/images\/rag-architecture\.svg/);
  assert.match(rag, /class="[^"]*\bhighlight\b[^"]*\bpython\b[^"]*"/);
});

test('every generated HTML local asset exists, including lazy and srcset references', () => {
  assert.ok(htmlFiles.length > 0);
  for (const htmlFile of htmlFiles) {
    const html = read(htmlFile);
    const refs = [...html.matchAll(/\b(?:src|href|data-src|data-original)=["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
      refs.push(...match[1].split(',').map((candidate) => candidate.trim().split(/\s+/)[0]));
    }
    for (const ref of refs) {
      const pathname = localAsset(ref, pageUrl(htmlFile));
      if (pathname) assert.ok(existsSync(assetFile(pathname)), `${relative(PUBLIC, htmlFile)} -> ${ref}`);
    }
  }
});

test('every generated CSS local asset exists relative to its stylesheet', () => {
  const cssFiles = walk(PUBLIC).filter((path) => path.endsWith('.css'));
  assert.ok(cssFiles.length > 0);
  for (const cssFile of cssFiles) {
    const cssRoute = relative(PUBLIC, cssFile).split(sep).join('/');
    for (const match of read(cssFile).matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      const pathname = localAsset(match[1], new URL(cssRoute, SITE));
      if (pathname) assert.ok(existsSync(assetFile(pathname)), `${cssRoute} -> ${match[1]}`);
    }
  }
  const style = read(join(PUBLIC, 'css/style.css'));
  assert.match(style, /\.highlight|\.hljs/);
});
```
- [ ] Run `node --test tests/theme-config.test.mjs tests/generated-site.test.mjs`. Expected RED: assertions fail because Redefine dependencies/config/markup are absent. Syntax, fixture, or module errors do not count.
- [ ] Stage only tests, fixture, and YAML parser dependency, then commit:

```bash
git add package.json package-lock.json tests/theme-config.test.mjs tests/generated-site.test.mjs tests/fixtures/legacy-routes.json
git commit -m "test: define Redefine migration contracts"
```

## Task 3: Install and Configure Redefine

- [ ] Install exact runtime dependencies and remove the conflicting global lazy loader:

```bash
npm uninstall hexo-lazyload-image
npm install --save-exact hexo-theme-redefine@2.9.0 hexo-generator-searchdb@1.5.0 hexo-wordcount@6.0.1
```

- [ ] Add `"test": "node --test tests/*.test.mjs"` and `"verify": "npm run clean && npm run build && npm test"`. Change only the root theme line to `theme: redefine`.
- [ ] Copy the avatar. Create a site-owned `favicon.svg` with a square dark background and a centered white `F`; no Redefine branding.
- [ ] Generate a site-owned, text-free wide bitmap banner: clean editorial technology still life, white/charcoal/muted red/restrained blue, visible paper and computer-work textures, no logo, fake UI text, gradient blobs, or copied demo imagery. Convert to `source/images/home-banner.webp`.
- [ ] Create minimal `_config.redefine.yml`:

```yaml
info: { title: "Fu1sh's BLOG", subtitle: 最困难的时刻，也许就是拐点的开始, author: fu1sh, url: https://payfish.github.io }
defaults: { favicon: /images/favicon.svg, avatar: /images/avatar.png }
colors: { default_mode: light }
global:
  website_counter: { enable: false, site_pv: false, site_uv: false, post_pv: false }
  open_graph: { enable: true, image: /images/home-banner.webp, description: Fu1sh的个人博客，记录技术、项目与生活。 }
home_banner:
  enable: true
  style: fixed
  image: { light: /images/home-banner.webp, dark: /images/home-banner.webp }
  title: "Fu1sh's BLOG"
  subtitle:
    text: [最困难的时刻，也许就是拐点的开始]
    hitokoto: { enable: false }
navbar:
  links:
    Home: { path: /, icon: fa-regular fa-house }
    Archives: { path: /archives/, icon: fa-regular fa-archive }
    Categories: { path: /categories/, icon: fa-regular fa-folder }
    Tags: { path: /tags/, icon: fa-regular fa-tags }
    About: { path: /about/, icon: fa-regular fa-user }
  search: { enable: true, preload: true }
home:
  sidebar:
    enable: true
    position: left
    first_item: menu
    show_on_mobile: true
    links:
      Archives: { path: /archives/, icon: fa-regular fa-archive }
      Categories: { path: /categories/, icon: fa-regular fa-folder }
      Tags: { path: /tags/, icon: fa-regular fa-tags }
  article_date_format: YYYY-MM-DD
articles:
  word_count: { enable: true, count: true, min2read: true }
  code_block: { copy: true, style: mac, highlight_theme: { light: github, dark: vs2015 } }
  copyright: { enable: false }
  lazyload: true
comment: { enable: false }
footer: { runtime: false, statistics: false }
```

- [ ] Run theme tests. Expected GREEN. Run `npm run clean && npm run build`, then generated tests. Expected GREEN.
- [ ] Inspect generated RAG image markup: Redefine is the only lazy-loader and there are no duplicate/nested placeholder attributes.
- [ ] Stage and commit:

```bash
git add package.json package-lock.json _config.yml _config.redefine.yml source/images/avatar.png source/images/favicon.svg source/images/home-banner.webp
git commit -m "feat: migrate blog to Redefine theme"
```

## Task 4: Automated and Browser Verification

- [ ] Run `npm test`, `git diff --check`, and `git status --short --branch`. Any behavioral fix starts with a failing regression test.
- [ ] Start a managed preview with executable lifecycle commands:

```bash
# Run this as one managed PTY exec session. The direct Hexo binary avoids an npm child process.
zsh -c '
set -euo pipefail
PORT=4001
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
cleanup() { [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
./node_modules/.bin/hexo server --port "$PORT" >/tmp/payfish-hexo-preview.log 2>&1 &
SERVER_PID=$!
printf "PORT=%s\nSERVER_PID=%s\n" "$PORT" "$SERVER_PID" >/tmp/payfish-hexo-preview.env
for attempt in {1..30}; do curl -fsS "http://127.0.0.1:$PORT/" >/dev/null && break; sleep 1; done
curl -fsS "http://127.0.0.1:$PORT/" >/dev/null
wait "$SERVER_PID"
'
```

- [ ] Use the in-app browser control skill. At `1440x900` and `390x844`, capture screenshots of `/`, both March articles, `/categories/`, `/tags/`, `/archives/`, and `/about/`.
- [ ] For every page evaluate `scrollWidth <= clientWidth`, non-empty main content, and no intersecting nav/content rectangles. On article pages scroll to bottom, wait for lazy loading, and assert visible images are complete with non-zero `naturalWidth`; verify the architecture SVG itself is visible.
- [ ] Collect browser console errors and failed requests during navigation. Expected: no local asset or Redefine runtime failures.
- [ ] Stop by sending Ctrl-C to the managed PTY session. The `EXIT/INT/TERM` trap kills the direct Hexo PID; run `source /tmp/payfish-hexo-preview.env` and verify `lsof -nP -iTCP:"$PORT" -sTCP:LISTEN` returns no listener.

## Task 5: Final Review and Reproducibility

- [ ] Run `npm ci && npm run verify`.
- [ ] Run `git diff --check && test -z "$(git status --porcelain)"`.
- [ ] Dispatch final code review for `6c52962..HEAD`; fix every Critical/Important issue and repeat verification.

## Task 6: Integrate, Verify, Then Publish

- [ ] Record concrete rollback state and commit range:

```bash
git ls-remote origin refs/heads/source refs/heads/master | tee /tmp/payfish-predeploy-shas.txt
PRE_SOURCE_SHA=$(awk '$2=="refs/heads/source"{print $1}' /tmp/payfish-predeploy-shas.txt)
PRE_MASTER_SHA=$(awk '$2=="refs/heads/master"{print $1}' /tmp/payfish-predeploy-shas.txt)
THEME_BASE_SHA=$(git rev-list --max-count=1 --grep='^fix: repair AI post metadata and images$' feature/redefine-theme)
test -n "$THEME_BASE_SHA"
printf 'PRE_SOURCE_SHA=%s\nPRE_MASTER_SHA=%s\nTHEME_BASE_SHA=%s\n' "$PRE_SOURCE_SHA" "$PRE_MASTER_SHA" "$THEME_BASE_SHA" >/tmp/payfish-rollback.env
git fetch origin source master
```

- [ ] In the primary checkout, require a clean state, fast-forward, and verify before pushing:

```bash
test -z "$(git status --porcelain)"
git checkout source
git merge --ff-only feature/redefine-theme
npm ci
npm run verify
git push origin source
```

- [ ] Run `npm run deploy`. Confirm remote `source` equals local `HEAD`, remote `master` changed from `$PRE_MASTER_SHA`, and record the new SHAs.
- [ ] Poll `https://payfish.github.io/` until it contains the site title, `home-banner`, and official Redefine link. Require HTTP 200 for both March article URLs and `/images/rag-architecture.svg`.
- [ ] Leave a local preview server running from the integrated checkout and report its URL.

## Executable Rollback

Use only if live verification fails and cannot be corrected immediately:

```bash
set -euo pipefail
source /tmp/payfish-rollback.env
git checkout source
test "$(git merge-base "$THEME_BASE_SHA" HEAD)" = "$THEME_BASE_SHA"
for commit in $(git rev-list HEAD "^$THEME_BASE_SHA"); do git revert --no-edit "$commit"; done
npm ci
npm run clean
npm run build
test -f public/index.html
test -f 'public/2026/03/11/RAG学习笔记/index.html'
test -f 'public/2026/03/15/NLP学习笔记/index.html'
git push origin source
npm run deploy
for attempt in {1..30}; do
  HOME_HTML=$(curl -fsS https://payfish.github.io/ || true)
  if grep -q 'id="fluid-configs"' <<<"$HOME_HTML" && ! grep -q 'home-banner-container' <<<"$HOME_HTML"; then break; fi
  sleep 10
done
grep -q 'id="fluid-configs"' <<<"$HOME_HTML"
! grep -q 'home-banner-container' <<<"$HOME_HTML"
curl -fsS --output /dev/null 'https://payfish.github.io/2026/03/11/RAG%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0/'
curl -fsS --output /dev/null 'https://payfish.github.io/2026/03/15/NLP%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0/'
```

This preserves the approved article repair commit, reverts only later migration/test commits, validates the reverted Fluid build before pushing, and does not assume the reverted tree has the new `verify` script. Never force-push `source` or `master`.
