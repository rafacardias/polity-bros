module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
    settings: {
    'import/resolver': {
      typescript: {
        project: ['game/tsconfig.json', 'web/tsconfig.json'],
      },
      node: true,
    },
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.vite/',
    '.vercel/',
    'coverage/',
    'assets-raw/',
    'supabase/.temp/',
    'supabase/.branches/',
  ],
    rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // TypeScript já valida imports/exports — evita falsos positivos com React
    'import/default': 'off',
    'import/no-named-as-default-member': 'off',
  },
  overrides: [
    // Front web (React)
    {
      files: ['web/src/**/*.{ts,tsx}'],
      plugins: ['react', 'react-hooks'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      parserOptions: { ecmaFeatures: { jsx: true } },
      settings: { react: { version: 'detect' } },
      rules: { 'react/react-in-jsx-scope': 'off' },
    },
    // Edge Functions (Deno) — specifiers (jsr:, npm:, import_map) não são
    // resolvíveis pelo resolver Node/TS do ESLint; deno check já garante os tipos.
    {
      files: ['supabase/functions/**/*.ts'],
      env: { browser: false, node: false, es2022: true },
      globals: { Deno: 'readonly' },
      rules: { 'no-console': 'off', 'import/no-unresolved': 'off' },
    },
  ],
};
