# Acervo de contratos: negativa de acesso e correção isolada

## Diagnóstico

A tela `/contracts` usa `collectionGroup("contracts")`, ordenação decrescente por
`createdAt` e limite 201. Consultas a `companies/{companyId}/contracts` e a consulta
global não são equivalentes para as regras: o grupo precisa de um match recursivo
explícito. A tela também consulta o diretório `companies` com limite 1001.

A regra global já existe em `firestore.rules` e tem teste no repositório. O PR #193
registrou que a cópia então publicada não continha esse bloco, embora o perfil
SUPER_ADMIN estivesse autenticado. Os PRs #201 e #202 não corrigiram a autorização.
O workflow `deploy.yml` só publica regras mediante `workflow_dispatch` com
`deploy_firestore`; o rollout do App Hosting publica a aplicação separadamente.
O PR #203 separa índices, que também não concedem acesso.

A causa sustentada pelas evidências anteriores é divergência entre a regra no
repositório e a regra publicada, não uma necessidade de conceder SUPER_ADMIN ao
operador. Nesta rodada o console Firebase apresentou contas desconectadas; a
configuração ativa atual ainda não foi relida. Não usar o hash da inspeção de
24/10 como se fosse uma exportação atual.

## Política preservada

| Identidade                                                         | Acervo global | Contratos por caminho de empresa                                |
| ------------------------------------------------------------------ | ------------- | --------------------------------------------------------------- |
| SUPER_ADMIN                                                        | Sim           | Política interna existente                                      |
| ADMIN/OPERATIONS interno, tenantId vazio e companyId vazio/nextcon | Sim           | Política interna existente                                      |
| ADMIN/OPERATIONS vinculado a tenant                                | Não           | Somente a própria empresa pela política existente               |
| CLIENT_ADMIN ou outro usuário cliente                              | Não           | Somente a própria empresa pela política existente               |
| Médico                                                             | Não           | Política de empresa existente; nenhuma nova autorização clínica |
| Sem perfil ou anônimo                                              | Não           | Não                                                             |

O patch acrescenta apenas `allow list: if isNextconOfficial()` ao grupo contratos.
Não acrescenta escrita, muda perfis ou concede consulta global a clientes. O
caminho `companies/{companyId}` continua sendo a fronteira de autorização. Os
novos testes verificam leitura e escrita cruzadas negadas e impedem que o próprio
usuário altere seu perfil para ganhar privilégios. Não representam uma auditoria
completa de todas as gravações legadas e validações de conteúdo contratual.

## Preparação e publicação após aprovação

Não publicar o arquivo integral do repositório para resolver este incidente: a
inspeção anterior registrou outras diferenças, inclusive clínicas. O utilitário
`scripts/firestore/prepare-contract-archive.mjs` recebe uma exportação **atual** da
configuração ativa e seu SHA-256 revisado. Acrescenta somente o bloco de listagem,
preserva o restante byte a byte e recusa hash divergente, estrutura inesperada,
regra de grupo já existente ou diferenças nos quatro helpers de autenticação e
perfil. Se recusar, revisar a diferença; não remover as verificações.

1. Autenticar no projeto `studio-8439299034-125c7`, banco correto, e exportar a
   versão efetivamente publicada, não um rascunho do editor. Guardar regras,
   identificador da versão e horário para eventual rollback.
2. Revisar a configuração e calcular seu SHA-256. Executar a partir da raiz:

   ```sh
   node scripts/firestore/prepare-contract-archive.mjs /tmp/active.rules SHA256_REVISADO /tmp/contracts-candidate.rules
   diff -u /tmp/active.rules /tmp/contracts-candidate.rules
   ```

3. Conferir que o diff contém somente o bloco de listagem. Testar o **candidato
   exato** em checkout temporário, substituindo ali `firestore.rules` pelo
   candidato e executando `npm run test:rules`. O teste de reprodução usa baseline
   sintético derivado do repositório; não é ensaio da configuração ativa antiga.
   Se os helpers ou a baseline diferirem, a publicação permanece bloqueada.
4. Após aprovação do PR/candidato, reler as regras ativas e conferir que continuam
   iguais à exportação. Havendo alteração concorrente, gerar novo candidato e
   repetir os testes. Publicar somente o candidato pelo editor ou por configuração
   Firebase separada apontando para ele, com `--only firestore:rules`. Não usar o
   workflow de deploy completo, não publicar índices/Storage/regras clínicas nesta
   correção. Registrar SHA-256 e identificador da versão ativa após a publicação.
5. Em falha ou acesso indevido, restaurar somente a versão anterior revisada,
   conferindo antes se houve publicação concorrente. Não substituir mudanças de
   terceiros por uma cópia antiga.

## Homologação e limites

`tests/rules/contracts-archive-release.test.ts` reproduz negativa interna removendo
somente o match recursivo de uma baseline sintética, aplica o patch e repete a
mesma consulta. Verifica autorização interna e negativas para cliente e perfil
inexistente. O teste também impede sobrescrita do candidato, política divergente
e uso de uma baseline cujo hash mudou.

`tests/rules/contracts-import.test.ts` testa o grupo com SUPER_ADMIN, ADMIN e
OPERATIONS internos, isolamento por caminhos de duas empresas, negação de leitura,
criação, alteração e exclusão cruzadas, perfis não autorizados, autoelevação de
perfil, preservação da fonte e importação atômica/idempotente. Testes da página,
integração e Central cobrem regressão funcional com dados sintéticos.

Após publicação, ainda é necessário:

- Abrir `/contracts` com sessão interna, confirmar o perfil, ausência da negativa,
  consulta ao diretório e registros efetivamente retornados. Não interpretar
  resultado vazio como prova de inexistência sem conferir o escopo da consulta.
- Testar contas de duas empresas em homologação: leitura própria e negativa da
  outra empresa, além de negativa ao grupo. Não mudar papéis reais para ensaiar.
- Na Central `/production`, conferir um contrato de teste aprovado, empresa, fonte
  imutável (SHA-256/geração), obrigações e cards até a implantação. O acervo e a
  Central são persistências diferentes; liberar listagem não migra contratos
  legados nem prova que estejam vinculados. Não criar documentos, obrigações ou
  cobranças reais para preencher esse teste.
- Registrar versão, perfil, empresa, contrato de teste, vínculo e resultado.
  Não emitir NF, cobrar, enviar mensagens ou alterar contratos reais no ensaio.

A publicação e a vinculação operacional real permanecem pendentes até existir
aprovação e evidência autenticada. Resultados automatizados não comprovam o
funcionamento do ambiente publicado.
