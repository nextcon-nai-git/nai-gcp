# Continuação da revisão do NAI-GCP

Base consultada: `0410d03178fe8c4dc2082ae6360400e3f5a1cc10` (main).
Escopo desta rodada: regras de prestadores, armazenamento interno e regressões
dos fluxos existentes. Nenhum e-mail, mensagem, comentário de PR ou comunicação
a terceiros foi enviado. Nenhum cadastro real foi criado ou alterado.

## Correções

1. A reserva fiscal de prestadores agora exige que `identityHash` corresponda ao
   ID do documento em `provider_tax_id_reservations`. Antes, uma reserva válida
   podia ser copiada para outro endereço, bloqueando indevidamente outra
   identidade. O novo teste reproduziu a aceitação indevida antes da correção e
   verifica a rejeição, a ausência do registro indevido e a preservação da reserva
   legítima depois dela.
2. O armazenamento interno não aplica mais `matches` a um wildcard recursivo,
   que é um objeto `path`. A regra separa a primeira pasta e reserva todo o
   namespace `contract-sources` ao fluxo específico de criação. Os testes
   verificam criação, substituição e exclusão de documentos internos comuns,
   bloqueio de um usuário de empresa cliente, rejeição de caminhos de origem
   inválidos e proteção contra exclusão de PDFs originais de contratos.

Referência de tipos da linguagem:
<https://firebase.google.com/docs/reference/security/storage>.

## Evidências

- Node `24.19.0`; instalação pelo lockfile com scripts desabilitados.
- Suíte com cobertura: **1.448 testes em 161 arquivos aprovados**. Linhas:
  **44,23%**, statements: 43,55%, branches: 39,17%, functions: 35,24%.
- TypeScript: aprovado.
- ESLint global antes das alterações de Storage: zero erros e 1.347 avisos.
  Os dois arquivos de teste alterados passaram sem avisos no lint focado.
- Formatação dos testes e `git diff --check`: aprovados.
- `npm audit --omit=dev`: 71 alertas (12 altos, 59 moderados, zero críticos).
  Continuam pendentes; não foi aplicada atualização incompatível automática.
- O download dos emuladores funcionou. Após a correção da reserva fiscal,
  **128 testes de regras em 11 arquivos passaram**.
- A primeira execução do build esgotou o heap padrão de aproximadamente 2 GB;
  a repetição com `NODE_OPTIONS=--max-old-space-size=6144`, como no CI, concluiu
  com sucesso, mantendo os avisos existentes de dependências e lint.
- A suíte completa após a correção de Storage apresentou timeout na importação
  de contrato e na inicialização de outras suítes. Foi interrompida após a
  repetição dos timeouts. Isso não foi contado como aprovação nem como falha de
  autorização comprovada; a verificação dos arquivos alterados foi isolada com
  emuladores reiniciados, mas o timeout reapareceu na importação concorrente.
- Na comparação final, o Firebase CLI 14.22.0 executado em Node 22 e o Vitest
  mantido em Node 24 passaram **129 testes de regras em 11 arquivos**, sem testes
  ignorados, em 34,10 segundos. Inclui as duas regressões novas. Esse resultado
  não prova sozinho a causa dos timeouts anteriores, mas registra um caminho de
  validação funcional sem aumentar timeouts nem afrouxar permissões.

Reprodução em ambiente POSIX, mantendo o Node atual para o processo dos testes:

```bash
NAI_TEST_NODE="$(command -v node)"
npx --yes --package=node@22 --package=firebase-tools@14.22.0 firebase emulators:exec \
  --project demo-nai-security --only firestore,storage --config firebase.test.json \
  "\"$NAI_TEST_NODE\" node_modules/vitest/vitest.mjs run --config vitest.rules.config.ts"
```

O runtime da aplicação e o lockfile não foram alterados. O workflow existente
ainda executa o CLI em Node 24; sua estabilidade não foi atestada por esta rodada.

## Limites

Cobertura de linhas não mede percentual de revisão ou homologação do produto.
O vínculo de ASO revisado ao atendimento já existe no código desta base; não foi
implementado nesta rodada. A suíte usa dados sintéticos no projeto
`demo-nai-security`, sem homologação clínica, fiscal, bancária ou de mensageria.
As pendências operacionais da revisão integral continuam separadas dos testes
locais. Publicar o app não publica automaticamente regras de Firestore/Storage.
