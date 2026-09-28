'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, onSnapshot } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

interface UserAuthState {
  user: User | null;
  role: string | null;
  companyId: string | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState extends UserAuthState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  storage: FirebaseStorage | null;
}

export interface FirebaseServicesAndUser extends FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

export interface UserHookResult {
  user: User | null;
  role: string | null;
  companyId: string | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [authState, setAuthState] = useState<UserAuthState>({
    user: null,
    role: null,
    companyId: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    if (!auth || !firestore) {
      setAuthState(prev => ({ ...prev, isUserLoading: false, userError: new Error("Serviços Firebase não disponíveis.") }));
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          
          setAuthState({
            user: firebaseUser,
            role: (tokenResult.claims.role as string) || null,
            companyId: (tokenResult.claims.companyId as string) || null,
            isUserLoading: false,
            userError: null,
          });

          const userRef = doc(firestore, "users", firebaseUser.uid);
          const unsubscribeSnapshot = onSnapshot(
            userRef, 
            async (docSnap) => {
              if (docSnap.exists()) {
                try {
                  const data = docSnap.data();
                  const newTokenResult = await firebaseUser.getIdTokenResult(true);
                  setAuthState(prev => ({
                    ...prev,
                    role: (newTokenResult.claims.role as string) || data.role || null,
                    companyId: (newTokenResult.claims.companyId as string) || data.companyId || null,
                  }));
                } catch {
                  // Silencia falha de refresh silenciosa
                }
              }
            },
            () => {
              console.warn("NAI Auth: Listener de perfil suspenso (esperado durante logout).");
            }
          );

          return () => unsubscribeSnapshot();
        } catch (error: unknown) {
          setAuthState(prev => ({ ...prev, user: firebaseUser, isUserLoading: false, userError: error }));
        }
      } else {
        setAuthState({
          user: null,
          role: null,
          companyId: null,
          isUserLoading: false,
          userError: null,
        });
      }
    });

    return () => unsubscribeAuth();
  }, [auth, firestore]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      ...authState
    };
  }, [firebaseApp, firestore, auth, storage, authState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase deve ser usado dentro de um FirebaseProvider.');
  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.storage) {
    throw new Error('Serviços core do Firebase não estão disponíveis.');
  }
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    storage: context.storage,
    user: context.user,
    role: context.role,
    companyId: context.companyId,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  } as FirebaseServicesAndUser;
};

export const useAuth = (): Auth => useFirebase().auth;
export const useFirestore = (): Firestore => useFirebase().firestore;
export const useStorage = (): FirebaseStorage => useFirebase().storage;
export const useFirebaseApp = (): FirebaseApp => useFirebase().firebaseApp;

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  return useMemo(factory, deps);
}

export const useUser = (): UserHookResult => {
  const { user, role, companyId, isUserLoading, userError } = useFirebase();
  return { user, role, companyId, isUserLoading, userError };
};
