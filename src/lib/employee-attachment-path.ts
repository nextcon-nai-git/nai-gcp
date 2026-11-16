/** Legacy Firebase download links are resolved to an authenticated Storage path. */
export function employeeAttachmentPath(
  document: { storagePath?: string; url?: string },
  target: { companyId?: string; employeeId?: string; internal?: boolean },
  bucket: string
): string | undefined {
  let path = document.storagePath;
  if (!path && document.url) {
    try {
      const url = new URL(document.url);
      if (url.origin !== "https://firebasestorage.googleapis.com" || url.username || url.password)
        return;
      const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
      if (!match || decodeURIComponent(match[1]) !== bucket) return;
      path = decodeURIComponent(match[2]);
    } catch {
      return;
    }
  }
  if (!path) return;
  const segments = path.split("/");
  if (segments.some((s) => !s || s === "." || s === ".." || /[\\\u0000-\u001f]/.test(s))) return;
  if (target.internal) {
    const [root, folder, owner] = segments;
    if (
      segments.length === 4 &&
      root === "internos_nextcon" &&
      folder === "colaboradores" &&
      (owner === target.employeeId || /^draft_[a-f0-9-]{36}$/i.test(owner))
    )
      return path;
  } else if (
    segments.length === 5 &&
    segments[0] === "clientes" &&
    segments[1] === target.companyId &&
    segments[2] === "colaboradores" &&
    segments[3] === target.employeeId
  )
    return path;
}
