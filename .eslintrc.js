module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  env: {
    node: true,
    es2022: true
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
  overrides: [
    {
      files: ['*.ts'],
      parserOptions: {
        project: ['./tsconfig.base.json']
      }
    }
  ]
};