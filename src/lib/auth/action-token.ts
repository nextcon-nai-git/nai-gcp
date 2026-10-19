"use client";
import { getAuth } from "firebase/auth";

/** Obtain the current Firebase credential only when the user starts an action. */
export async function getActionIdToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Entre no NAI para executar esta análise.");
  const token = await user.getIdToken();
  if (auth.currentUser !== user)
    throw new Error("A sessão mudou. Confira a conta atual e inicie a operação novamente.");
  return token;
}
