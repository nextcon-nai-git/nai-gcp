# Conciliação e piloto SST

Primeira entrega das três melhorias da curadoria de 20/11/2026.

## Implementado

- Painel somente leitura na Esteira de ASOs, limitado explicitamente aos cards carregados.
- Contagens de recebimento, revisão e entrega vinculadas ao hash da mesma versão.
- Agendamento vencido sem realização comprovada não é classificado como falta.
- Simulador manual de probabilidade calibrada × minutos reservados. Não calcula uma probabilidade, não ordena casos clínicos, não dispara mensagens nem faz overbooking.
- Saída ergonômica com gate separado para qualidade dos dados, validação preditiva, explicações e aprovação profissional. Todos iniciam pendentes; uma saída gerada não constitui validação.

## Ainda não implementado / não comprovado

- Modelo local calibrado de faltas, experimento prospectivo ou redução demonstrada de faltas.
- Coleta persistente de tempo manual e painel longitudinal de métricas.
- Workflow persistente de aprovação das quatro dimensões para todos os cinco agentes.
- Publicação ou homologação visual autenticada em produção.

O painel não substitui as validações transacionais existentes no servidor. Hash correspondente demonstra vínculo de versão, não autenticidade de assinatura ou aptidão médica.

## Validação operacional proposta

Primeiro conciliar a realização e o documento com as fontes. A fila de contato deve usar apenas casos elegíveis, com prioridade clínica e prazos legais definidos fora do escore. Comparar com o fluxo atual: faltas por 100 agendamentos, minutos manuais por caso, dias até ASO validado e erros de vínculo. Separar ausência de informação de ausência confirmada. Não usar características protegidas para restringir acesso.

Para Ergonomia, usar amostra revisada por profissional e medir discordância e subestimação por tarefa e qualidade de captura. Validar explicações separadamente da acurácia. Não substituir AEP/AET ou decisão médica por pontuação automatizada.
