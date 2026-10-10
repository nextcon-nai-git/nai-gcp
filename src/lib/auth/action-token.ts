"use client";
import { getAuth } from "firebase/auth";

/** Obtain the current Firebase credential only when the user starts an action. */
export async function getActionIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Entre no NAI para executar esta análise.");
  return user.getIdToken();
}
