import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/coverage/**', '**/.turbo/**'],
  },
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        {
          type: 'base-package',
          pattern: 'packages/{domain,contracts,observability,ui}/src',
          partialMatch: false,
        },
        {
          type: 'package',
          pattern: 'packages/*/src',
          partialMatch: false,
          capture: ['package'],
        },
        {
          type: 'app',
          pattern: 'apps/*/src',
          partialMatch: false,
          capture: ['app'],
        },
        {
          type: 'service',
          pattern: 'services/*/src',
          partialMatch: false,
          capture: ['service'],
        },
      ],
      'import/resolver': {
        typescript: {
          project: './packages/*/tsconfig.json',
        },
      },
    },
    rules: {
      ...boundaries.configs.recommended.rules,
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'base-package' } },
              disallow: {
                to: {
                  module: {
                    origin: 'local',
                    source: ['apps/*', 'services/*'],
                  },
                },
              },
              message:
                'Base packages (domain, contracts, observability, ui) may not import from apps or services.',
            },
          ],
        },
      ],
    },
  },
];
