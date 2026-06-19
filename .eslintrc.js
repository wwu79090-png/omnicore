module.exports = {
  extends: ['airbnb-base'],
  env: {
    browser: true,
    es2024: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'class-methods-use-this': 'off',
    'comma-dangle': 'off',
    'implicit-arrow-linebreak': 'off',
    'import/extensions': ['error', 'ignorePackages', { js: 'always', mjs: 'always' }],
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'max-len': 'off',
    'max-classes-per-file': 'off',
    'no-confusing-arrow': 'off',
    'no-console': 'off',
    'no-continue': 'off',
    'no-await-in-loop': 'off',
    'no-nested-ternary': 'off',
    'no-param-reassign': 'off',
    'no-promise-executor-return': 'off',
    'no-restricted-syntax': 'off',
    'no-underscore-dangle': 'off',
    'no-use-before-define': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': ['error', { ignore: ['^three/addons/'] }],
    'object-curly-newline': 'off'
  }
};
