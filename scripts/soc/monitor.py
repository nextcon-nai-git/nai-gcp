"""Read-only SOC batch driver. Never print response bodies, people or secrets."""
import json
import os
import sys
import time
import urllib.error
import urllib.request

URL = "https://nai--studio-8439299034-125c7.us-central1.hosted.app/api/integrations/soc/monitor"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    secret = os.environ.get("SOC_MONITOR_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("SOC_MONITOR_SECRET ausente ou curto.")
    opener = urllib.request.build_opener(NoRedirect)
    deadline = time.monotonic() + 17000
    calls = 0

    def call(payload):
        nonlocal calls
        calls += 1
        if calls > 10000 or time.monotonic() > deadline:
            raise RuntimeError("Limite de execução atingido; cobertura parcial.")
        request = urllib.request.Request(URL, data=json.dumps(payload).encode(), method="POST", headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"})
        try:
            with opener.open(request, timeout=165) as response:
                content = response.read(1024 * 1024 + 1)
                if len(content) > 1024 * 1024:
                    raise RuntimeError("Resposta excessiva; cobertura não confirmada.")
                return json.loads(content)
        except urllib.error.HTTPError as error:
            raise RuntimeError(f"Consulta não concluída (HTTP {error.code}); confira o NAI.") from None
        except (urllib.error.URLError, TimeoutError, ValueError):
            raise RuntimeError("Falha de transporte ou resposta; cobertura não confirmada.") from None

    plan = call({"action": "plan"})
    failed = len(plan["missingAuthorizedCompanies"]) + len(plan["unknownActivityCompanies"])
    completed = 0
    for company in plan["companyIds"]:
        offset, roster_hash, total = 0, None, 0
        try:
            while True:
                payload = {"action": "batch", "companyId": company, "start": plan["start"], "end": plan["end"], "offset": offset}
                if roster_hash:
                    payload["rosterHash"] = roster_hash
                batch = call(payload)
                total += batch["issuedAsosInBatch"]
                roster_hash = batch["rosterHash"]
                next_offset = batch["nextOffset"]
                if next_offset is None:
                    completed += 1
                    print(f"Empresa SOC {company}: {total} ASOs emitidos no período consultado.")
                    break
                if not isinstance(next_offset, int) or next_offset <= offset:
                    raise RuntimeError("Continuação inválida; cobertura parcial.")
                offset = next_offset
        except RuntimeError as error:
            failed += 1
            print(f"Empresa SOC {company}: {error}")
    print(f"Empresas concluídas: {completed}/{len(plan['companyIds'])}; falhas/lacunas: {failed}.")
    print("Escopo: ASOs emitidos nos últimos 31 dias. Vencimentos e paralisações não comprovados por este relatório.")
    return 1 if failed else 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as error:
        print(error)
        sys.exit(1)
