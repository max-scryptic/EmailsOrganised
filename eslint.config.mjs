import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * No em dash anywhere in the product. This catches it in strings, template
 * literals, and JSX text, which is everything a user can read. It cannot see
 * comments, Markdown, CSS, or SQL, so `scripts/check-em-dashes.mjs` covers the
 * repository as a whole and runs in the same `npm run lint`.
 */
const noEmDashes = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/[\\u2014\\u2015\\u2E3A\\u2E3B]/]",
        message:
          "No em dashes. Use a comma, a colon, a semicolon, parentheses, or two sentences.",
      },
      {
        selector: "TemplateElement[value.raw=/[\\u2014\\u2015\\u2E3A\\u2E3B]/]",
        message:
          "No em dashes. Use a comma, a colon, a semicolon, parentheses, or two sentences.",
      },
      {
        selector: "JSXText[value=/[\\u2014\\u2015\\u2E3A\\u2E3B]/]",
        message:
          "No em dashes. Use a comma, a colon, a semicolon, parentheses, or two sentences.",
      },
    ],
  },
};

/**
 * The checker has to spell out the characters it bans, so it is the one file
 * the ban cannot apply to. `ruleFiles` in that script exempts it and this file
 * from its own scan for the same reason.
 */
const emDashCheckerException = {
  files: ["scripts/check-em-dashes.mjs"],
  rules: { "no-restricted-syntax": "off" },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noEmDashes,
  emDashCheckerException,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party agent tooling (the Impeccable skill and its
    // detector). It is committed so the skill travels with the repo, but it is
    // not our source and does not follow our lint rules.
    ".claude/**",
  ]),
]);

export default eslintConfig;
