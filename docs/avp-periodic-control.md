# Controle dos periódicos e da rede AVP

O painel interno de Grupo AVP cruza a campanha de 20/10 a 20/11/2026, a lista de prestadores fornecida, o histórico de valores AVP e o cadastro mestre NAI. A fila de agendamentos existente continua independente; esta consulta não cria agendamentos nem envia convocações.

## Fontes privadas

As três abas ficam na mesma planilha privada configurada em `AVP_SOURCE`. Os arquivos e dados pessoais não fazem parte do repositório.

| Aba                        | ID fixo    | Registros importados |
| -------------------------- | ---------- | -------------------: |
| Campanha Periódicos 2026   | 2026102001 |                1.979 |
| Prestadores NXC 2026       | 2026102002 |                  236 |
| Custos Observados AVP 2026 | 2026102003 |                  300 |

Os cabeçalhos são validados integralmente. A leitura usa as dimensões reais das abas e um limite de 10.000 registros por fonte. Cada registro mantém a linha original para conferência. As 1.979 linhas de campanha representam 1.972 pessoas por CPF + admissão; as sete repetições são preservadas na fonte. Cancelamentos e ressalvas permanecem visíveis e exigem revisão humana antes da convocação.

## Critérios de cruzamento

- CNPJ + município/UF identificam unidades; nomes só vinculam preços quando a correspondência é exata e única no município. Ambiguidades permanecem sem vínculo.
- Os rótulos de unidades Fortaleza ASCEC, ASSOBES e CEUDESP são agregados como município Fortaleza; a unidade do colaborador permanece disponível.
- Contrato ativo é uma informação da lista enviada. Encontrar cadastro NAI ou preço anterior não confirma contrato ativo nem disponibilidade para esta campanha.
- Preços mantêm serviço, data, evidência e ressalva. Pacotes não são divididos sem evidência de valor unitário. O menor ASO clínico exclui enquadramento PCD e pacotes.
- O filtro de negociação considera valores estritamente maiores que R$ 40; R$ 40 não dispara esse filtro. Valores históricos precisam de confirmação para o exame periódico.
- A lista enviada contém 219 identidades CNPJ/município. Unidades adicionais encontradas no histórico e no NAI são identificadas por origem.

## Acesso e operação

A API exige autenticação e o mesmo acesso interno de evidências AVP. Não retorna CPF, dados bancários nem credenciais. Respostas são privadas e sem cache. A troca de identidade descarta resultados anteriores; uma revogação 401/403 limpa a consulta. Falha temporária mantém a última consulta com erro e data explícitos.

A atualização é manual pelo botão do painel. A exportação CSV contém apenas o resumo de cobertura por município, com proteção contra fórmulas. Não altera prestadores, contratos, preços, fila existente ou permissões da planilha.

## Fila de trabalho dos periódicos

Na aba **Fila de trabalho**, cada participante consolidado gera um card de consulta sem criar agendamento. Os cards começam em **Validar convocação**, inclusive quando a fonte já diz “Agendado”. Cancelamentos, unidade ausente e duplicidades permitem atribuir a revisão, mas impedem avançar para convocação.

O operador registra responsável, data opcional da próxima ação e referência datada de evidência. O fluxo segue uma etapa por vez: validar → agendar → confirmar realização → resgatar/conferir ASO → conferir eSocial → concluído. A conclusão exige registro do recibo de aceitação ou justificativa documentada de não aplicabilidade. Os documentos e recibos não são verificados automaticamente: são evidências declaradas pelo operador, sujeitas a conferência. Não registrar diagnóstico, CPF ou credenciais nesses campos.

As ações ficam em `integrations/grupo-avp/periodic-work-2026`, cuja escrita direta pelo cliente já é negada nas regras de integrações. A API exige acesso interno AVP, valida a fonte novamente e usa transação com revisão para impedir sobrescrita concorrente. Estado e histórico são gravados juntos. Mudanças nos dados do participante, inclusive último exame, periodicidade e conferência, invalidam a liberação anterior e retornam o card para validação sem apagar o histórico. O painel exibe os 30 eventos de auditoria mais recentes por card.

Os filtros de cidade, responsável, etapa e próxima ação vencida organizam a revisão e o resgate. Prazos vencidos referem-se às datas escolhidas pelos operadores; não representam cálculo automático de infração ao eSocial. Nenhum responsável é inventado ou distribuído sem registro. A fonte permanece somente leitura; atualizações dos cards são próprias do NAI.

Esta entrega não ativa mensagens a terceiros, agenda em clínicas, transmissão ao eSocial ou integração contínua com SOC/RD. Esses passos exigem validação dos acessos e evidências nas fontes respectivas. A consulta é atualizada ao abrir a fila ou clicar em atualizar; não há tarefa agendada de sincronização nesta entrega.

## Validação

Testes cobrem deduplicação, filiais ambíguas, cidades/UF, preço de R$ 40, pacotes, contratos divergentes, acesso restrito, revogação e respostas antigas após troca de conta. O upload inicial foi conferido célula a célula contra a origem, sem divergências.
