export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'revert']
    ],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100]
  }
};
