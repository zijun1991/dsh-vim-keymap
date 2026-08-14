// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // dev-harness is dev-only manual-verification tooling (see dev-harness/README.md), excluded from lint.
  { ignores: ['lib/**', 'dev-harness/**'] },
  js.configs.recommended,
  // Syntactic rules only (no parserOptions.project): config files (this one,
  // tsdown.config.ts, vitest.config.ts) and tests/ sit outside
  // tsconfig.json's `include: ["src"]`, and a type-aware ruleset needs every
  // linted file inside one project — not worth a second tsconfig for a
  // repo this size.
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
