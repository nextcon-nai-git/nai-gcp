import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  DocumentData,
  Firestore,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";

export interface Repository<T> {
  get(id: string): Promise<T | null>;
  list(filters?: Record<string, unknown>): Promise<T[]>;
  create(data: Omit<T, "id">, customId?: string): Promise<string>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

export abstract class BaseFirestoreRepository<T extends { id: string }> implements Repository<T> {
  protected db: Firestore;
  protected collectionName: string;

  constructor(collectionName: string) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    try {
      this.db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      this.db = getFirestore(app);
    }
    this.collectionName = collectionName;
  }

  async get(id: string): Promise<T | null> {
    const docRef = doc(this.db, this.collectionName, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return { id: snap.id, ...snap.data() } as T;
  }

  async list(filters?: Record<string, unknown>): Promise<T[]> {
    let q = query(collection(this.db, this.collectionName));

    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null) {
          q = query(q, where(key, "==", val));
        }
      }
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }

  async create(data: Omit<T, "id">, customId?: string): Promise<string> {
    const colRef = collection(this.db, this.collectionName);
    const docRef = customId ? doc(colRef, customId) : doc(colRef);

    await setDoc(docRef, {
      ...data,
      createdAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
    });

    return docRef.id;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(this.db, this.collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString(),
      serverTimestamp: serverTimestamp(),
    } as DocumentData);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(this.db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}
