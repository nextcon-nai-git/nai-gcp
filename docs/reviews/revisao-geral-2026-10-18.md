# Revisão verificável do NAI — 18/10/2026

## Estado medido

A revisão não está em 100%. O inventário contém 591 arquivos TypeScript/TSX de implementação e 123,669 linhas físicas em `src`, além de 79 rotas de API e 110 páginas. Todos foram incluídos na varredura de arquivos; isso não significa leitura manual integral.

Suíte local: 1.786 testes em 193 arquivos passaram. Cobertura V8: 47,80% de linhas (9.999/20.918 instrumentadas), 47,01% de instruções, 42,36% de ramos e 38,83% de funções. Existem 287 arquivos com linhas instrumentadas e nenhuma linha executada. Linhas físicas e linhas instrumentadas são medidas diferentes.

TypeScript passou. A análise ESLint global terminou sem erros e com 1.291 avisos antes da remoção dos imports ociosos da página AVP nesta revisão. Os arquivos alterados foram conferidos separadamente. Nenhum limite de qualidade ou regra de acesso foi relaxado.

O JSON adjacente registra caminho, hash SHA-256, tamanho e cobertura por arquivo, incluindo explicitamente que revisão manual não foi afirmada. Não contém dados de clientes, documentos reais ou credenciais.

## Cobertura por diretório

| Diretório    | Arquivos | Linhas executadas/instrumentadas | Cobertura |
| ------------ | -------: | -------------------------------: | --------: |
| **tests**    |        1 |                              9/9 |    100.0% |
| actions      |       16 |                           70/391 |     17.9% |
| ai           |       44 |                          422/659 |     64.0% |
| app          |      208 |                        1836/6772 |     27.1% |
| components   |      119 |                        1825/5565 |     32.8% |
| contexts     |        1 |                            43/45 |     95.6% |
| firebase     |       14 |                          109/227 |     48.0% |
| hooks        |        8 |                           67/351 |     19.1% |
| lib          |      124 |                        3587/4282 |     83.8% |
| repositories |        3 |                             0/33 |      0.0% |
| scripts      |        2 |                             0/37 |      0.0% |
| services     |       45 |                        2019/2496 |     80.9% |
| styles       |        1 |                             0/33 |      0.0% |
| types        |        5 |                            12/18 |     66.7% |

## Correções desta rodada

- PR #147: tarefas por obrigação até entrega e recebimento; aditivos preservam serviços vigentes; sugestões separadas para consolidação explícita; IDs duplicados rejeitados antes da prévia; instruções v1.1. Integrada em `1e8cbee` após CI, Security e Firebase validation aprovados.
- AVP: paginação por ID estável, sem indisponibilizar o acervo em 3.001 registros; toda a consulta é carregada antes de calcular totais. Quantidades desconhecidas são exibidas separadamente. CSV monetário usa duas casas e vírgula decimal. PDFs aceitam nomes humanos seguros e preservam o nome no download. Abas seguem a mesma autorização da API. Corpos de requisição são limitados durante a leitura, inclusive multipart.
- SOC: publicação das convocações usa transação com comparação do ponteiro inicial; cada importação possui ID próprio e histórico, mesmo com hash repetido. O sucesso de gravação permanece visível quando a releitura falha. Operação somente leitora não recebe controle de importação.
- SOC carteira: JSON legado sem resumos preserva os anteriores; datas com fuso inválido são recusadas; cabeçalhos duplicados são rejeitados; nomes de empresas ambíguos bloqueiam o layout sem código único. Importações de clientes sucessivos compõem a prévia vigente, identificada como ainda não publicada.
- ASO: agendamento e clínica carregam seus módulos sob demanda.

## Pendências comprovadas

- Homologar a extração de contratos e persistência dos cards na versão publicada. A Central acessada nesta rodada estava vazia; contratos anteriores não aparecem automaticamente nela.
- Conector SOC: confirmar credenciais e consulta real NAI → SOC. Importação de CSV não comprova sincronização automática.
- Ampliar cobertura dos arquivos abaixo e das integrações, com casos de sucesso, falha, concorrência e perfis. Cobertura numérica não substitui validação operacional.
- Tratar os avisos de lint existentes por módulo e revisar dependências conforme os relatórios de segurança.
- Senior, TOTVS e sincronização offline ainda apresentam CONFIGURATION_REQUIRED/501. A revisão não os considera integrações concluídas.
- Executar homologação funcional das 110 páginas e cenários de acesso, não apenas abertura de telas. Não declarar conclusão com base no build.

## Maiores arquivos sem execução na suíte atual

| Arquivo                                                   | Linhas instrumentadas |
| --------------------------------------------------------- | --------------------: |
| `src/components/clients/grupo-avp-queue-map.tsx`          |                   332 |
| `src/app/clients/page.tsx`                                |                   293 |
| `src/components/financial/ledger-workspace.tsx`           |                   180 |
| `src/app/employees/page.tsx`                              |                   161 |
| `src/app/ppe-management/page.tsx`                         |                   144 |
| `src/app/client-center/page.tsx`                          |                   126 |
| `src/components/aso/scheduling-workspace.tsx`             |                   120 |
| `src/app/ppe-kiosk/page.tsx`                              |                   118 |
| `src/components/layout/top-nav.tsx`                       |                   118 |
| `src/components/ui/sidebar.tsx`                           |                   117 |
| `src/app/cassi-billing/page.tsx`                          |                   115 |
| `src/app/field-inspection/page.tsx`                       |                   115 |
| `src/services/avp-sheet-sync.ts`                          |                   113 |
| `src/components/financial/balance-workspace.tsx`          |                   104 |
| `src/app/audits/page.tsx`                                 |                   103 |
| `src/app/absenteeism/page.tsx`                            |                   101 |
| `src/app/api/ai-classify-document/route.ts`               |                    98 |
| `src/components/clients/grupo-avp-credenciamento-hub.tsx` |                    97 |
| `src/lib/integrations/rd-conversas-webhook.ts`            |                    97 |
| `src/app/integrations/soc/page.tsx`                       |                    95 |
