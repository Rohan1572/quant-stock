import js from "@eslint/js";
import html from "@html-eslint/eslint-plugin";
import globals from "globals";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.local/**",
      "**/.agents/memory/**",
      "**/lib/api-client-react/src/generated/**",
      "**/lib/api-zod/src/generated/**",
    ],
  },
  js.configs.recommended,
  sonarjs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...html.configs["flat/recommended"],
    files: ["**/*.html"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
];
