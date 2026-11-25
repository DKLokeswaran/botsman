// Code rules from the repo's decisions. docs/decisions/stack.md#code-rules explains them. Run with `pnpm lint`.
import typescript from "@typescript-eslint/parser";
import botsman from "./lint/eslint-plugin.js";

// TypeScript files under each folder.
const typescriptIn = (folders) => folders.map((folder) => `${folder}/**/*.{ts,tsx}`);

// Code that ships: everything but tests, scripts, and config files.
const SHIPPED = typescriptIn(["packages/*/src", "apps/*/src", "apps/android/app", "server/src"]);
// The client packages: shared screens, both apps, and the web dashboard.
const CLIENTS = typescriptIn(["packages/pc-ui/src", "apps/*/src", "apps/android/app"]);
// Screens and the components they are drawn with, on both apps.
const SCREENS = typescriptIn(["packages/pc-ui/src/screens", "packages/pc-ui/src/components", "apps/android/app", "apps/android/src/{screens,ui,chat}"]);

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "apps/android/android/**", "apps/windows/src-tauri/target/**", "mockups/**", "docs/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: typescript, parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    plugins: { botsman },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "botsman/no-font-host": "error",
    },
  },
  {
    files: SHIPPED,
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "botsman/no-one-line-wrapper": "warn",
    },
  },
  {
    files: CLIENTS,
    rules: {
      "botsman/no-raw-html": "error",
      "botsman/no-hex-colour": "error",
      "botsman/no-app-name-text": "error",
    },
  },
  {
    files: SCREENS,
    rules: {
      complexity: ["error", 8],
      "botsman/screen-complexity": ["warn", 6],
      "botsman/no-screen-io": "error",
      "botsman/no-screen-client-calls": "error",
      "botsman/no-screen-array-logic": "error",
    },
  },
  {
    files: typescriptIn(["server/src"]),
    ignores: ["server/src/config.ts"],
    rules: { "botsman/env-only-in-config": "error" },
  },
];
