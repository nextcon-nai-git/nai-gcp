/**
 * Configuração central do Firebase para a Plataforma NAI.
 * Prioriza variáveis de ambiente para segurança em produção e CI/CD.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB8PfD-uf4PPceogHMCeW6IsOPALk6aLxo",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-8439299034-125c7.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8439299034-125c7",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "studio-8439299034-125c7.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1061319966767",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1061319966767:web:4749907ad26ff517d686da",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-E4BW6VFHZH",
  vapidKey:
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "KQTHDw_Lzjd3WojmUZlJttRGtFbHxnfa39eTR_uOnBg",
};
