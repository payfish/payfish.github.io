const { rmSync } = require('node:fs');
const { resolve } = require('node:path');

const DEMO_THEME_ASSETS = [
  'redefine-avatar.svg',
  'redefine-favicon.svg',
  'redefine-logo.svg',
  'redefine-logo.webp',
  'redefine-og.webp',
  'wallhaven-wqery6-dark.webp',
  'wallhaven-wqery6-light.webp',
];

hexo.extend.filter.register('before_generate', () => {
  const socialLinks = hexo.theme.config.home_banner?.social_links;

  // Hexo's deep merge retains theme defaults when the site override is an empty array.
  if (socialLinks?.enable === false) {
    socialLinks.links = [];
    socialLinks.qrs = [];
  }

  // Redefine 2.9.0 lowercases canonical paths, which breaks case-sensitive routes.
  hexo.extend.helper.register('autoCanonical', (config, page) => {
    const baseUrl = config.url.endsWith('/') ? config.url : `${config.url}/`;
    const canonicalPath = String(page.canonical_path ?? '')
      .replace(/index\.html$/, '')
      .replace(/^\/+/, '');

    return `<link rel="canonical" href="${baseUrl}${canonicalPath}"/>`;
  });
});

hexo.extend.filter.register('after_generate', () => {
  for (const asset of DEMO_THEME_ASSETS) {
    const route = `images/${asset}`;

    hexo.route.remove(route);
    rmSync(resolve(hexo.public_dir, route), { force: true });
  }
});
