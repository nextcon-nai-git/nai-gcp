export type AsoWorkspaceView = "agendamento" | "clinica";
export type AsoSearchParams = Record<string, string | string[] | undefined>;

export function asoWorkspaceView(params: AsoSearchParams): AsoWorkspaceView {
  return params.tab === "agendamento" ? "agendamento" : "clinica";
}

/** Keep existing deep-link parameters when switching areas or opening a legacy URL. */
export function asoWorkspaceHref(view: AsoWorkspaceView, params: AsoSearchParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  query.set("tab", view);
  return `/health-control?${query.toString()}`;
}
