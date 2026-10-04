// Runs SonarSource's own SonarJS rule set (the analyzer SonarQube uses for
// JS/TS) without needing a SonarQube server. Run with: npx eslint -c eslint.sonar.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/lib/api-client-react/src/generated/**",
      "**/lib/api-zod/**",
      "**/artifacts/mockup-sandbox/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { sonarjs },
    languageOptions: {
      parserOptions: {
        // Every project the `lint` script covers must be listed here. A file
        // outside all of them has no type information, which typescript-eslint
        // reports as a parsing error — but only when --fix is passed, because
        // the fix pass opens the project service differently. That made
        // `npm run lint` pass while `npm run lint:fix` failed on lib/db/src.
        project: [
          "./artifacts/api-server/tsconfig.json",
          "./artifacts/quantstock/tsconfig.json",
          "./lib/db/tsconfig.json",
          "./lib/api-client-react/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...sonarjs.configs.recommended.rules,
      // Generated files and this config file are not hand-written product code.
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/cognitive-complexity": "off",
      // Applying this in statistics.ts would change behaviour: the guards use
      // `!(x > 0)` rather than `x <= 0` precisely because `NaN <= 0` is false,
      // so the suggested rewrite would let a NaN through as a real score. The
      // upstream feed does emit sentinel values.
      "sonarjs/no-inverted-boolean-check": "off",
    },
  },
  {
    // Entry points / config files have no project context.
    files: ["**/*.mjs", "**/*.config.*"],
    languageOptions: { parserOptions: { project: null } },
    rules: { "sonarjs/no-duplicate-string": "off" },
  },
];
