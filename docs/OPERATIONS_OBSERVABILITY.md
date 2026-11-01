# Acompanhamento operacional

## Objetivo

O painel em `/admin/operations` mostra a configuração de invocação e os registros
produzidos pelos workers após autenticação. O acesso pela interface e pela API exige
um SUPER_ADMIN global. A API relê o perfil atual por `requireAuth` e não usa cache.
O atalho fica em Configurações para esse mesmo perfil.

`SUPER_ADMIN` já é um papel global na política do NAI. O painel preserva essa
convenção inclusive para perfis internos legados com empresa `nextcon`; não altera
cadastros nem concede o acesso a `ADMIN`, `OPERATIONS` ou perfis de clientes.

O painel é de consulta. Abrir a página ou atualizar os registros não executa jobs,
não altera permissões e não habilita envios. A tela apresenta os bloqueios globais
de transmissão eSocial e de e-mail ao cliente conforme a configuração do servidor.
Qualquer valor diferente de `true` mantém esses dois envios bloqueados.

## Como interpretar

| Indicação                          | Significado                                                        | Limite da evidência                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Configuração de invocação presente | As variáveis esperadas pelo worker estão preenchidas               | Não prova a existência do agendador, o valor correto das variáveis, acesso ao provedor ou certificado |
| Sem execução registrada            | Nenhum registro válido foi encontrado desde a adoção deste monitor | Pode haver agendamento ausente, ausência de chamadas ou falha na persistência da telemetria           |
| Execução registrada                | Uma chamada autorizada devolveu um resumo reconhecido              | Pode ter processado zero itens; não comprova entrega externa                                          |
| Pendências registradas             | O resumo aponta indisponibilidade ou processamento parcial         | Exige conferência da fila correspondente                                                              |
| Falha registrada                   | A chamada falhou ou as duas atualizações AVP falharam              | Mensagens do provedor não são armazenadas neste painel                                                |
| Resultado não confirmado           | O retorno não tem os contadores esperados                          | Não é tratado como execução bem-sucedida                                                              |
| Registro desatualizado             | O registro mais recente excedeu o limite da tabela abaixo          | O limite é uma política de observação, não um SLA                                                     |
| Registro requer conferência        | O documento persistido não atende ao formato esperado              | Não é usado como prova de funcionamento                                                               |

| Operação                | Rota autenticada                   | Limite de atualização |
| ----------------------- | ---------------------------------- | --------------------- |
| Consultas eSocial       | `/api/internal/esocial-sync`       | 20 minutos            |
| Retornos de ASO         | `/api/internal/aso-mail-sync`      | 60 minutos            |
| Planilhas AVP           | `/api/internal/avp-sheet-sync`     | 120 minutos           |
| Entregas de integrações | `/api/internal/webhook-deliveries` | 15 minutos            |

Nos webhooks, `examined` é o número de itens examinados pelo worker; não é uma
contagem de entregas confirmadas. No AVP, `queueUpdated` e `periodicUpdated` indicam
atualização realizada. Zero pode corresponder a intervalo, reserva de execução ou
fonte não configurada. Em ASO, `hasMore` indica que resta outro lote. Consultas
eSocial não significam transmissão de um novo evento.

### Alcance dos contadores eSocial

Os contadores descrevem somente a execução observada:

- `checked` (Tentativas de consulta) conta as consultas que devolveram um resultado
  interno nesta chamada, inclusive processamento ainda pendente ou erro de transporte
  tratado. Não é contagem de recibos aceitos nem de requisições SOAP comprovadas.
- `waiting` conta respostas de processamento em andamento e recuperações de uma
  resposta de envio que confirmaram o protocolo, mas ainda exigem consulta do lote.
- `unavailable` conta consultas sem resultado utilizável, resposta inconsistente,
  acesso indisponível, disputa de execução ou envio interrompido/incerto que exige
  conferência. Um evento preservado após timeout não se torna consulta bem-sucedida.

`waiting` e `unavailable` podem estar incluídos em `checked`; uma recuperação de
`submitting` também pode incrementá-los sem fazer SOAP. Portanto, os três números
não devem ser somados como total de itens. Qualquer `waiting` ou `unavailable`
positivo produz **Pendências registradas**. Uma rejeição final do evento pode
encerrar a consulta, mas não comprova aceite pelo eSocial; o resultado de negócio
permanece na mensageria e no recibo correspondente.

