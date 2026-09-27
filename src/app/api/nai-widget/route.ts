import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/init';
import { doc, getDoc } from 'firebase/firestore';

/**
 * @fileOverview API Pública para o Widget da NAI.
 * Expõe o roteiro de vendas para consumo externo (Site Nextcon Saúde).
 */

export async function GET() {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { firestore } = initializeFirebase();
    
    // Busca o roteiro de vendas padrão no Firestore
    const pitchRef = doc(firestore, "config_nai_avatar", "pitch_vendas_padrao");
    const pitchSnap = await getDoc(pitchRef);

    if (!pitchSnap.exists()) {
      return NextResponse.json(
        { sucesso: false, mensagem: "Roteiro NAI não localizado." },
        { 
          status: 404,
          headers: cors.headers
        }
      );
    }

    // Retorna os dados com headers de CORS para permitir uso externo
    return NextResponse.json(
      { 
        sucesso: true, 
        dados: pitchSnap.data() 
      },
      {
        status: 200,
        headers: cors.headers
      }
    );
  } catch (error) {
    console.error("Erro na API da NAI:", error);
    return NextResponse.json(
      { sucesso: false, mensagem: "Erro interno no motor NAI." },
      { status: 500 }
    );
  }
}

// Handler para pre-flight requests do CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
