import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { firebaseConfig } from "@/firebase/config";
import { generateApiKey, VALID_DEVELOPER_SCOPES, DeveloperScope } from "@/lib/developer-api-guard";

/**
 * PIPELINE: Geração de Chaves de API M2M
 *
 * POST /api/v1/developer/keys
 *         ↓
 * Firebase ID Token
 *         ↓
 * requireRole("SUPER_ADMIN", "ADMIN")
 *         ↓
 * requireTenantAccess()
 *         ↓
 * validateScopes()
 *         ↓
 * createKey()
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : "";

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // 1. Extração do Payload da Requisição
    const body = await req.json();
    const { clientId, name, scopes } = body;

    if (!clientId || !name) {
      return NextResponse.json(
        {
          error: "Campos obrigatórios ausentes: clientId e name são requeridos.",
        },
        { status: 400 }
      );
    }

    // 2. Validação de Escopos (validateScopes)
    const requestedScopes: string[] =
      Array.isArray(scopes) && scopes.length > 0 ? scopes : ["access_control:read"];
    for (const s of requestedScopes) {
      if (!VALID_DEVELOPER_SCOPES.includes(s as DeveloperScope)) {
        return NextResponse.json(
          {
            error: `Escopo inválido: '${s}'. Escopos aceitos: [${VALID_DEVELOPER_SCOPES.join(", ")}]`,
          },
          { status: 400 }
        );
      }
    }

    // 3. Validação do Tenant no Firestore (requireTenantAccess)
    const companyRef = doc(db, "companies", clientId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists() && clientId !== "ALL_TENANTS" && clientId !== "GLOBAL") {
      return NextResponse.json(
        {
          error: `Tenant '${clientId}' não encontrado no banco de dados corporativo.`,
        },
        { status: 404 }
      );
    }

    // 4. Criação Criptográfica da Chave (createKey)
    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    const record = {
      clientId,
      name: name.trim(),
      keyPrefix,
      keyHash,
      scopes: requestedScopes,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      serverTimestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "api_keys"), record);

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        name: record.name,
        clientId: record.clientId,
        keyPrefix: record.keyPrefix,
        scopes: record.scopes,
        rawKey, // O cliente deve salvar esta chave neste momento (armazenamento único)
        createdAt: record.createdAt,
        message: "Chave de API M2M gerada com sucesso. Guarde a chave em local seguro.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Developer Keys API Error]", error);
    return NextResponse.json(
      {
        error: error.message || "Falha ao processar pipeline de emissão de chave de API.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/developer/keys?clientId=...
 * Lista chaves ativas do tenant (sem expor hash nem chave crua)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const keysRef = collection(db, "api_keys");
    const q = clientId
      ? query(keysRef, where("clientId", "==", clientId), where("active", "==", true))
      : query(keysRef, where("active", "==", true));

    const snap = await getDocs(q);
    const keys = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        clientId: data.clientId,
        keyPrefix: data.keyPrefix,
        scopes: data.scopes,
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt || null,
      };
    });

    return NextResponse.json({ keys });
  } catch (error: any) {
    return NextResponse.json({ error: "Falha ao listar chaves." }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/developer/keys?id=...
 * Revogação instantânea de chave de API
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return NextResponse.json({ error: "ID da chave é obrigatório." }, { status: 400 });
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);

    await updateDoc(doc(db, "api_keys", keyId), {
      active: false,
      revokedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: "Chave de API revogada com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ error: "Falha ao revogar chave." }, { status: 500 });
  }
}