O worker seleciona no máximo dez eventos vencidos e deixa de iniciar novos itens
após 120 segundos. O resumo não mede o restante da fila, eventos ainda sem prazo
de consulta ou eventos incertos fora da seleção automática. Mesmo contadores
zerados não comprovam fila vazia. Registros anteriores a este refinamento não
discriminavam todos os erros tratados pela consulta; a ausência de indisponibilidade
nesses registros não prova ausência de falha e não é reclassificada retroativamente.

## Registros e privacidade

O servidor mantém quatro documentos fixos sob
`clinic_portal_private/operations/worker_status/{operation}`. Cada um contém a
última execução observada e a última falha ou pendência. As regras existentes negam
leitura e escrita direta desse namespace a todos os clientes, inclusive
administradores; a API administrativa retorna apenas campos permitidos.

Os registros incluem identificador aleatório, operação, início, conclusão,
duração, resultado e contadores numéricos. Não incluem nomes de colaboradores,
documentos, destinatários, payloads, valores de variáveis, tokens ou mensagens de
erro do provedor. O parser aplica novamente essa lista de campos ao ler o banco.

Uma transação substitui integralmente cada resumo; contadores de uma execução
anterior não são misturados com os da nova. O horário de início determina a ordem,
com UUID como desempate determinístico para o mesmo milissegundo. Isso organiza a
exibição e não pretende fornecer uma sequência global entre réplicas.

A observabilidade nunca repete a ação de negócio. Sua espera pela persistência é
limitada a 2,5 segundos. Uma falha de sumarização, banco ou logger não substitui o
resultado nem o erro original do worker. Por isso, ausência de registro exige
investigação e não demonstra, sozinha, que a operação não ocorreu.

## Consulta de logs

Cada chamada monitorada tenta emitir um objeto JSON com `event: nai_worker_run`.
Se o coletor receber a entrada como log estruturado, o filtro do Logs Explorer é:

```text
jsonPayload.event="nai_worker_run"
jsonPayload.operation="esocial-query"
```

O campo `evidencePersistenceConfirmed` informa se a gravação do documento foi
confirmada antes do limite de espera. `false` não prova que a transação nunca
terminou: ela pode concluir depois. Confirme o coletor e a configuração do projeto
antes de criar alertas. Este código não provisiona alertas no Cloud Monitoring.

## Aceite por camada

1. **Publicação:** confirmar o commit implantado e a conclusão da distribuição no
   Firebase App Hosting. CI e build aprovados são evidência de software, não da
   existência dos recursos externos.
2. **Provisionamento:** confirmar por leitura no projeto a identidade federada,
   permissões restritas, cofre, versões do segredo, agendador, conta de invocação e
   audiência OIDC. A presença das variáveis na aplicação não substitui essa leitura.
3. **Execução autenticada:** conferir horário, identidade autorizada, HTTP do job e
   registro do worker. Testar rejeição de identidade/audiência incorretas em ambiente
   isolado. Uma execução vazia comprova somente esse percurso.
4. **Funcionamento de negócio:** usar casos sintéticos e o ambiente apropriado do
   provedor para testar sucesso, rejeição, repetição, timeout, reconciliação e
   trilha de auditoria. Conferir o resultado no destino e no NAI.

Durante a validação atual, manter `ESOCIAL_TRANSMISSION_ENABLED=false` e
`ASO_CLIENT_EMAIL_SEND_ENABLED=false`. A instalação do certificado A1 e os testes
externos necessários continuam etapas próprias. Nenhuma tela deste monitor
declara o sistema homologado.

## Referências

- Implementação: `src/services/operational-runs.ts` e `src/lib/operational-status.ts`.
- Fronteira de leitura: `src/app/api/admin/operations/route.ts`.
- Regra de isolamento: `tests/rules/operational-evidence.test.ts`.
- [Linguagem de consulta do Cloud Logging](https://cloud.google.com/logging/docs/view/logging-query-language).
- [Gravações e merge no Firestore](https://firebase.google.com/docs/firestore/manage-data/add-data).
- Recuperação de arquivos e limites do exercício: `docs/BACKUP_RECOVERY.md`.
