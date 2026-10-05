import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from "firebase/storage";
import { doc, updateDoc, Firestore } from "firebase/firestore";
import { STORAGE_PATHS } from "./storage-paths";

/**
 * Faz upload da Logo e atualiza o cadastro da empresa no Firestore.
 * Segue a arquitetura Multi-tenant: /companies/{companyId}
 */
export async function uploadCompanyLogo(
  storage: FirebaseStorage,
  db: Firestore,
  file: File,
  userId: string,
  companyId: string
) {
  try {
    const fileExtension = file.name.split(".").pop();
    const storagePath = STORAGE_PATHS.CLIENT_BRANDING(companyId, `logo.${fileExtension}`);

    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Atualiza o documento da empresa na coleção raiz
    const companyRef = doc(db, "companies", companyId);
    await updateDoc(companyRef, {
      logoUrl: downloadURL,
      updatedAt: new Date().toISOString(),
    });

    return downloadURL;
  } catch (error) {
    console.error("Erro ao fazer upload da logo:", error);
    throw error;
  }
}
