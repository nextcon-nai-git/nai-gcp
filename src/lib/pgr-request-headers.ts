"use client";
import { getApp } from "firebase/app";
import { getNaiAppCheckToken } from "@/firebase/app-check";
export async function pgrRequestHeaders(user: { getIdToken: () => Promise<string> }, json = false) {
  const token = await user.getIdToken();
  const appToken = await getNaiAppCheckToken(getApp());
  return {
    Authorization: `Bearer ${token}`,
    ...(appToken ? { "X-Firebase-AppCheck": appToken } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}
