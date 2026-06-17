import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

// Flat ESLint config. Tuned to be useful without blocking on the existing
// codebase: genuine mistakes (rules-of-hooks, unreachable code) are errors;
// stylistic / gradual-typing concerns (any, unused vars) are warnings so
// `eslint .` (and CI) stays green while still surfacing them.
export default tseslint.config(
  {
    ignores: [
      "build/**",
      ".react-router/**",
      "drizzle/**",
      "node_modules/**",
      "**/*.config.{js,ts}",
    ],
  },
  js.configs.recommended,
  // Node maintenance scripts (DB migrations/seeds) — plain ESM, node globals.
  {
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "detect" } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // `export function meta({}: Route.MetaArgs)` is a React Router idiom.
      "no-empty-pattern": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-expressions": [
        "warn",
        { allowShortCircuit: true, allowTernary: true },
      ],
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
);
