"use client";
import type { FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken,
  type AppCheck,
} from "firebase/app-check";

const instances = new WeakMap<FirebaseApp, AppCheck>();
export function initializeNaiAppCheck(app: FirebaseApp): AppCheck | null {
  if (typeof window === "undefined") return null;
  const key = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim();
  if (!key) return null; // Registration and a build-time site key are required.
  const current = instances.get(app);
  if (current) return current;
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(key),
    isTokenAutoRefreshEnabled: true,
  });
  instances.set(app, appCheck);
  return appCheck;
}
export async function getNaiAppCheckToken(app: FirebaseApp) {
  const appCheck = initializeNaiAppCheck(app);
  return appCheck ? (await getToken(appCheck, false)).token : null;
}
