import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import autoImportGlobals from './frontend/.eslintrc-auto-import.json' with { type: 'json' }

export default tseslint.config(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      'backend/data',
      'frontend/src/auto-imports.d.ts',
      'frontend/src/components.d.ts',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],
  {
    rules: {
      // Short, purpose-named single-word components (Tabs, FilterBar-adjacent
      // helpers) are fine here -- none collide with native HTML tags.
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: ['backend/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['frontend/src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...autoImportGlobals.globals,
      },
    },
  },
  {
    files: ['frontend/src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  eslintConfigPrettier,
)
