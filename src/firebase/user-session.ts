import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export interface UserAuthState {
  user: User | null;
  role: string | null;
  companyId: string | null;
  servedCompanies?: string[];
  isUserLoading: boolean;
  userError: Error | null;
}

const signedOut: UserAuthState = {
  user: null,
  role: null,
  companyId: null,
  isUserLoading: false,
  userError: null,
};

/** Create only the user's own basic profile. Access is provisioned by an administrator. */
export async function ensureUserProfile(db: Firestore, user: User): Promise<void> {
  const profileRef = doc(db, "users", user.uid);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(profileRef);
    if (existing.exists()) return;
    if (!user.email) throw new Error("A conta precisa de um e-mail para concluir o cadastro.");
    transaction.set(profileRef, {
      id: user.uid,
      email: user.email,
      name: (user.displayName || user.email.split("@")[0]).slice(0, 150),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Owns both subscriptions and discards asynchronous work from a previous identity. */
export function subscribeToUserSession(
  auth: Auth,
  db: Firestore,
  publish: (state: UserAuthState) => void
): () => void {
  let disposed = false;
  let generation = 0;
  let unsubscribeProfile: (() => void) | undefined;

  function clearProfile() {
    unsubscribeProfile?.();
    unsubscribeProfile = undefined;
  }

  const unsubscribeAuth = onAuthStateChanged(
    auth,
    async (user) => {
      if (disposed) return;
      const current = ++generation;
      clearProfile();
      const isCurrent = () => !disposed && current === generation;
      if (!user) {
        if (isCurrent()) publish({ ...signedOut });
        return;
      }

      publish({ ...signedOut, user, isUserLoading: true });
      try {
        await ensureUserProfile(db, user);
        if (!isCurrent()) return;
        unsubscribeProfile = onSnapshot(
          doc(db, "users", user.uid),
          (snapshot) => {
            if (!isCurrent()) return;
            const profile = snapshot.exists() ? snapshot.data() : null;
            // The server-managed profile is the UI source of truth. Cached claims may
            // still describe a permission that an administrator has just revoked.
            publish({
              user,
              role: typeof profile?.role === "string" ? profile.role : null,
              companyId: typeof profile?.companyId === "string" ? profile.companyId : null,
              servedCompanies: Array.isArray(profile?.servedCompanies)
                ? profile.servedCompanies.filter((id: unknown) => typeof id === "string")
                : [],
              isUserLoading: false,
              userError: null,
            });
            // A token refresh failure must never restore old profile permissions.
            void user.getIdTokenResult(true).catch(() => undefined);
          },
          () => {
            if (isCurrent())
              publish({
                ...signedOut,
                user,
                userError: new Error("Não foi possível carregar seu perfil. Tente novamente."),
              });
          }
        );
      } catch {
        if (isCurrent())
          publish({
            ...signedOut,
            user,
            userError: new Error("Não foi possível preparar seu perfil. Tente novamente."),
          });
      }
    },
    () => {
      ++generation;
      clearProfile();
      if (!disposed)
        publish({ ...signedOut, userError: new Error("Não foi possível verificar sua sessão.") });
    }
  );

  return () => {
    disposed = true;
    ++generation;
    clearProfile();
    unsubscribeAuth();
  };
}
