# Triagem de segurança — 01/11/2026

Registro da revisão dos alertas, atualizado após a integração do
[PR #238](https://github.com/nextcon-nai-git/nai-gcp/pull/238).
O CI desse PR aprovou 4.048 testes, mas a análise na `main` em `2c3e274` manteve o
[alerta #28 aberto](https://github.com/nextcon-nai-git/nai-gcp/security/code-scanning/28).
Os alertas #22 e #23 também permanecem abertos. A correção complementar do #28 está em validação.
A revisão não declara ausência de vulnerabilidades nem homologação operacional.
Não houve rotação, revogação ou migração de chaves, acesso a dados clínicos ou uso de credenciais
em chamadas externas.

## #22 e #23: SHA-256 de credenciais M2M

Os pontos sinalizados são
[`src/lib/auth/api-key.ts`](../../src/lib/auth/api-key.ts), linha 24, e
[`src/lib/developer-api-guard.ts`](../../src/lib/developer-api-guard.ts), linha 116.
Ambos calculam o hash completo da chave recebida e consultam `api_keys` com igualdade de
`keyHash` e `active == true`. A comparação não usa apenas o prefixo da chave.

O único emissor encontrado no código atual,
[`POST /api/v1/developer/keys`](../../src/app/api/v1/developer/keys/route.ts), recebe empresa,
nome e escopos. O servidor chama `generateApiKey()`, que usa `crypto.randomBytes(24)`:
192 bits aleatórios, codificados em 48 caracteres hexadecimais após `nai_live_`.
O prefixo exibido contém sete desses caracteres; mesmo conhecendo esse prefixo, restam
164 bits do segredo. O registro persiste hash e prefixo; o segredo completo só integra a
resposta de criação, marcada `private, no-store`. O corpo da solicitação não escolhe o segredo.

A [documentação do Node.js](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)
define `randomBytes` como fonte de bytes pseudoaleatórios criptograficamente fortes.
A [regra CodeQL](https://codeql.github.com/codeql-query-help/javascript/js-insufficient-password-hash/)
trata da recuperação de senhas a partir de hashes rápidos. Para as chaves emitidas pelo fluxo
atual, a alta entropia sustenta a classificação de **falso positivo plausível quanto a hash
de senha**. Não foi encontrado motivo para substituir SHA-256 ou migrar as credenciais.

O alcance dessa conclusão tem limites concretos:

- O validador de desenvolvedor exige somente o prefixo `nai_live_`; o validador legado aceita
  qualquer cabeçalho não vazio. Nenhum deles comprova a origem aleatória de registros antigos.
- Chaves históricas ou inseridas manualmente não foram inventariadas. Uma chave previsível
  armazenada por outro mecanismo continuaria sujeita a adivinhação do hash.
- [`firestore.rules`](../../firestore.rules) exclui `api_keys` do acesso direto de clientes.
  O teste em [`access-isolation.test.ts`](../../tests/rules/access-isolation.test.ts) cobre
  a negativa de leitura e criação até para administradores; isso não audita acessos IAM.

Foram lidos os testes dos dois validadores e da administração de chaves. Uma execução local,
em memória, da função de geração confirmou formato, comprimento, hash e prefixo, sem exibir
ou persistir a chave. Isso não mede a entropia do serviço em produção nem substitui o CI.
Como reforço futuro, adicionar regressões do contrato do gerador real e da impossibilidade
de escolher `rawKey`/`keyHash` pelo corpo da criação. Restringir o formato aceito exige antes
conferir a compatibilidade das credenciais existentes.

## #28: atribuição por caminho no formulário eSocial

O helper `updateAt` em
[`src/components/esocial/event-form.tsx`](../../src/components/esocial/event-form.tsx)
permitia percorrer `__proto__` e modificar `Object.prototype`; o efeito foi reproduzido
localmente com objeto e marcador sintéticos. Os caminhos encontrados no formulário atual
vêm dos campos definidos no schema, de caminhos constantes e de índices de arrays. Não foi
demonstrado um caminho externo explorável na interface publicada.

O PR #238 passou a validar todos os segmentos antes da cópia, rejeitar segmentos vazios,
`__proto__`, `constructor` e `prototype`, e conferir propriedades próprias na leitura e
travessia. As regressões em
[`event-form.test.tsx`](../../src/components/esocial/event-form.test.tsx) cobriram escrita,
remoção, leitura herdada, arrays e preservação da entrada. A aprovação dos 4.048 testes no
CI não encerrou o alerta: a análise de `2c3e274` ainda sinalizou a atribuição na linha 48.

A revisão complementar reproduziu um caso residual: um getter/setter já instalado no
protótipo pode interceptar uma atribuição comum ao criar um grupo ou gravar a folha.
A leitura posterior também pode seguir o objeto devolvido pelo getter herdado. Esse caso
exige um estado prévio de acesso ao protótipo; a revisão não demonstrou como um usuário da
interface publicada produziria esse estado. A reprodução isolada comprova a fragilidade
do helper, sem comprovar uma exploração da interface.

A correção complementar define explicitamente propriedades próprias com
`Object.defineProperty` e segue a referência local do novo grupo, evitando a atribuição
e a releitura que poderiam acionar o accessor herdado. Mantém a validação dos segmentos
e preserva os descritores próprios já presentes na cópia, inclusive `length` de arrays.
As novas regressões exercitam accessors herdados na criação de grupos, na remoção de
campos e na gravação da folha, além da preservação de arrays e da entrada.

A orientação da
[regra CodeQL para funções que alteram protótipos](https://codeql.github.com/codeql-query-help/javascript/js-prototype-pollution-utility/)
fundamenta a proteção na função de atribuição. O resultado da correção complementar
depende do CI e de nova análise CodeQL do commit correspondente. O alerta não foi
encerrado ou suprimido manualmente. Nenhuma dessas mudanças ativa transmissão ao eSocial.

## Chave de configuração do Firebase Web

O alerta de Google API key em `src/firebase/config.ts` corresponde à configuração consumida
pelo SDK Firebase Web em `src/firebase/init.ts`. A
[documentação oficial](https://firebase.google.com/docs/projects/api-keys) considera públicas
por desenho as chaves restritas aos serviços Firebase; a autorização depende de Security
Rules, IAM e App Check. Nesta revisão não foram consultadas as restrições efetivas nem o
consumo da chave no Google Cloud. Permanecem pendentes a associação ao aplicativo, as APIs
permitidas, as restrições de aplicação e os controles de abuso. A chave pública não deve
autorizar a Generative Language API; quando acessados por API keys, serviços como Gemini e Places
exigem chaves separadas com restrições adequadas, conforme a documentação.

Não foi encontrado encaminhamento de `firebaseConfig.apiKey` para Gemini. Os provedores de
IA analisados leem variáveis próprias; seus valores efetivos em produção não foram
comparados. Logo, não há prova de reutilização da chave pública para Gemini, nem de que as
restrições atuais estejam corretas. O alerta permanece aberto. O próximo passo é uma
verificação autorizada das
[restrições no Google Cloud](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys),
sem expor valores de chaves. O código de App Check, isoladamente, não comprova enforcement
efetivo no console.
