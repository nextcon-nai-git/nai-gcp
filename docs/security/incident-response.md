# Plano de resposta a incidentes

## Objetivo

Definir o processo de identificação, contenção, investigação, recuperação e comunicação de incidentes envolvendo dados sensíveis.

## Escopo

Este plano cobre:

- acesso não autorizado
- vazamento de dados
- exportação indevida
- perda ou alteração de documentos sensíveis
- falha de autenticação ou autorização
- incidente em pipeline ou credencial exposta

## Processo

### 1. Detecção

- alertas de monitoramento
- logs de auditoria
- alertas de acesso anormal
- falhas de regras de acesso

### 2. Classificação

Classificar pela severidade:

- baixa: falha operacional sem impacto em dados sensíveis
- média: acesso indevido limitado ou erro funcional
- alta: vazamento parcial de dado sensível ou exportação indevida
- crítica: exposição ampla de dados de saúde ou falha de controle de tenant

### 3. Contenção

- bloquear o usuário ou serviço afetado
- revogar token, sessão ou credencial
- desativar links temporários
- isolar o sistema ou o recurso afetado
- reverter alteração indevida

### 4. Investigação

- confirmar alcance e escopo
- checar impacto por empresa/tenant
- analisar logs e eventos de auditoria
- identificar se houve acesso cruzado

### 5. Recuperação

- restaurar configuração correta
- restaurar dados ou registros afetados
- validar regras de acesso após recuperação
- executar testes de segurança novamente

### 6. Comunicação

- notificar a liderança interna
- informar responsável do cliente/contrato, quando exigido
- notificar jurídico/DPO conforme a legislação e o contrato
- registrar o caso e a ação corretiva

## Responsabilidade

- desenvolvimento: correção técnica e validação
- segurança: análise e classificação
- operação: contenção e monitoramento
- jurídico / DPO: comunicação e acompanhamento regulatório

## Recomendação final

Qualquer incidente com dados sensíveis deve ser tratado como prioritário, com contenção imediata, rastreabilidade completa e comunicação formal quando necessário.
