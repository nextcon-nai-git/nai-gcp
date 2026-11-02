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
      '\n@source inline("bg-white bg-white/90 text-slate-900 bg-green-50 hover:bg-white w-(--sidebar-width) rounded-sm border-(--color-border) bg-linear-to-r from-white via-slate-100 to-slate-50");',
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
  it("keeps chart indicator borders tied to the series color variable", () => {
    const borders: string[] = [];
    for (const rule of rules(".border-\\(--color-border\\)"))
      rule.walkDecls("border-color", (decl) => {
        borders.push(decl.value);
      });
    expect(borders).toContain("var(--color-border)");
  });
  it("preserves valid gradient colors, direction and middle stops in the dark theme", () => {
    for (const [selector, direction, token] of [
      [".dark .from-white", "from", "card"],
      [".dark .via-slate-100", "via", "muted"],
      [".dark .to-slate-50", "to", "muted"],
    ]) {
      const generated = rules(selector);
      expect(generated.length).toBeGreaterThan(0);
      expect(generated.every(screenOnly)).toBe(true);
      const colors: string[] = [];
      generated.forEach((rule) =>
        rule.walkDecls(`--tw-gradient-${direction}`, (decl) => {
          colors.push(decl.value);
        })
      );
      // A color followed by a position is invalid for Tailwind 4's registered
      // <color> property and can make text-transparent headings disappear.
      expect(colors).toContain(`hsl(var(--${token}))`);
      expect(colors.every((value) => !value.includes("-position"))).toBe(true);
    }
    for (const selector of [".dark .from-white", ".dark .to-slate-50"]) {
      const stops: string[] = [];
      rules(selector).forEach((rule) =>
        rule.walkDecls("--tw-gradient-stops", (decl) => {
          stops.push(decl.value);
        })
      );
      expect(
        stops.some(
          (value) =>
            value.includes("--tw-gradient-position") && value.includes("--tw-gradient-via-stops")
        )
      ).toBe(true);
    }
    const middleStops: string[] = [];
    rules(".dark .via-slate-100").forEach((rule) =>
      rule.walkDecls("--tw-gradient-via-stops", (decl) => {
        middleStops.push(decl.value);
      })
    );
    expect(
      middleStops.some(
        (value) =>
          value.includes("--tw-gradient-position") && value.includes("--tw-gradient-via-position")
      )
    ).toBe(true);
  });
  it("includes the four AVP cost indicators from application source", () => {
    for (const [family, hue] of [
      ["green", 145],
      ["yellow", 48],
      ["red", 0],
      ["purple", 275],
    ]) {
      const backgrounds = rules(`.dark .bg-${family}-100`);
      expect(backgrounds.length).toBeGreaterThan(0);
      expect(backgrounds.some((rule) => rule.toString().includes(`hsl(${hue} 38% 19%`))).toBe(true);
    }
  });
});
