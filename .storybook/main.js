module.exports = {
  stories: ['../src/**/*.stories.[tj]s', '../src/**/*.stories.[tj]sx'],
  framework: '@storybook/react',
  core: {
    builder: 'webpack5',
  },
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    'storybook-addon-designs',
  ],
};
