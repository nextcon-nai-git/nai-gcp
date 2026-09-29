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

Use o Node 20 especificado no projeto:

```sh
npm ci
npm run test:run
npm run typecheck
npm run test:rules
npm run build
```

`test:rules` inicia somente o emulador Firestore, com projeto fictício
`demo-nai-security`, porta local 8085 e sem acesso aos dados de produção.
Requer Java; o CI usa Temurin 21. A versão do Firebase CLI fica fixada no script.
Os testes cobrem criação e edição do próprio perfil, tentativas de acrescentar,
alterar ou excluir privilégios e tentativas de alterar a identidade ou outro usuário.

Ao publicar esta mudança, publique também `firestore.rules`. A regra de atualização
usa `diff().affectedKeys().hasOnly(...)`, que inclui campos criados, alterados e
excluídos. Assim, campos administrativos seguem imutáveis mesmo quando ainda não
existem no perfil. O deploy da aplicação não substitui o deploy das regras.
