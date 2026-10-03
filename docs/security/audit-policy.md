# Política de auditoria e exportação de dados sensíveis

## Objetivo

Registrar toda ação relevante sobre documentos, relatórios e dados de saúde para permitir rastreabilidade, investigação e conformidade.

## Eventos que devem ser registrados

Todo evento de acesso ou modificação deve gerar log com os campos mínimos abaixo:

- `eventId`
- `tenantId` ou `companyId`
- `userId`
- `actorRole`
- `actorEmail`
- `resourceType`
- `resourceId`
- `action` (`view`, `edit`, `export`, `download`, `delete`, `restore`)
- `timestamp`
- `sourceIp`
- `userAgent`
- `result` (`success`, `denied`, `error`)
- `reason` (quando aplicável)

## Regras de auditoria

### 1. Leitura sensível

- Qualquer leitura de laudo, ASO, documento médico ou relatório deve gerar log.
- A auditoria deve registrar o tipo de dado e o papel do usuário.

### 2. Exportação

- Exportação para PDF, CSV ou download deve ser tratada como evento crítico.
- O log deve identificar o destinatário da exportação, se aplicável.
- O sistema deve exigir justificativa quando a operação for excepcional.

### 3. Alteração

- Alterações em dados sensíveis devem registrar antes/depois ou hash do documento, quando possível.
- Operações administrativas de correção devem ser auditadas separadamente.

### 4. Exclusão

- Exclusões devem gerar log com informações do responsável e do motivo.
- Para documentos sensíveis, o uso de soft delete é recomendado antes da exclusão definitiva.

## Regras de armazenamento de auditoria

- Os logs devem ser armazenados em um conjunto de dados separado do principal.
- O armazenamento deve ser imutável ou difícil de adulterar.
- A retenção de auditoria deve seguir política interna e validação jurídica.
- Os logs devem ser exportáveis para monitoramento centralizado.

## Exportação de arquivos

- Arquivos de saúde e documentos sensíveis não devem ser compartilhados por links permanentes.
- A geração de URL pública ou temporária deve ser restrita e registrada.
- Links temporários devem ter TTL curto e revogação automática.
- O backend deve registrar cada solicitação de download ou visualização.

## Monitoramento e alertas

Devem ser gerados alertas para:

- downloads em massa
- exportação fora do horário normal
- acesso de usuário sem vínculo com a empresa correta
- tentativa repetida de acesso a dados sem autorização
- alteração de documentos críticos sem razão válida

## Recomendação final

A auditoria é parte essencial do controle de dados de saúde. Sem logs de acesso e exportação, não há tracabilidade suficiente para a operação ou para a resposta a incidentes.
