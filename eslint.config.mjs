import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "import-x/no-unresolved": "error",
      "import-x/no-duplicates": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: [
                "server/src/modules/*/!(*.service).ts",
                "server/src/modules/*/!(*.service).tsx"
              ],
              from: "server/src/infra/prisma.ts",
            },
          ],
        },
      ],
    },
  },

  {
    plugins: { quality },
    rules: {
      "quality/max-lines": [
        "error",
        {
          max: 350,
          includeTests: false,
        },
      ],
      "quality/no-direct-console": [
        "warn",
        {
          allow: [],
          logger: "the project logging helper",
        },
      ],
      "quality/no-direct-data-access": [
        "warn",
        {
          modules: ["server/src/infra/prisma.ts"],
          bindings: ["prisma"],
          layers: ["server/src/modules/**/*"],
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
    },
  },

  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/generated/**",
      "**/__generated__/**",
      "**/migrations/**",
      "**/migration/**",
      "**/locales/**",
      "**/__tests__/**",
      "**/__mocks__/**",
      "**/fixtures/**",
      "**/mocks/**",
      "*.csv",
      "js/libs/**",
      "js/rmmz_*.js",
      "js/plugins/**",
      "js/main.js",
      "js/plugins.js",
    ],
  },
]);
