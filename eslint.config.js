import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // --------------------------------------------------------------------------
  // Unidirectional Architecture Guardrails (src/ layer isolation)
  // --------------------------------------------------------------------------
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'Forbidden: src/domain must have zero dependencies on React.',
            },
            {
              name: 'react-dom',
              message: 'Forbidden: src/domain must have zero dependencies on React DOM.',
            },
          ],
          patterns: [
            {
              group: [
                '**/fields/**',
                '**/features/**',
                '**/shared/ui/**',
                '../fields/**',
                '../../fields/**',
                '../features/**',
                '../../features/**',
                '../shared/ui/**',
                '../../shared/ui/**',
              ],
              message: 'Forbidden: src/domain cannot import from fields, features, or shared/ui.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/domain/**',
                '**/fields/**',
                '**/features/**',
                '../domain/**',
                '../../domain/**',
                '../fields/**',
                '../../fields/**',
                '../features/**',
                '../../features/**',
              ],
              message: 'Forbidden: src/shared primitives must not depend on domain, fields, or features.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/fields/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/features/**',
                '../features/**',
                '../../features/**',
              ],
              message: 'Forbidden: src/fields plugins must not depend on src/features.',
            },
          ],
        },
      ],
    },
  },
])
