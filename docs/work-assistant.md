# Assistente operacional

A rota `/assistente` adiciona uma integração própria com a Responses API da OpenAI. Não incorpora a sessão do ChatGPT Work nem herda seus conectores, arquivos, assinatura ou permissões.

O piloto é limitado aos administradores internos já autorizados a importar documentos. Consulta nomes de documentos e até 200 cards de um único cliente, prepara respostas e propostas, e cria cards somente após confirmação explícita. As propostas ficam vinculadas ao usuário e cliente, expiram após uma hora e são aplicadas em transação idempotente. Não envia e-mails, não acessa Drive, não lê PDFs nem assina programas. Dados clínicos individuais não devem ser incluídos nas mensagens ou cards gerais.

## Ativação

1. Publicar e validar as regras Firestore que bloqueiam acesso cliente a `workAssistantProposals` e `workAssistantUsage`.
2. Provisionar `OPENAI_API_KEY` no gerenciador de segredos e vinculá-la somente ao runtime autorizado. Nunca usar prefixo `NEXT_PUBLIC_` nem inserir valor em arquivos, logs ou commits.
3. Configurar `OPENAI_MODEL` com um modelo habilitado no projeto OpenAI e compatível com Responses e Structured Outputs. Definir orçamento e limites no projeto.
4. Implantar a aplicação e testar com administrador: cliente selecionado, consulta de contexto, proposta com data fundamentada, confirmação, reenvio sem duplicação e troca de cliente. Verificar rejeição de perfis sem autorização e segredo ausente.

Sem as duas variáveis, a tela informa indisponibilidade e não envia dados à OpenAI. O código usa `store: false`, timeout de 60 segundos, saída estruturada e limite persistente de 10 solicitações por minuto por usuário. A política de retenção contratual da API é independente de `store: false`.

As datas exibidas nos cards são metas do plano; obrigações por evento e prazos sem comprovação ficam sem data. O usuário confere propostas antes da gravação. A emissão dos documentos PGR/PCMSO, revisão técnica e assinatura profissional continuam em seus fluxos próprios.

Referências: https://developers.openai.com/api/reference/responses/overview e https://developers.openai.com/api/docs/guides/structured-outputs
