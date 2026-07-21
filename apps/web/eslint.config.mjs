import base from '@byrdos/config/eslint/base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['next-env.d.ts'],
  },
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
  },
];
