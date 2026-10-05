import "server-only";
import { getAppCheck } from "firebase-admin/app-check";
import { firebaseConfig } from "@/firebase/config";
import { forbidden } from "./errors";

export async function requirePgrAppCheck(request: { headers: Headers }) {
  const token = request.headers.get("X-Firebase-AppCheck");
  if (!token) {
    if (process.env.PGR_APP_CHECK_ENFORCE === "true")
      throw forbidden("Atualize a página para validar o acesso seguro ao aplicativo.");
    return; // Staged rollout: enforcement only after registered clients send valid tokens.
  }
  try {
    const result = await getAppCheck().verifyToken(token);
    if (result.appId !== firebaseConfig.appId) throw new Error("App não autorizado");
  } catch {
    throw forbidden("Não foi possível validar o aplicativo. Atualize a página e tente novamente.");
  }
}
