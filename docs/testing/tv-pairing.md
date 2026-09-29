# Acesso por QR Code na TV

A TV cria uma sessão com código aleatório e um segredo de resgate independente.
O QR Code contém somente o código, no domínio em que a aplicação está aberta.
O celular abre `/tv-login/[code]`, autentica a pessoa e pede confirmação explícita.
Após a aprovação, somente a TV que guarda o segredo pode resgatar o acesso.

O servidor verifica o token do celular com checagem de revogação e consulta o perfil
provisionado. No resgate, consulta novamente o perfil e consome a sessão por transação
antes de emitir um custom token. Uma falha posterior requer gerar outro QR Code.
Isso impede que duas tentativas recebam tokens da mesma sessão. O token é retornado
diretamente à TV e não é persistido no Firestore. O segredo original também não é
persistido: a comparação usa seu hash e tempo constante.

As sessões expiram em cinco minutos. `tv_auth_sessions` fica indisponível para
leitura, listagem e escrita por SDKs cliente, inclusive administradores do aplicativo.
As operações usam o Admin SDK no servidor. Configure a política TTL do Firestore
para `expiresAt` se desejar remover automaticamente os registros expirados; a
validação de prazo independe da remoção por TTL.

## Publicação e testes

O fluxo usa as credenciais de servidor já exigidas pelo Firebase Admin. As regras
devem acompanhar a versão da aplicação. O workflow publica as regras testadas antes
do hosting, usando a mesma service account configurada para o release. Sessões
legadas, sem segredo de resgate e prazo válido, são rejeitadas.

```sh
npm run test:run
npm run test:rules
npm run typecheck
npm run build
```

Os testes cobrem o código separado do segredo, aprovação por identidade verificada,
expiração, perfil revogado, uso único, tratamento seguro de falhas e acesso bloqueado
por regras. Testes React cobrem QR Code, resgate após aprovação, expiração, regeneração
e descarte de respostas tardias ao sair da tela. A confirmação em uma TV e um celular
reais continua necessária na homologação com as credenciais do ambiente.
