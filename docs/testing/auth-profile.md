# Login e perfil de acesso

Contas válidas do Firebase Auth sem `users/{uid}` recebem somente `id`, `email`,
`name` e `updatedAt`, por uma transação que não substitui perfis existentes.
Cargo, empresa e empresas atendidas continuam sob provisionamento administrativo.
Até a liberação, a interface mostra o estado pendente e permite verificar novamente
ou sair da conta. A interface não monta páginas protegidas durante o redirecionamento
de usuários deslogados ou enquanto o perfil não puder ser consultado.

A assinatura do perfil pertence à sessão atual: troca de conta, logout e desmontagem
encerram a assinatura anterior. Respostas tardias não podem restaurar permissões.
O perfil gerenciado no Firestore é a origem das permissões mostradas na interface;
as regras do Firestore continuam sendo a barreira de autorização dos dados.

## Validação

Use o Node 24 especificado no projeto:

```sh
npm ci
npm run test:run
npm run typecheck
npm run test:rules
npm run build
```

`test:rules` inicia os emuladores Firestore e Storage, com projeto fictício
`demo-nai-security`, portas locais 8085 e 9197 e sem acesso aos dados de produção.
Requer Java; o CI usa Temurin 21. A versão do Firebase CLI fica fixada no script.
Os testes cobrem criação e edição do próprio perfil, tentativas de acrescentar,
alterar ou excluir privilégios e tentativas de alterar a identidade ou outro usuário.

Ao publicar esta mudança, publique também `firestore.rules`. A regra de atualização
usa `diff().affectedKeys().hasOnly(...)`, que inclui campos criados, alterados e
excluídos. Assim, campos administrativos seguem imutáveis mesmo quando ainda não
existem no perfil. O deploy da aplicação não substitui o deploy das regras.

## Limites clínicos e compatibilidade dos perfis internos

O perfil genérico `PROVIDER` mantém somente as permissões operacionais previstas
para prestadores. Vínculos em `servedCompanies` não liberam histórico médico,
prontuários ou arquivos clínicos. Para atuação clínica, o administrador deve
provisionar um perfil de saúde apropriado, com as empresas autorizadas.

Perfis `ADMIN` e `OPERATIONS` com `companyId: "nextcon"` e `tenantId` ausente,
nulo ou vazio representam a equipe interna legada. As APIs normalizam esse
marcador para escopo interno; um tenant explícito continua tendo prioridade.
`OPERATIONS` não recebe acesso clínico nem financeiro com essa normalização.
As regras de importação clínica também reconhecem o administrador interno legado.

Os testes de `claims`, `require-auth`, `require-clinical-access`, `medical-history`
e os testes de regras `tenant-resolution`, `access-isolation` e
`root-clinical-boundary` cobrem essas fronteiras. Para aplicar a correção completa,
publique a aplicação e **ambas** as regras (`firestore.rules` e `storage.rules`).
