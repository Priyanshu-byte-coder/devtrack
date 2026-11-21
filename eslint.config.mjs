import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextCoreWebVitals,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/no-direct-set-state-in-use-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/use-memo": "off",
      "react-compiler/react-compiler": "off",
      // Links prefetch on viewport by default, and every prefetch is a billed
      // server render; use the wrapper, which turns that off.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                'Import Link from "@/components/Link" instead: it disables prefetching, which costs Active CPU.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/Link.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
