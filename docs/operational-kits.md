# Emissão operacional de kits no NAI

## Fluxo disponível

Em `/assistente`, a administração interna seleciona o cliente, até dez colaboradores
do mesmo cargo/setor, clínica ativa vinculada, competência, tipo de exame, PDFs PGR
e PCMSO do acervo do cliente, exames, riscos e médico responsável pelo PCMSO.
O operador deve conferir o protocolo e a vigência nos documentos originais. A API
valida referências e dados cadastrais; não interpreta nem aprova conteúdo médico.

O botão **Preparar prévia** funciona sem OpenAI. Com chave/modelo configurados, o
comando “Prepare os kits selecionados” pode chamar `prepare_selected_kits` pela
Responses API. Essa função não recebe argumentos do modelo: utiliza exclusivamente
a seleção validada do formulário e a identidade autenticada no servidor. O modelo
recebe somente a quantidade do lote, além do contexto do assistente já existente.
Não recebe CPF, protocolo, dados cadastrais ou PDF através dessa função. A mensagem
digitada pelo operador continua sendo enviada; não inserir informações clínicas nela.

Após conferência explícita da prévia, **Confirmar e gerar** revalida os cadastros e
grava, em uma transação, PDFs, evidências, histórico e solicitações `kit_montado` no
agendador existente. Downloads usam autenticação Bearer, `private, no-store` e
verificação SHA-256; não há links públicos ou tokens persistidos no navegador.

O PDF reaproveita `generateOccupationalKitPdf`: pedido de exames, fichas em branco e
minuta de ASO. Não constitui ASO médico emitido, reserva de horário, atendimento,
envio à clínica ou registro SOC. Não há função de transmissão externa exposta ao
modelo. Novos conectores de envio deverão apresentar destinatário, documentos e
efeitos exatos antes de uma confirmação separada.

## Validações e auditoria

- Autenticação revogável e mesma permissão interna do assistente; nenhum novo papel
  autorizado. Administradores de clientes e prestadores restritos continuam bloqueados.
- Empresa ativa, CNPJ válido, colaboradores ativos da empresa, CPF válido e sem
  repetição no lote, nome/cargo/setor completos.
- Clínica ativa, tipo clínica/hospital, CNPJ, endereço, telefone e vínculo explícito
  com o cliente em `servedCompanies`. Corrigir vínculos pelo credenciamento.
- PGR e PCMSO distintos, referenciados pelo hash do upload, pertencentes ao cliente
  e identificados por nome. A revisão humana confirma conteúdo, vigência, exames,
  riscos, CRM e adequação ao trabalhador. Datas cadastrais opcionais ausentes ficam
  em branco; agendamento fica “a confirmar”, sem data presumida.
- Prévia vinculada a usuário/cliente, validade de 30 minutos. Qualquer alteração de
  versão nos cadastros/documentos exige nova prévia, antes da primeira emissão.
- Chave global deste fluxo por empresa + CPF + tipo + competência. Confirmações
  repetidas e concorrentes reutilizam o kit; protocolo/identificação diferente no
  mesmo ciclo bloqueia reemissão. A competência é a campanha real, não uma chave
  arbitrária para contornar duplicidades. Não reconciliamos automaticamente PDFs
  antigos, ZIPs externos ou pedidos SOC: conferir esses registros antes de iniciar.
- `workAssistantProposals` mantém prévias, emissão e histórico. Esse namespace já
  proíbe leitura/escrita pelo SDK cliente, inclusive administradores. Não remover
  essa exclusão das regras. PDF limitado a 500 KB, lote a dez; a transação é atômica.
- Emissão registra autor, instante, versão das fontes, confirmação, SHA-256 e estados
  `not_sent`/`not_transmitted`; cada download registra usuário e horário. O arquivo
  emitido é imutável. Reemissão corretiva e política de retenção exigem fluxo próprio.

## Campanha AVP e dependências do SOC

O painel reaproveita o resumo/sincronização da campanha AVP e liga ao controle de
participantes e ao credenciamento. A planilha não fornece um vínculo inequívoco ao
ID do colaborador NAI nesse modelo; não fazemos associação automática por nome,
seleção de clínica por preço ou importação silenciosa dos participantes. Cadastrar
os colaboradores da unidade e conferir pendências na campanha antes de selecionar.
O resumo da campanha não atualiza status de exame ou envio por causa de um PDF.

OpenAI interpreta o pedido e solicita funções autorizadas do NAI. Não substitui
Exporta Dados, Web Service de escrita, SSO, contrato SOCNET ou credenciais do SOC.
Criar prestadores/pedidos no SOC exige operação homologada e credencial específica;
a confirmação de envio precisará guardar ID/resposta do SOC. A nova emissão é NAI,
não uma reemissão dos kits históricos dentro do SOC. Ver `soc-access.md`.

## Configuração segura e verificação

Os módulos de geração funcionam sem OpenAI. `OPENAI_API_KEY` e `OPENAI_MODEL` são
lidos somente no serviço `server-only`; não adicionar prefixo `NEXT_PUBLIC_`, não
registrar seus valores em logs, Git ou chat. O runtime usa `store: false`, timeout
e saída estruturada. A política contratual da OpenAI é independente de `store`.

Em terminal confiável já autenticado, executar:

```sh
bash scripts/configure-openai.sh studio-8439299034-125c7 nai
```

A CLI recebe os valores interativamente e concede ao backend acesso somente aos
dois segredos. Escolher um modelo habilitado no projeto OpenAI com Responses,
Structured Outputs e function calling. Após provisionar, revisar as referências:

```yaml
- variable: OPENAI_API_KEY
  secret: OPENAI_API_KEY
  availability: [RUNTIME]
- variable: OPENAI_MODEL
  secret: OPENAI_MODEL
  availability: [RUNTIME]
```

Não ativar referências antes da existência dos segredos. As configurações do console
Firebase também devem ser conferidas. Este commit não provisiona credenciais nem
altera `apphosting.yaml`; publicação de código não prova configuração do ambiente.

**Testar conexão OpenAI** faz uma chamada sem dados do cliente e confirma Responses
com saída estruturada, sob a quota persistente do assistente. Registra o instante da
verificação, sem chave/conteúdo de resposta. Configuração presente é distinta de
chamada bem-sucedida, que por sua vez não prova execução de kit ou operação SOC.

## Aceitação após publicação

1. Confirmar o SHA publicado no App Hosting e acesso autenticado a `/assistente`.
2. Conferir configuração protegida e executar **Testar conexão OpenAI**.
3. Com cadastros de teste autorizados, preparar, revisar, emitir e baixar um PDF;
   conferir agendador, histórico, identidade, clínica, protocolo e páginas do arquivo.
4. Repetir confirmação e preparar o mesmo lote em outra sessão administrativa:
   apenas um kit. Alterar fonte antes de confirmar: emissão bloqueada.
5. Testar perfis não autorizados e troca de cliente; conferir auditoria do download.
6. Registrar separadamente qualquer futura transmissão SOC. Não marcar operacional
   completo apenas por testes locais, CI, merge ou HTTP 200 na página de login.

Fonte técnica: [OpenAI — Function calling](https://developers.openai.com/api/docs/guides/function-calling).
