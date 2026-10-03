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

A implantação de produção ocorre pelo workflow `deploy.yml`: após validação, um push
para `main` implanta as regras do Firestore e o Hosting no ambiente `production`.
O deploy de Functions é tentado separadamente e não bloqueia a execução se falhar.
Os comandos abaixo são operações manuais via Firebase CLI, não substituem esse
pipeline:

```bash
npm run infra:rules
npm run infra:deploy
```

`infra:rules` publica as regras do Firestore e do Storage; `infra:deploy` publica
somente o Hosting.

## CI

Veja [docs/CI.md](docs/CI.md) para os workflows e como rodar as verificações localmente (`npm run ci`).

## Segurança

Consulte `SECURITY.md` para política de vulnerabilidades e boas práticas.

## Evolução do produto

Consulte o [plano de evolução da plataforma de SST](docs/roadmap-sst-classe-mundial.md) para o diagnóstico da base atual, capacidades-alvo, controles de dados e segurança, governança de IA, indicadores e sequenciamento de entrega.

## Aviso

Este projeto trata de dados sensíveis e exige controles de acesso, auditoria, retenção e governança adequados antes de uso em produção com dados reais.
