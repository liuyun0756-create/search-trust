import { expect, it } from "vitest";
import config from "../next.config";
function apply(ignored: string | string[] | RegExp) {
  const input = {
    watchOptions: { ignored, aggregateTimeout: 25 },
    module: { rules: [] },
  };
  return config.webpack!(input, {} as never).watchOptions;
}
it("retains webpack default exclusions while ignoring all generated test output", () => {
  const result = apply(["**/node_modules/**", "**/.next/**"]);
  expect(result.ignored).toEqual([
    "**/node_modules/**",
    "**/.next/**",
    "**/output/**",
  ]);
  expect(result.aggregateTimeout).toBe(25);
});
it("preserves a regular-expression exclusion and its flags", () => {
  const result = apply(/(?:node_modules|\.next)/i);
  expect(result.ignored).toBeInstanceOf(RegExp);
  expect(result.ignored.test("/project/.next/dev/chunk.js")).toBe(true);
  expect(result.ignored.test("/project/NODE_MODULES/lib.js")).toBe(true);
  expect(result.ignored.test("/project/output/playwright/trace.zip")).toBe(
    true,
  );
  expect(result.ignored.test("/project/output/preflight/trace.zip")).toBe(true);
  expect(result.ignored.test("/project/src/app/page.tsx")).toBe(false);
});
