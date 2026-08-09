import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { load } from 'js-yaml';

const root = new URL('../', import.meta.url);
const file = (path) => new URL(path, root);
const read = (path) => readFileSync(file(path), 'utf8');
const readJson = (path) => JSON.parse(read(path));
const readYaml = (path) => load(read(path));
const isMapping = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

function merge(base, override) {
  const result = isMapping(base) ? structuredClone(base) : {};
  if (!isMapping(override)) {
    return override === undefined ? result : structuredClone(override);
  }

  for (const [key, value] of Object.entries(override)) {
    result[key] = isMapping(value)
      ? merge(result[key], value)
      : structuredClone(value);
  }

  return result;
}

const pkg = readJson('package.json');
const themeConfigPath = 'node_modules/hexo-theme-redefine/_config.yml';
const siteConfigPath = '_config.redefine.yml';
const themeDefaults = existsSync(file(themeConfigPath))
  ? (readYaml(themeConfigPath) ?? {})
  : {};
const siteOverrides = existsSync(file(siteConfigPath))
  ? (readYaml(siteConfigPath) ?? {})
  : {};
const theme = merge(themeDefaults, siteOverrides);

test('dependencies and scripts define one Redefine pipeline', () => {
  assert.equal(pkg.dependencies?.['hexo-theme-redefine'], '2.9.0');
  assert.equal(pkg.dependencies?.['hexo-generator-searchdb'], '1.5.0');
  assert.equal(pkg.dependencies?.['hexo-wordcount'], '6.0.1');
  assert.equal(pkg.devDependencies?.['hexo-front-matter'], '4.2.1');
  assert.equal(pkg.devDependencies?.['js-yaml'], '4.1.0');
  assert.equal(pkg.dependencies?.['hexo-lazyload-image'], undefined);
  assert.equal(pkg.scripts?.test, 'node --test tests/*.test.mjs');
  assert.equal(pkg.scripts?.verify, 'npm run clean && npm run build && npm test');
});

test('root Hexo contract is preserved while Redefine becomes active', () => {
  const config = readYaml('_config.yml');

  assert.equal(config?.theme, 'redefine');
  assert.equal(config?.url, 'https://payfish.github.io/');
  assert.equal(config?.permalink, ':year/:month/:day/:title/');
  assert.equal(config?.deploy?.type, 'git');
  assert.equal(config?.deploy?.branch, 'master');
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
  assert.equal(theme.footer?.start, '2024/04/03 00:00:00');
  assert.equal(theme.footer?.icon, '<i class="fa-solid fa-code"></i>');
  assert.equal(theme.colors?.default_mode, 'light');
  assert.equal(theme.articles?.code_block?.highlight_theme?.light, 'github');
  assert.equal(theme.articles?.code_block?.highlight_theme?.dark, 'vs2015');
  assert.doesNotMatch(
    JSON.stringify(siteOverrides),
    /wallhaven|Theme Redefine|redefine\.ohevan\.com/i,
  );
  assert.doesNotMatch(
    JSON.stringify(theme),
    /wallhaven|custom-icon|you@example\.com/i,
  );
});

test('installed theme retains its GPL license declaration', () => {
  const packagePath = 'node_modules/hexo-theme-redefine/package.json';
  const licensePath = 'node_modules/hexo-theme-redefine/LICENSE';

  assert.ok(existsSync(file(packagePath)), 'missing installed Redefine package metadata');
  const themePkg = readJson(packagePath);
  assert.equal(themePkg.license, 'GPL-3.0');
  assert.ok(existsSync(file(licensePath)), 'missing installed Redefine LICENSE file');
  assert.match(read(licensePath), /GNU GENERAL PUBLIC LICENSE/);
});
