export function normalizeNavigationSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** The most specific route owns the highlight, including its nested detail pages. */
export function getActiveNavigationHref(pathname: string, hrefs: string[]): string | null {
  return (
    hrefs
      .filter((href) => pathname === href || (href !== "/" && pathname.startsWith(href + "/")))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}
