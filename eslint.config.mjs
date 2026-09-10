// Fast lint tier. Everything here runs without type information, which is
// what keeps it quick enough for a pre-commit hook. The rules that need the
// type checker live in eslint.typed.config.mjs and run on their own script.
//\  
// Adapt before use:
// - the paths in the import-x zones and in quality/no-direct-data-access
// - the framework blocks, commented out below
// - the globalIgnores list
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      // js.configs.recommended turns on no-undef, which knows nothing about
      // the runtime this project targets -- without this, every console or
      // process reference is reported as an undefined variable. Declare what
      // the code actually uses. When the list outgrows a handful, install the
      // `globals` package and spread globals.node or globals.browser instead.
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
  ...tseslint.configs.strict,

  // Framework presets. Uncomment only what this project actually uses, and
  // add the matching import at the top of the file. Turning on a preset
  // wholesale is the opposite of what the rest of this config does -- prefer
  // a curated subset per plugin, added as its own files-scoped block below.
  //
  // nextPlugin.configs["core-web-vitals"],
  // reactPlugin.configs.flat["jsx-runtime"],
  // reactHooks.configs.flat.recommended,

  {
    // import-x resolves TypeScript path aliases so no-unresolved is accurate.
    // The two no-restricted-paths entries are the architecture boundary: the
    // first plugin key carries what must never regress, the second carries
    // the debt that already exists.
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "import-x/no-unresolved": "error",
      "import-x/no-duplicates": "error",
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            // Boundary: presentation-ish module files (controllers, plugins)
            // must NOT reach the DB client directly; services may (they are
            // the data-access owner by design — see agent.md module layout).
            // This zone is deliberately narrower than all of modules/** so
            // the service layer (the intended DB consumer) is allowed.
            {
              target: [
                "apps/server/src/modules/*/!(*.service).ts",
                "apps/server/src/modules/*/!(*.service).tsx"
              ],
              from: "apps/server/src/infra/db.ts",
            },
          ],
        },
      ],
    },
  },

  // Quality rules
  {
    plugins: { quality },
    rules: {
      "quality/max-lines": [
        "error",
        {
          max: 350,
          // ignore: [], // we can add specific files to ignore if needed
          includeTests: false,
        },
      ],
      "quality/no-direct-console": [
        "error",
        {
          allow: [], // we allow no console methods by default
          logger: "the project logging helper",
        },
      ],
      "quality/no-direct-data-access": [
        "error",
        {
          modules: ["apps/server/src/infra/db.ts"],
          bindings: ["db"],
          layers: ["apps/server/src/modules/**/*"],
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
    },
  },
  // We'll also add a globalIgnores for our build output directories
  // and other directories we want to ignore globally.
  // We'll use the globalIgnores from eslint/config to add these.
  // We'll add them as a separate config object that only sets globalIgnores.
  // But note: defineConfig does not allow multiple top-level objects? Actually, it does.
  // We'll add another object at the end that only sets globalIgnores.
  // However, we can also set globalIgnores in the first object? The example does not.
  // We'll follow the example and add a separate config object for globalIgnores.
  // We'll do it after the quality rules.
  {
    // Ignore build output directories, coverage, third-party/vendored code,
    // and the RPG Maker MV engine + plugin files (they are not authored here).
    ignores: [
      "**/dist/**",
      "**/build/**",
      "coverage/",
      "node_modules/",
      ".next/",
      "generated/",
      "__generated__/",
      "migrations/",
      "migration/",
      "locales/",
      "__tests__/",
      "__mocks__/",
      "fixtures/",
      "mocks/",
      "*.csv",
      // RPG Maker MV engine and plugin sources (vendored, not ours)
      "js/libs/**",
      "js/rmmz_*.js",
      "js/plugins/**",
      "js/main.js",
      "js/plugins.js",
    ],
  },
]);