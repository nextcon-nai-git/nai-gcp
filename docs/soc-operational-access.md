# Central SOC e configuração de acesso

## O que esta alteração entrega

`/assistente` e `/integrations/soc` reúnem os atalhos. A central reúne credenciamento (`/providers`), geração de kit
(`/health-control?tab=agendamento`), campanha AVP e convocações. Os atalhos aparecem
depois que a API confirma o acesso interno. Cada módulo conserva sua autorização.
Não usar `/clinic-hub`: essa rota antiga está desativada e redireciona para o início.

O cadastro de clínica e o PDF são operações do NAI. Esta alteração não cria
prestadores, pedidos, resultados ou ASOs concluídos no SOC. Escrita via Web Service
depende do contrato/WSDL homologado e da credencial liberada para cada operação.

## Credenciais persistentes para consultas

O conector existente utiliza as chaves Exporta Dados no servidor; não depende do
login/senha/ID de uma sessão de navegador. A configuração versionada já identifica
os relatórios 185065, 155091 e 221493, a empresa principal 1005519 e o escopo 2306171.
Isso não prova que as chaves estejam provisionadas no ambiente publicado.

Em um terminal confiável, com Firebase CLI e uma identidade administrativa já
autorizada ao projeto, executar uma única configuração:

```sh
bash scripts/soc/configure-secrets.sh studio-8439299034-125c7 nai
```

A CLI recebe os valores de forma interativa, cria versões no Secret Manager e
oferece a inclusão das referências em `apphosting.yaml`. O script concede leitura
somente desses três segredos ao backend selecionado. Não usar `--debug`, `set -x`,
argumentos contendo valores, arquivos de texto, chat ou GitHub para fornecer chaves.
Não é necessário armazenar a senha de navegador do administrador.

Após todas as operações concluírem, revisar estas referências no bloco `env`:

```yaml
- variable: SOC_COMPANIES_KEY
  secret: SOC_COMPANIES_KEY
  availability: [RUNTIME]
- variable: SOC_EMPLOYEES_KEY
  secret: SOC_EMPLOYEES_KEY
  availability: [RUNTIME]
- variable: SOC_ASOS_KEY
  secret: SOC_ASOS_KEY
  availability: [RUNTIME]
```

As referências não foram ativadas neste PR: um rollout com segredo inexistente
falha. Publicar depois do provisionamento. Conferir também as configurações do
console Firebase, que podem prevalecer sobre o YAML. Rotação exige nova publicação
para que o runtime utilize a versão escolhida.

## Acesso direto à interface SOC

O SOC oferece SSO SAML 2.0. O responsável pelo ambiente precisa vincular o SOC ao
provedor de identidade da organização, com as contas e permissões apropriadas.
A sessão Firebase do NAI, isoladamente, não é uma sessão SAML do SOC.

Depois de homologar essa vinculação, configurar no runtime:

- `SOC_SSO_LAUNCH_URL`: URL permanente de entrada no aplicativo SOC fornecida pelo
  provedor de identidade. Não usar URL de sessão, resposta SAML ou credencial.
- `SOC_SSO_ALLOWED_ORIGIN`: origem HTTPS exata dessa URL, sem caminho ou parâmetros.

O painel então mostra **Acessar SOC com login único**. A configuração é validada no
servidor; origem diferente, HTTP, credenciais na URL, fragmentos ou parâmetros de
sessão são rejeitados. O link não envia o referrer. Sem configuração, o painel
informa que o SOC poderá pedir login. Configuração parcial ou inválida não produz
um link externo. Nenhuma senha é enviada ao frontend ou salva em localStorage.

## Evidência necessária antes de declarar ativação

1. Após publicar, consultar empresa e colaborador conhecidos pela Central SOC.
   Confirmar resposta e horário, empresa e unidade; configuração presente não é
   conexão comprovada.
2. Consultar ASOs em um período conhecido e conferir os códigos dos colaboradores.
3. Em uma sessão comum da equipe, abrir o SOC pelo SSO e verificar a identidade e
   permissões. Não desabilitar MFA, expiração ou CAPTCHA do provedor.
4. Abrir credenciamento e kit pelos atalhos e testar os fluxos nos módulos NAI.
   Um PDF local não comprova pedido criado no SOC.

Fontes oficiais:

- [SOC: SSO SAML](https://www.soc.com.br/blog-de-sst/voce-sabia-que-o-soc-conta-com-o-single-sign-on-via-padrao-saml/)
- [SOC: Exporta Dados](https://www.soc.com.br/blog-de-sst/exportacao-de-dados-e-integracao-com-sistemas-conheca-o-soc/)
- [Firebase: segredos e runtime](https://firebase.google.com/docs/app-hosting/configure)
- [Firebase CLI](https://firebase.google.com/docs/cli)

## NAI com OpenAI: caminho para automação interna

As funções de credenciamento, campanha e geração de PDF funcionam no NAI sem
uma sessão SOC. O assistente existente (`/assistente`) usa a Responses API,
com credencial `OPENAI_API_KEY` no servidor e modelo escolhido em `OPENAI_MODEL`.
Seu escopo atual é consultar metadados e propor/aplicar cards após confirmação;
os atalhos desta entrega não transformam essas propostas em emissão de kits.

Para operar por conversa, ampliar o assistente com funções internas específicas:
consultar a campanha autorizada, conferir pendências e duplicidades, preparar um
lote, gerar PDFs e registrar evidência. Cada função deve validar usuário, empresa,
vínculo e parâmetros no servidor; o modelo não recebe permissão para executar
código ou acessar Firestore arbitrariamente. A geração de um kit e a transmissão
para uma clínica são ações distintas. Manter idempotência e histórico de execução.

A automação de navegador só é necessária para sistemas externos sem operação
oferecida por API. Ela continua dependendo de uma sessão autorizada no SOC e de
um ambiente de execução persistente; a API OpenAI não herda o navegador ou as
credenciais desta conversa. Nenhuma automação de navegador foi adicionada neste PR.

Referências OpenAI: https://developers.openai.com/api/docs/guides/function-calling
e https://developers.openai.com/api/docs/guides/tools-computer-use
