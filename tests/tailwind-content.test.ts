import assert from "node:assert/strict";
import test from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import tailwindConfig from "../tailwind.config.ts";

const FEATURE_CONTENT_GLOB = "./features/**/*.{js,ts,jsx,tsx,mdx}";

test("production CSS scans feature modules", async () => {
  assert.ok(
    Array.isArray(tailwindConfig.content) && tailwindConfig.content.includes(FEATURE_CONTENT_GLOB),
    `Tailwind content must include ${FEATURE_CONTENT_GLOB}`,
  );

  const result = await postcss([tailwindcss(tailwindConfig)]).process("@tailwind utilities;", {
    from: undefined,
  });

  assert.match(
    result.css,
    /min-width:\s*5\.25rem/,
    "expected CSS for the feature-only radar timeline width utility",
  );
});
