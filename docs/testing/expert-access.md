# Acesso de médicos peritos: CNPJs e cards

O perfil `MEDICAL_EXPERT` possui somente consulta em `/expert`. O servidor
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

## Provisionamento administrativo

1. Na ficha do prestador, conferir nome, e-mail e as unidades vinculadas.
2. Como SUPER_ADMIN, abrir **Acesso de médico perito · somente CNPJs e cards**.
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
  não comprovam publicação, criação dos logins ou teste autenticado dos peritos.
- Após publicar, criar as contas pela tela administrativa e testar com a conta
  do perito: somente as unidades concedidas, cards reais, bloqueio de URLs
  financeiras/contratuais e recusa de empresa não autorizada pela API.

Não foram criadas contas reais ou enviados convites por testes automatizados.
