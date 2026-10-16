# Painel operacional SOC

A rota `/integrations/soc` apresenta o levantamento administrativo dos clientes ativos, pedidos de processamento e etapas observadas no Maestro. As consultas diretas do conector permanecem em uma seção separada, com escopo e atualização independentes.

## Evidência e limites

- O levantamento é uma fotografia datada de uma consulta manual, não uma sincronização em tempo real. Recarregar o painel lê a versão persistida no NAI; não consulta o SOC.
- Um pedido disponível para download não comprova a existência nem a quantidade de pendências. Os indicadores de ASOs vencidos, vencendo e parados permanecem desconhecidos até a leitura e conciliação dos relatórios.
- “Sem resultado” aplica-se exclusivamente ao escopo e período daquele pedido. Não significa ausência de pendências da empresa.
- Empresas são identificadas pelo código SOC. Nomes iguais não são deduplicados; as unidades de uma empresa não são contadas como clientes independentes.
- Não há envio de mensagens, escrita no SOC/RM, agendamento automático ou conclusão clínica neste painel.

## Publicação dos dados

O repositório contém apenas implementação e testes sintéticos. Nunca adicionar listas reais de clientes, processos, prontuários, documentos pessoais ou credenciais ao Git ou ao bundle do navegador.

Um administrador interno usa **Publicar levantamento verificado**, seleciona um JSON conforme `socDashboardSchema` (`src/lib/integrations/soc-dashboard.ts`), revisa a prévia e publica. O schema é estrito, limita tamanho e quantidade, valida datas, códigos únicos, períodos e estados dos pedidos. Apenas nomes e códigos das empresas ativas devem ser incluídos; remover CPF/CNPJ eventualmente embutidos em nomes. Não enviar conteúdo nominal de relatórios neste formato.

Campos do JSON:

| Campo                 | Conteúdo                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `schemaVersion`       | `1`                                                                         |
| `source`              | `SOC · consulta manual`                                                     |
| `observedAt`          | Timestamp ISO com fuso da consulta efetiva                                  |
| `dueSoonEnd`          | Prazo-alvo `AAAA-MM-DD`; não presume que o relatório já tenha sido filtrado |
| `inactiveExcluded`    | Quantidade de empresas inativas excluídas                                   |
| `activeCompanies`     | Lista de `{id, name}` com códigos SOC únicos                                |
| `reports`             | Lista de pedidos conforme formato abaixo                                    |
| `administrativeTasks` | Lista de `{id, company, task}` com processos únicos                         |
| `limitation`          | Ressalva sobre cobertura e pendências de leitura, até 400 caracteres        |

Cada pedido contém `id`, `title`, `category` (`convocation`, `attendance`, `documents`, `esocial`, `registration`, `exams`), `status` (`ready`, `scheduled`, `empty`), `scope`, `periodStart`, `periodEnd`, `scheduledFor` e `note`. Datas usam `AAAA-MM-DD`; ausência de período ou agendamento usa `null`. `scheduledFor` é obrigatório somente para `scheduled`. `ready` significa disponível no SOC com conteúdo ainda não lido.

## Proteção e persistência

`GET /api/integrations/soc/dashboard`: token Firebase verificado e acesso SOC interno (`SUPER_ADMIN` ou `ADMIN/OPERATIONS` sem tenant de cliente). `PUT` exige administrador interno. Os dados ficam em `webhook_deliveries/soc-dashboard`, coleção excluída das regras genéricas de leitura e escrita pelo SDK cliente. A API Admin aplica autorização antes de acessar o documento; todas as respostas usam `private, no-store` e `Vary: Authorization`.

A gravação registra ator, horário do servidor e uma versão aleatória. Uma transação exige `expectedVersion` e rejeita substituição por uma observação mais antiga. Uma falha de armazenamento aparece como erro, nunca como ausência de pendências. Não ampliar as regras Firestore nem inserir dados via bundle para contornar um erro de acesso.

## Validação

Os testes de schema e API cobrem autorização, isolamento de clientes, leitura sem permissão de publicação, limite de corpo, validação, concorrência, regressão de data e indicadores desconhecidos. São validações de código; não comprovam leitura dos arquivos SOC ou funcionamento do conector em produção. Após publicar o aplicativo, importar o levantamento pela sessão autorizada, recarregar e verificar os dados persistidos, busca e filtros no ambiente publicado.
