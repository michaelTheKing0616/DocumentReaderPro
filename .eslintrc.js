module.exports = {
  root: true,
  extends: ['expo'],
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'no-console': 'warn',
      },
    },
  ],
};
