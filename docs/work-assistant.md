# Assistente operacional

A rota `/assistente` adiciona uma integração própria com a Responses API da OpenAI. Não incorpora a sessão do ChatGPT Work nem herda seus conectores, arquivos, assinatura ou permissões.

O menu **Assistente NAI · Clínicas e kits** e a área de integrações levam a essa rota.
Após a autorização da API, os botões permitem abrir credenciamento de clínicas,
agendamento/geração de kits e a campanha AVP usando a sessão do NAI. Esses botões
funcionam mesmo quando a OpenAI ainda não está configurada e não exigem login SOC.
A área agora também prepara e emite kits mediante revisão. Consulte [Fluxo operacional de kits](operational-kits.md) para o escopo e as limitações.

O piloto é limitado aos administradores internos já autorizados a importar documentos. Consulta nomes de documentos e até 200 cards de um único cliente, prepara respostas e propostas, e cria cards somente após confirmação explícita. As propostas ficam vinculadas ao usuário e cliente, expiram após uma hora e são aplicadas em transação idempotente. Não envia e-mails, não acessa Drive, não lê PDFs nem assina programas. Dados clínicos individuais não devem ser incluídos nas mensagens ou cards gerais.

## Ativação

1. Publicar e validar as regras Firestore que bloqueiam acesso cliente a `workAssistantProposals` e `workAssistantUsage`.
2. Provisionar `OPENAI_API_KEY` no gerenciador de segredos e vinculá-la somente ao runtime autorizado. Nunca usar prefixo `NEXT_PUBLIC_` nem inserir valor em arquivos, logs ou commits.
3. Configurar `OPENAI_MODEL` com um modelo habilitado no projeto OpenAI e compatível com Responses e Structured Outputs. Definir orçamento e limites no projeto.
4. Implantar a aplicação e testar com administrador: cliente selecionado, consulta de contexto, proposta com data fundamentada, confirmação, reenvio sem duplicação e troca de cliente. Verificar rejeição de perfis sem autorização e segredo ausente.

Sem as duas variáveis, a tela informa indisponibilidade e não envia dados à OpenAI. O código usa `store: false`, timeout de 60 segundos, saída estruturada e limite persistente de 10 solicitações por minuto por usuário. A política de retenção contratual da API é independente de `store: false`.

As datas exibidas nos cards são metas do plano; obrigações por evento e prazos sem comprovação ficam sem data. O usuário confere propostas antes da gravação. A emissão dos documentos PGR/PCMSO, revisão técnica e assinatura profissional continuam em seus fluxos próprios.

Referências: https://developers.openai.com/api/reference/responses/overview e https://developers.openai.com/api/docs/guides/structured-outputs

## Consultas de leitura no Assistente NAI

O chat pode solicitar `read_company_sources`. O servidor valida o perfil, a empresa
da sessão e o período (até 31 dias) e apresenta diretamente o resultado no painel.
A próxima mensagem do chat contém somente a indicação de que houve consulta.
O formulário funciona mesmo quando a IA aguarda configuração. Permite atualização
manual ou a cada 5/15 minutos enquanto a tela permanece aberta e visível.
Não há agendador em segundo plano nesta versão.

### Vínculos necessários na implantação

Provisionar por administração confiável um documento para cada cliente do NAI em
`webhook_deliveries/work-assistant/companies/{companyId}`. O SDK do navegador não
tem acesso a essa coleção. Conferir cada CNPJ, código de unidade/empresa SOC e
código de cliente Omie com as respectivas fontes. Exemplo inteiramente fictício:

```json
{
  "cnpjs": ["12345678000195"],
  "soc": { "companyId": "11", "units": ["3"] },
  "omie": { "cnpj": "12345678000195", "partyCode": 45 }
}
```

Um cliente/grupo pode ter até 30 CNPJs no RD, uma carteira de unidades de
uma empresa SOC e um favorecido Omie explicitamente identificado. Para outras
empresas SOC ou favorecidos, selecionar o cadastro da entidade correspondente.
A consulta financeira informa o CNPJ efetivamente consultado. Sem vínculo
administrativo válido a fonte permanece pendente. A habilitação da IA usa
`OPENAI_API_KEY` (segredo de runtime) e `OPENAI_MODEL` segundo a seção de ativação.
Usar o provisionamento existente de cada conector; não inserir segredos neste documento.

### Fontes e conferência

- RD: lê até 100 solicitações completas recebidas pelo webhook AVP,
  filtradas pelos CNPJs permitidos e pela data de recebimento em Brasília.
  Exige o índice composto de coleção `asoRequests(cnpj ASC, createdAt ASC)`.
  Não lê mensagens livres nem depende da chave de histórico completo.
- SOC: consulta os relatórios de colaboradores e de ASOs do conector oficial.
  Filtra unidades no servidor antes da consulta dos ASOs; até 50 códigos por
  leitura. O relatório informa a quantidade consultada e o recorte parcial.
  A data é a de emissão do ASO. Uma emissão pode ocorrer fora do período.
- Para confirmar um pedido, uma conciliação previamente conferida deve existir na
  subcoleção privada `rdSocLinks/{idDoPedidoRD}` do mesmo documento de cliente,
  com `cnpj`, `companyId` (SOC), `employeeId` e `formId` (ficha SOC).
  O resultado é marcado confirmado somente quando a ficha volta do SOC no período
  com o funcionário previsto, na unidade autorizada e com data a partir do pedido.
  Um vínculo ausente, duplicado no recorte ou incerto fica a conferir.
- Omie: consulta o favorecido pelo código confirmado, compara o CNPJ e busca a
  primeira página (até 50) das contas a receber em aberto por vencimento. Confere
  código e data em cada linha. Exibe valores originais dos documentos e informa
  quando a consulta é parcial.
- Fontes indisponíveis têm quantidade desconhecida. Nenhuma consulta envia
  mensagens, cria pedidos, emite cobranças ou executa pagamentos.

Antes de ativar em produção, aguardar o índice ficar pronto e validar um CNPJ
autorizado com uma referência conhecida de cada fonte. Conferir separadamente
o funcionamento com um usuário sem permissão e com uma fonte indisponível.
