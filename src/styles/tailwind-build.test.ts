// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postcss, { type AtRule, type Document, type Root, type Rule } from "postcss";
import tailwind from "@tailwindcss/postcss";

let css: Root;
beforeAll(async () => {
  const from = resolve("src/app/globals.css");
  const source = await readFile(from, "utf8");
  const result = await postcss([tailwind()]).process(
    source +
      '\n@source inline("bg-white bg-white/90 text-slate-900 bg-green-50 hover:bg-white w-(--sidebar-width) rounded-sm");',
    { from }
  );
  expect(result.warnings()).toEqual([]);
  css = result.root;
}, 30000);

function rules(selector: string): Rule[] {
  const result: Rule[] = [];
  css.walkRules(selector, (rule) => {
    result.push(rule);
  });
  return result;
}
function screenOnly(rule: Rule) {
  for (
    let parent: AtRule | Rule | Root | Document | undefined = rule.parent;
    parent;
    parent = parent.parent
  )
    if (parent.type === "atrule" && parent.name === "media" && parent.params === "screen")
      return true;
  return false;
}

describe("compiled NAI theme after the Tailwind security upgrade", () => {
  it("keeps the dark surface and status overrides restricted to screen media", () => {
    for (const selector of [".dark .bg-white", ".dark .text-slate-900", ".dark .bg-green-50"]) {
      const generated = rules(selector);
      expect(generated.length).toBeGreaterThan(0);
      expect(generated.every(screenOnly)).toBe(true);
    }
    expect(rules(".dark .bg-white").some((rule) => rule.toString().includes("var(--card)"))).toBe(
      true
    );
  });
  it("preserves escaped opacity classes and hover states", () => {
    expect(rules(".dark .bg-white\\/90").some((rule) => rule.toString().includes("0.9"))).toBe(
      true
    );
    const hover: Rule[] = [];
    css.walkRules((rule) => {
      if (rule.selector.includes(".dark .hover\\:bg-white")) hover.push(rule);
    });
    expect(hover.length).toBeGreaterThan(0);
    expect(hover.every(screenOnly)).toBe(true);
  });
  it("compiles variable sidebar widths and the existing custom radius", () => {
    const widths: string[] = [],
      radii: string[] = [];
    css.walkDecls("width", (decl) => {
      widths.push(decl.value);
    });
    css.walkDecls("border-radius", (decl) => {
      radii.push(decl.value);
    });
    expect(widths).toContain("var(--sidebar-width)");
    expect(radii).toContain("calc(var(--radius) - 4px)");
  });
});
