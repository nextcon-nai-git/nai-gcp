# Triagem de segurança — 01/11/2026

Registro da revisão dos alertas e do código disponível na `main` nesta data.
Os alertas #22 e #23 permanecem abertos; a correção do #28 está no
[PR #238](https://github.com/nextcon-nai-git/nai-gcp/pull/238), ainda em validação
neste registro. A revisão não declara ausência de vulnerabilidades nem homologação operacional.
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

O PR #238 valida todos os segmentos antes da cópia, rejeita segmentos vazios, `__proto__`,
`constructor` e `prototype`, e limita leitura e travessia a propriedades próprias. As
regressões em [`event-form.test.tsx`](../../src/components/esocial/event-form.test.tsx)
cobrem escrita, remoção, leitura herdada, arrays e preservação da entrada. Essa proteção
corresponde à orientação da
[regra CodeQL para funções que alteram protótipos](https://codeql.github.com/codeql-query-help/javascript/js-prototype-pollution-utility/).
A aprovação final depende do CI e da nova análise do código; o alerta não foi encerrado
manualmente. A mudança não ativa transmissão ao eSocial.

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
