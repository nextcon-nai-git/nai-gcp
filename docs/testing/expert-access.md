# Acesso restrito de prestadores: CNPJs e cards

O perfil `SCOPED_PROVIDER` possui somente consulta em `/expert`. O servidor
retorna projeções de identificação das empresas e dos cards, nunca documentos
integrais de empresas, contratos, faturamento, arquivos ou prontuários. A tela
não monta navegação, busca ou assistente globais. Os cards são de consulta;
edição, mudança de status e inclusão de arquivos continuam com a equipe interna.

Cada GET autentica o token com verificação de revogação, consulta o perfil
armazenado e intersecta `users.servedCompanies` com os vínculos atuais do
prestador. O vínculo `provider.accessUid` e o e-mail precisam coincidir. O
servidor confere novamente o perfil e os vínculos antes de devolver os dados.
Uma empresa adicionada ao prestador não amplia automaticamente o perfil.
Este papel é recusado em todas as outras rotas que usam `requireAuth`, mesmo
com uma permissão curinga atribuída indevidamente. Firestore e Storage negam
acesso direto aos documentos brutos. O papel não tem `companyId` ou `tenantId`.

As regras também removem a herança genérica de `companyId` para `PROVIDER`:
ela não deve conceder acesso a contratos ou faturamento. O acesso clínico
existente dos demais prestadores continua regido pelas suas regras clínicas.
O resumo de contratos em `/api/financial/contracts` também recusa `PROVIDER`
antes de consultar o Admin SDK. O escopo operacional do dashboard não autoriza
essa leitura comercial.

Os prazos dos cards aceitam `YYYY-MM-DD` e timestamps ISO completos, preservando
o dia registrado sem deslocamento pelo fuso horário do navegador. Valores
ausentes ou inválidos continuam identificados como **Não informado**.
Se a unidade selecionada for revogada ou excluída, a tela descarta os dados
anteriores e consulta uma vez os vínculos atuais sem a seleção inválida.
Se não houver mais acesso, apresenta o erro sem restaurar os dados antigos.

## Provisionamento administrativo

1. Na ficha do prestador, conferir nome, e-mail e as unidades vinculadas.
2. Como SUPER_ADMIN, abrir **Acesso restrito de prestador · somente CNPJs e cards**.
3. Rever a lista completa de unidades e CNPJs. Identificação fiscal pendente
   não deve ser confundida com identidade fiscal validada ou contratação.
4. O administrador informa a senha inicial e confirma a concessão. A senha
   não é preenchida por padrão, gravada no Firestore, enviada por e-mail,
   registrada em auditoria ou embutida no código.
5. A conta nasce desabilitada no Auth. Uma transação confere novamente os
   vínculos e cria o perfil mínimo e a auditoria; somente depois ela é ativada.
6. Uma conta já existente com outro perfil exige revisão separada: o fluxo
   nunca troca sua senha ou substitui o perfil. Falhas parciais deixam a nova
   conta desabilitada para revisão administrativa, sem liberar acesso amplo.

O cadastro profissional permanece independente do login. Nenhum convite é
enviado por este fluxo. Para suspender acesso, SUPER_ADMIN define
`users/{uid}.accessEnabled=false` e desabilita a conta Auth; a remoção de um
vínculo no prestador também bloqueia a unidade na próxima consulta.

## Validação e publicação

- Testar projeções, escopo, revogação, acesso direto por URL, criação sem
  sobrescrita de conta e falha de transação com os testes `expert-*`,
  `require-auth.test.ts`, `app-content.test.tsx` e `tests/rules/expert-access.test.ts`.
- Rodar typecheck, lint, testes e build. As regras exigem os emuladores
  Firestore/Storage; a CI usa Java 21.
- Publicar aplicação e regras separadamente. O workflow **Firebase validation**
  permite publicar Firestore, índices e Storage depois dos testes. Merge e CI
  não comprovam publicação, criação dos logins ou teste autenticado dos prestadores.
- Após publicar, criar as contas pela tela administrativa e testar com a conta
  do prestador: somente as unidades concedidas, cards reais, bloqueio de URLs
  financeiras/contratuais e recusa de empresa não autorizada pela API.

Não foram criadas contas reais ou enviados convites por testes automatizados.

## Regressões e aceite da revisão do PR #206

- `src/app/expert/page.test.tsx`: prazo ISO na tela; revogação (403) e exclusão
  (400) da unidade; seleção de outra unidade válida; revogação total sem loop;
  falha de sessão/servidor; troca de conta durante a recuperação.
- `src/lib/expert-workspace.test.ts`: datas simples, ISO UTC e com offset,
  anos bissextos, valores ausentes e inválidos.
- `tests/rules/expert-access.test.ts`: prestador legado com `companyId`, com
  `servedCompanies` ou ambos; leitura operacional de tasks/risks/pgr_cards
  apenas nas unidades vinculadas; bloqueio de escrita operacional, contratos,
  faturamento, consultas globais e documentos/arquivos de outro cliente.
  O acesso clínico já autorizado ao prestador legado é preservado; o perfil
  novo `SCOPED_PROVIDER` continua sem acesso bruto ou clínico.
- `src/app/api/financial/contracts/route.test.ts`: bloqueio de ambos os perfis
  de prestador, incluindo solicitações da própria unidade, de outro cliente e
  `all`, antes de qualquer leitura de contratos; preservação do escopo do
  administrador cliente e do portfólio da administração interna.

### Evidências a registrar depois da aprovação e do merge

1. **Aplicação:** SHA efetivamente publicado, ID/data do rollout e resposta da
   rota publicada. Build ou merge isolados não comprovam rollout.
2. **Regras:** execução separada de publicação de Firestore e Storage, com o
   resultado e a versão efetivamente ativa de cada conjunto de regras.
3. **Teste autenticado:** conta de teste aprovada, perfil persistido, unidades
   vinculadas e resultado real da consulta; prazo ISO exibido; revogação de
   uma unidade sem perder acesso às demais; recusas de contratos, faturamento,
   prontuários e clientes não vinculados para `SCOPED_PROVIDER`.
4. **Legado:** leitura operacional autorizada e rejeição de consultas comerciais
   e de outro cliente. Registrar evidências sem dados pessoais ou credenciais.
5. **Contas:** conferir separadamente existência/ativação no Auth e perfil/vínculos
   no Firestore. Não marcar logins como criados a partir de testes, merge ou deploy.

As etapas de produção acima permanecem pendentes até execução e confirmação.
