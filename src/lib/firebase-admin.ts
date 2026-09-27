import * as admin from 'firebase-admin';

// O Next.js tenta inicializar isso várias vezes durante o hot-reload no ambiente de dev,
// então nós checamos se o 'admin.apps.length' já tem um app iniciado.
if (!admin.apps.length) {
  try {
    // Se a variável GOOGLE_APPLICATION_CREDENTIALS estiver configurada no .env apontando
    // para o json de serviço, o Firebase vai pegá-la automaticamente.
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    console.error('Firebase Admin initialization error', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
