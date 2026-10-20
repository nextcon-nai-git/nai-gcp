import plugin from "tailwindcss/plugin";

/** Bridge older module utilities to the shared navy theme, including hover/focus and opacity.
 * Screen-only: printed documents keep their original paper colors.
 */
export const naiTheme = plugin(({ addUtilities }) => {
  // All generated names contain only letters, numbers, hyphens and opacity slashes.
  const e = (name: string) => name.replaceAll("/", "\\/");
  const rules: Record<string, Record<string, string>> = {};
  const add = (name: string, property: string, color: string) => {
    rules[`.dark .${e(name)}`] = { [property]: color };
  };
  const background = (name: string, token: string) => {
    add(`bg-${name}`, "background-color", `hsl(var(--${token}) / var(--tw-bg-opacity, 1))`);
    for (const opacity of [40, 50, 60, 70, 75, 80, 85, 90, 95]) {
      add(`bg-${name}/${opacity}`, "background-color", `hsl(var(--${token}) / ${opacity / 100})`);
    }
    for (const direction of ["from", "via", "to"]) {
      // Keep gradient stops consistent with the same surface colors.
      if (direction === "to")
        add(
          `to-${name}`,
          "--tw-gradient-to",
          `hsl(var(--${token})) var(--tw-gradient-to-position)`
        );
      if (direction === "from") {
        const selector = `.dark .${e(`from-${name}`)}`;
        rules[selector] = {
          "--tw-gradient-from": `hsl(var(--${token})) var(--tw-gradient-from-position)`,
          "--tw-gradient-to": `hsl(var(--${token}) / 0) var(--tw-gradient-to-position)`,
          "--tw-gradient-stops": "var(--tw-gradient-from), var(--tw-gradient-to)",
        };
      }
    }
  };
  background("white", "card");
  for (const family of ["slate", "gray", "zinc", "neutral", "stone"]) {
    for (const shade of [50, 100, 200, 300]) {
      background(`${family}-${shade}`, shade < 200 ? "muted" : "secondary");
      add(
        `border-${family}-${shade}`,
        "border-color",
        "hsl(var(--border) / var(--tw-border-opacity, 1))"
      );
      for (const opacity of [50, 60, 70, 80, 90])
        add(
          `border-${family}-${shade}/${opacity}`,
          "border-color",
          `hsl(var(--border) / ${opacity / 100})`
        );
    }
    for (const shade of [400, 500, 600, 700, 800, 900, 950]) {
      add(
        `text-${family}-${shade}`,
        "color",
        `hsl(var(--${shade >= 700 ? "foreground" : "muted-foreground"}) / var(--tw-text-opacity, 1))`
      );
    }
  }
  add("text-black", "color", "hsl(var(--foreground))");
  add("text-primary", "color", "hsl(211 96% 80%)");
  // Status colors retain meaning with a dark tinted surface and a readable foreground.
  for (const [family, hue] of Object.entries({
    red: 0,
    rose: 345,
    orange: 25,
    amber: 40,
    yellow: 48,
    green: 145,
    emerald: 160,
    teal: 175,
    cyan: 190,
    sky: 200,
    blue: 215,
    indigo: 240,
    violet: 265,
    purple: 275,
  })) {
    for (const shade of [50, 100]) {
      add(
        `bg-${family}-${shade}`,
        "background-color",
        `hsl(${hue} 38% 19% / var(--tw-bg-opacity, 1))`
      );
      for (const opacity of [30, 40, 50, 60, 70, 80, 90])
        add(
          `bg-${family}-${shade}/${opacity}`,
          "background-color",
          `hsl(${hue} 38% 19% / ${opacity / 100})`
        );
    }
    for (const shade of [600, 700, 800, 900, 950])
      add(`text-${family}-${shade}`, "color", `hsl(${hue} 90% 82% / var(--tw-text-opacity, 1))`);
  }
  addUtilities(
    Object.fromEntries(
      Object.entries(rules).map(([selector, declaration]) => [
        selector,
        { "@media screen": declaration },
      ])
    )
  );
});
