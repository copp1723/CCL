module.exports = [
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      ecmaVersion: 2020,
      sourceType: 'module'
    },
    plugins: { '@typescript-eslint': require('@typescript-eslint/eslint-plugin') },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
