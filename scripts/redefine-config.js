hexo.extend.filter.register('before_generate', () => {
  const socialLinks = hexo.theme.config.home_banner?.social_links;

  // Hexo's deep merge retains theme defaults when the site override is an empty array.
  if (socialLinks?.enable === false) {
    socialLinks.links = [];
    socialLinks.qrs = [];
  }
});
