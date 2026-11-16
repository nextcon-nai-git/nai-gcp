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

/** Storage downloads can lack a MIME header. Only known byte signatures are previewed inline. */
export function employeeAttachmentMime(header: Uint8Array) {
  const starts = (signature: number[]) => signature.every((byte, index) => header[index] === byte);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  return "application/octet-stream";
}
