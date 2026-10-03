# NAI - Nextcon Intelligence

Este repositório contém a base do produto NAI, uma plataforma de inteligência aplicada para gestão de saúde, segurança e engenharia de processo em ambientes corporativos.

## Objetivo

A plataforma foi concebida para:

- centralizar dados de saúde e SST
- apoiar avaliação, acompanhamento e auditoria médica
- automatizar triagem documental e análise operacional
- aplicar regras de acesso por empresa, perfil e papel

## Stack principal

- Next.js 15
- React 19
- TypeScript
- Firebase / Google Cloud
- Genkit + Gemini
- Firestore e Storage

## Regras de uso

- Este repositório deve ser usado apenas para desenvolvimento, homologação e documentação interna.
- Dados reais de clientes, documentos sensíveis e credenciais não devem ser publicados em repositórios públicos.
- Os ambientes de produção devem usar autenticação, rede privada e segredos próprios, com acesso restrito.

## Desenvolvimento

```bash
npm install
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## Implantação

A implantação deve ocorrer por pipeline gerenciado e com aprovação para produção.

O app usa o backend Firebase App Hosting `nai`, em `us-central1`, no projeto
`studio-8439299034-125c7`, ligado a `nextcon-nai-git/nai-gcp` e à ramificação `main`.
O ambiente de execução e os workflows usam Node 24. O lançamento automático é
acionado por um novo commit na `main`; confirme o commit e o sucesso do lançamento
no painel do backend antes de considerar a versão publicada.

Com a Firebase CLI autenticada nesse projeto, é possível solicitar um lançamento
manual da `main` no mesmo backend:

```bash
npm run infra:deploy
```

Firestore e Storage têm publicação separada (`npm run infra:rules`). O lançamento
do app não publica essas regras. O workflow legado `Deploy to Firebase` ainda usa
Firebase Hosting e exige `FIREBASE_SERVICE_ACCOUNT_JSON`; seu resultado não confirma
a publicação no App Hosting.

## CI

Veja [docs/CI.md](docs/CI.md) para os workflows e como rodar as verificações localmente (`npm run ci`).

## Segurança

Consulte `SECURITY.md` para política de vulnerabilidades e boas práticas.

## Evolução do produto

Consulte o [plano de evolução da plataforma de SST](docs/roadmap-sst-classe-mundial.md) para o diagnóstico da base atual, capacidades-alvo, controles de dados e segurança, governança de IA, indicadores e sequenciamento de entrega.

## Aviso

Este projeto trata de dados sensíveis e exige controles de acesso, auditoria, retenção e governança adequados antes de uso em produção com dados reais.
