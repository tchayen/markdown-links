import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "out/**", "node_modules/**", "**/*.min.js"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ...tseslint.configs.recommended[0],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "none",
          vars: "all",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["static/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        acquireVsCodeApi: "readonly",
        d3: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["webpack.config.js", "*.config.js", ".vscode/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["examples/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
  },
];
