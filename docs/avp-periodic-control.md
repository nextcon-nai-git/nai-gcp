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

## Validação

Testes cobrem deduplicação, filiais ambíguas, cidades/UF, preço de R$ 40, pacotes, contratos divergentes, acesso restrito, revogação e respostas antigas após troca de conta. O upload inicial foi conferido célula a célula contra a origem, sem divergências.
