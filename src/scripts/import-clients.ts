import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-8439299034-125c7";

if (!getApps().length) {
  initializeApp({
    projectId: projectId,
  });
}

const db = getFirestore();

const rawList = `A Bernardi Distribuidora de Doces e Bebidas123
AC2 Corretora de Seguros413
Adam Kruger e Kruger413
Aline Silva de Oliveira4123
Alkance Soluções em Desenvolvimento de Software413
Alpha Tech56
Ambiotech Consultoria4123
Andes Negócios Digitais4123
Andre Luis Franca de Narde Sociedade Individual de Advocacia413
ASQ Consultoria Empresarial (Salvia Saúde)4123
Astana Door Termoindustrial e Engenharia Industrializada413
Atlas Paraná Desenvolvimento e Eletrotécnica4123
Barabach & Knopp Engenharia e Tecnologia413
Bassetto, Grahl e Madureira Sociedade de Advogados4123
BCS Apoio Administrativo413
Beatriz Gomes Castilhos4123
Biavatti Atuba413
Biavatti Franchising4137
Biavatti Joinville13
Biavatti Marketing Digital4123
Blumenau Estetic Center Biavatti413
BRDE Agência de Curitiba87
Britânia Eletrodomésticos41237
Brotto e Campelo Advogados4123
Bruna Basseto413
Caixa de Assistência dos Funcionários do Banco do Brasil (CASSI)4137
Candido Raimundo Mendes Pinto413
Carbotec Com. Técnico de Prod. Minerais4123
CDA Steel Fabricação e Montagem4123
Central Turbos Paraná4123
Charfav Comercio de Medicamentos e Perfumaria4123
Clinica Biavatti (Matriz e diversas unidades: Balneário Camboriú, Bom Retiro, Brusque, Campo Largo, Fazenda Rio Grande, Guaratuba, Itajaí, Itapema, Jaraguá do Sul, Lages, Londrina, Mafra, Paranaguá, Ponta Grossa, São José dos Pinhais e São Paulo)412379
Clinica Macarini Sociedade Simples413
Clinica Medica Roth & Vernizi4123
Comercio de Produtos Farmacêuticos Rio Bonito413
Companhia Campolarguense de Energia (COCEL)4137
Construfam Engenharia e Empreendimentos4139
D Paula Serviços de Manutenção Industrial413
David Deni Silva de Araujo4123
De Lucca Manutenções413
Dental Family Clinica Odontológica413
Dinamica Comercio de Calçados413
Diviformi Comercio de Moveis413
DW Montec (e Sidneia de Oliveira Gusso Estruturas Metálicas)413
EAC Locações de Escritório413
Emerson Grimminger Ramos413
Enfok Consultoria em Recursos Humanos413
Engomes Serviços413
Escola Essencial de Virtudes4123
Espaço A+ Administradora de Bens (Matriz e Filiais)4123
Espaço A+ Gestão de Self Storage4139
Fabripec Esportes4123
Ferreira Gonçalves & Kametani Advogados Associados4123
Francisco Eduardo Lopes413
G2L Logística413
Gibraltar Comercio de Produtos de Limpeza41239
Giro Tecnologia de Informação4123
Gomes Araujo e Advogados Associados4123
Happy Therapy Clinica de Reabilitação Neurológica413
Hessenza Tools Comercio e Representação4123
In Haus Industrial e Serviços de Logística41237
Incorporadora Gran-Para41239
Infobip Brasil Serviços de Valor Adicionado4123
JCS Brasil Eletrodomésticos413
JFK Investimentos413
Jorfahd Empreendimentos Imobiliários413
JPF Comercio de Confecções4137
Juan Robert Mota Guimarães4123
L L M Calcamentos e Terraplenagem41237
Latwan Conectividade13
Laviers Artigos Masculinos e Confecções413
LNX Tecnologia da Informação13
Lvalle Engenharia (TST)8123
Luciane Helena Pinto Locadora413
Luis Carlos de Oliveira Junior4123
Luiz Alberto Basseto413
Lusol Analise em Processos e Legalização de Documentos4123
Martins & Gomes Instalações Elétricas e Hidráulicas413
Meitan Clinica Medica Sociedade Simples4123
Metalsinagem Industria Mecânica41239
MG Isolamentos13
Midea (TST)8
MLS Prestadora de Serviços413
Montrachet - Administradora de Bens4123
Nativa Empreendimentos8137
NCK Contabilidade413
Noxi Química813
NXC SST Participações Societárias (Holding NXC)139
Pasquini Comercio de Medicamentos4123
Paulo Henrique Nocete13
Paysage Corpal Incorporações4123
Pereira da Silva Materiais de Construção4123
Pereira e Pereira Consultoria Jurídica e Advocacia413
PLM Reformas em Geral413
POA Cheesecake e Bubble Tea Comercio Chas413
Portalseg13
Porto Camargo Engenharia4123
PR Max Serviços Industriais413
PR-LJM - Administradora de Bens e Participações4123
Premcell - Consultoria em Telecomunicações4137
Primor Serviços Médicos4137
Produtos Alimentícios Cefer (Santamassa)413
Promatec - Prestação de Serviço de Consultoria e Analise Ambiental413
Protech Soluções Industriais4123
Rafael Preto Basseto4123
RCF Construções Civis413
Recupere - Serviços de Cobrança413
Repara Engenharia13
Restaurante e Churrascaria Pansolim413
Roofservice Serviços Técnicos87
Samir Jose de Andrade & Cia (Restaurante Bom Jesus)413
San Jose Urbanismo13
Serviço Social da Indústria (SESI - Campo Largo e CIC)4123
Sul Cabeamento Instalações Elétricas e Tecnológicas413
Supernova Energia413
Tanguá Triângulo Empreendimentos Imobiliários13
Thunderbird Idiomas413
Time Now Engenharia (e Unigel)8137
Top Service Serviços e Sistemas13
V. S. Centro Automotivo13
Vanguard Home Empreendimentos Imobiliários123
Vita Beach Locação13
Wercon Consultoria e Contabilidade`;

async function run() {
  console.log("🚀 Iniciando processamento e limpeza dos dados...");

  const lines = rawList.split("\n").filter((l) => l.trim() !== "");
  let count = 0;

  for (const line of lines) {
    const cleanName = line.replace(/\d+$/, "").trim();

    if (!cleanName) continue;

    const id = cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const docRef = db.collection("companies").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      await docRef.set({
        id: id,
        name: cleanName,
        active: true,
        risk_degree: 3,
        createdAt: new Date().toISOString(),
        source: "commercial_import_script",
      });
      console.log(`✅ Adicionado: ${cleanName}`);
      count++;
    } else {
      console.log(`⚠️ Já existe: ${cleanName} (${id})`);
    }
  }

  console.log(`\n🏁 Concluído! Foram inseridas ${count} novas empresas no banco de dados.`);
}

run().catch(console.error);
