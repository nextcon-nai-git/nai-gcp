// Navigation fallback only. Never cache authenticated pages, photographs or API responses.
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    !["/field-inspection", "/field-inspection/"].includes(url.pathname)
  )
    return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vistoria sem conexão</title><main><h1>Vistoria sem conexão</h1><p>Para reabrir um rascunho salvo neste dispositivo, reconecte-se e acesse a mesma conta e empresa.</p><a href="/field-inspection">Tentar novamente</a></main></html>',
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'",
            },
          }
        )
    )
  );
});
