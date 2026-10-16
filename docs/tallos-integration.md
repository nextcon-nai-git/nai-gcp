# RD Conversas / Tallos no NAI

Central: `/integrations/rd-conversas`, disponível no menu e no hub de integrações.

## Acesso e credenciais

A API NAI verifica o ID token Firebase e o perfil no banco. A conta Tallos é global:
somente SUPER_ADMIN e ADMIN/OPERATIONS sem tenant podem consultar ou operar a central.
Nenhum token do provedor é enviado ao navegador. Todas as consultas usam no-store.

`TALLOS_API_TOKEN` já está vinculado ao runtime em apphosting.yaml. O backend deve
ter Secret Accessor nesse segredo e executar uma revisão que contenha a configuração.

## Recursos

- Contatos: GET /v2/customers, 50 registros por página; usa X-Total/X-Pages quando presentes.
- Operadores e teste de conexão: GET /v2/employees.
- Atendimentos: GET /v4/reports; período limitado a 90 dias, filtro opened/closed.
  As contagens exibidas pertencem somente à página retornada. Campos ausentes ficam
  sem valor, sem inventar totais, tempos médios ou SLAs.
- Vínculos explícitos entre contato Tallos e companies/{id}/employees/{id};
  o servidor verifica a existência e a relação empresa/colaborador. Nenhum cadastro
  de colaborador ou dado clínico é alterado por esse vínculo.
- Operação ASO: consulta as últimas 100 mensagens e solicitações recebidas pelo
  webhook AVP existente, com acesso ao agendador que já consome essas solicitações.
- Mensagens: rascunho no servidor, revisão do destinatário/operador/texto e confirmação
  literal AUTORIZAR ENVIO. Somente o criador pode enviar, dentro de 15 minutos.
  Uma transação consome o rascunho antes do POST ao Tallos. Timeout ou resposta incerta
  bloqueia repetição automática. ACCEPTED confirma a requisição, não a entrega.
  Rascunhos e auditoria de autorização ficam na coleção já protegida
  webhook_deliveries/tallos-outbound/drafts; o SDK do navegador não pode alterá-los.

## Histórico completo (dependência externa)

A documentação oficial consultada em 16/10/2026 informa disponibilidade nos planos
Pro e Advanced, com criptografia e chave privada, para GET
/v2/messages/history. Sem essa chave, a central informa a pendência; o histórico
recebido via webhook continua disponível. O código suporta JWE compact e flattened
JSON com RSA-OAEP/RSA-OAEP-256 e AES GCM/CBC-HMAC autenticado. Tags inválidas,
compressão e cabeçalhos críticos não suportados são rejeitados.

Para ativar, o administrador precisa gerar a chave na área API do Tallos, guardar
o JWK privado ou PEM no Secret Manager como TALLOS_HISTORY_PRIVATE_KEY, conceder
acesso ao backend nai e, somente depois de o segredo existir, adicionar ao env:

```yaml
- variable: TALLOS_HISTORY_PRIVATE_KEY
  secret: TALLOS_HISTORY_PRIVATE_KEY
  availability:
    - RUNTIME
```

Não compartilhe a chave no chat, em arquivos do repositório ou em screenshots.

## Consulta sem contratar Advanced

- Mensagens e solicitações AVP já armazenadas são lidas diretamente do Firestore,
  sem chamar a API Tallos e sem depender do token ou da chave de histórico.
  São até 100 mensagens e até 100 solicitações, separadamente; não é todo o chat.
- O webhook aceita apenas contratos suportados e telefones autorizados. Não
  recupera mensagens anteriores à sua ativação nem anexos ou eventos em lote.
- Contatos, operadores e relatórios usam o token Tallos, sem a chave privada de
  histórico. A disponibilidade deve ser conferida por recurso na conta contratada;
  uma conexão válida não comprova acesso a relatórios.
- O histórico remoto também está documentado para o plano Pro. A chave configurada
  não comprova que a conta tenha permissão. Não recomendar upgrade sem verificar
  o plano e uma consulta autorizada ao recurso.

## Validação operacional

1. Confirmar o rollout do commit no Firebase App Hosting (não no Hosting legado).
2. Entrar com perfil interno e clicar Testar conexão.
3. Consultar contatos, operadores e relatórios de um intervalo curto. Um recurso
   pode retornar falta de permissão mesmo quando a conexão básica funciona.
4. Confirmar um vínculo de contato; reabrir a consulta para conferir persistência.
5. Verificar recebimentos na aba Operação ASO. Segredos configurados não provam
   que o webhook está ativo no Tallos. A validação ponta a ponta exige um evento real.
6. Não enviar mensagens de teste a clientes. Usar contato controlado somente após
   revisão e autorização explícitas do responsável dentro da tela.

Referências oficiais:

- https://developers.rdstation.com/reference/conversas-v2-list-contacts
- https://developers.rdstation.com/reference/conversas-v2-employees
- https://developers.rdstation.com/reference/conversas-v2-list-reports
- https://developers.rdstation.com/reference/conversas-v2-list-messages-history
- https://developers.rdstation.com/reference/conversas-v2-encryption
- https://developers.rdstation.com/reference/conversas-v2-send-message
