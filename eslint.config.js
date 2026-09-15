import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Industry vocabulary is allowed in templates and seed data — it is user-facing
 * content there, editable and deletable. Anywhere else it means a domain
 * assumption has leaked into the code, which breaks the promise that the app
 * can be reshaped for any kind of event.
 *
 * Matching is case-sensitive on purpose: user-facing labels are Title Case
 * ('Front Row'), while lowercase kebab literals ('runway', 'open-floor') are
 * structural geometry with no industry meaning.
 */
const INDUSTRY_LITERALS =
  '/^(Celebrity|Influencer|Front Row|A-list|Buyer|Runway|Model Order|Keynote Row|Donor|Major Gift)$/';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    // The domain-neutrality guardrail.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/data/templates.ts', 'src/data/seed/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${INDUSTRY_LITERALS}]`,
          message:
            'Industry vocabulary belongs in data/templates.ts or data/seed/ — the app code must stay domain-neutral (see docs/customization.md).',
        },
      ],
    },
  },
);
