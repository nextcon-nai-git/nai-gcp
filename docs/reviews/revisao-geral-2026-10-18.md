# Revisão verificável do NAI — 18/10/2026

## Estado medido

A revisão não está em 100%. O inventário contém 591 arquivos TypeScript/TSX de implementação e 123,040 linhas físicas em `src`, além de 79 rotas de API e 110 páginas. Todos foram incluídos na varredura de arquivos; isso não significa leitura manual integral.

Suíte local: 1,843 testes em 200 arquivos passaram. Cobertura V8: 49.68% de linhas (10,311/20,753 instrumentadas), 48.87% de instruções, 44.29% de ramos e 40.28% de funções. Existem 273 arquivos com linhas instrumentadas e nenhuma linha executada. Linhas físicas e linhas instrumentadas são medidas diferentes.

TypeScript passou. A análise ESLint global terminou sem erros e com 1.291 avisos antes da remoção dos imports ociosos da página AVP nesta revisão. Os arquivos alterados foram conferidos separadamente. Nenhum limite de qualidade ou regra de acesso foi relaxado.

O JSON adjacente registra caminho, hash SHA-256, tamanho e cobertura por arquivo, incluindo explicitamente que revisão manual não foi afirmada. Não contém dados de clientes, documentos reais ou credenciais.

## Cobertura por diretório

| Diretório      | Arquivos | Linhas executadas/instrumentadas | Cobertura |
| -------------- | -------: | -------------------------------: | --------: |
| `__tests__`    |        1 |                              9/9 |    100.0% |
| `actions`      |       16 |                           70/391 |     17.9% |
| `ai`           |       44 |                          422/659 |     64.0% |
| `app`          |      208 |                        1859/6677 |     27.8% |
| `components`   |      119 |                        1976/5486 |     36.0% |
| `contexts`     |        1 |                            43/45 |     95.6% |
| `firebase`     |       14 |                          124/227 |     54.6% |
| `hooks`        |        8 |                           67/351 |     19.1% |
| `lib`          |      124 |                        3597/4291 |     83.8% |
| `repositories` |        3 |                             0/33 |      0.0% |
| `scripts`      |        2 |                             0/37 |      0.0% |
| `services`     |       45 |                        2132/2496 |     85.4% |
| `styles`       |        1 |                             0/33 |      0.0% |
| `types`        |        5 |                            12/18 |     66.7% |

## Correções desta rodada

- PR #147: tarefas por obrigação até entrega e recebimento; aditivos preservam serviços vigentes; sugestões separadas para consolidação explícita; IDs duplicados rejeitados antes da prévia; instruções v1.1. Integrada em `1e8cbee` após CI, Security e Firebase validation aprovados.
- PR #149, integrado em `48fa6a9` após CI, Security, Firebase validation e testes RD Conversas aprovados. AVP: paginação por ID estável, sem indisponibilizar o acervo em 3.001 registros; toda a consulta é carregada antes de calcular totais. Quantidades desconhecidas são exibidas separadamente. CSV monetário usa duas casas e vírgula decimal. PDFs aceitam nomes humanos seguros e preservam o nome no download. Abas seguem a mesma autorização da API. Corpos de requisição são limitados durante a leitura, inclusive multipart.
- SOC: publicação das convocações usa transação com comparação do ponteiro inicial; cada importação possui ID próprio e histórico, mesmo com hash repetido. O sucesso de gravação permanece visível quando a releitura falha. Operação somente leitora não recebe controle de importação.
- SOC carteira: JSON legado sem resumos preserva os anteriores; datas com fuso inválido são recusadas; cabeçalhos duplicados são rejeitados; nomes de empresas ambíguos bloqueiam o layout sem código único. Importações de clientes sucessivos compõem a prévia vigente, identificada como ainda não publicada.
- ASO: agendamento e clínica carregam seus módulos sob demanda.

- Classificador legado: API retirada com resposta 410 autenticada e destino NAI importa; não lê nem encaminha o arquivo, não presume empresa ou data e não finge gravação. A entrada visual passa a encaminhar ao fluxo vigente com revisão e permissões clínicas.
- Uploads: leitura multipart limitada em análise/gravação PGR/NAI importa, documentos de clientes, balanços, livro diário e evidências AVP, inclusive sem Content-Length ou com valor menor que o corpo real.
- Indicadores AVP: totais fixos 86/88/44 substituídos por contagens da fila; marcações do workshop iniciam sem entregas presumidas e ficam claramente identificadas como conferência local, sem persistência.
- Novos testes da fonte AVP: lotes, lease, falha Google, versões idênticas, revisão concorrente, identidade de registros, atomicidade de alterações e auditoria sem valores pessoais.

## Verificação em produção

Os 51 destinos únicos do menu abriram com título de página e sem erro de carregamento no momento da captura. Essa inspeção é de navegação, não homologação das 110 páginas nem de todas as operações. Doze telas ainda exibiam carregamento de dados na primeira captura; Central e SOC foram conferidos novamente após o carregamento.

A Central publicou instruções v1.1 e o formulário de obrigações individuais. Continuava sem registros. O AVP publicou a indicação de quantidades desconhecidas separadas dos exames confirmados. Nenhum registro real foi criado, alterado ou excluído; nenhuma comunicação externa foi enviada.

A revisão visual encontrou números fixos no mapa AVP e seis entregas do workshop marcadas no código como concluídas. As correções estão nesta rodada. A persistência do roteiro do workshop não foi implementada; a tela agora identifica suas marcações como locais.

## Pendências comprovadas

- Homologar a extração de contratos e persistência dos cards na versão publicada. A Central acessada nesta rodada estava vazia; contratos anteriores não aparecem automaticamente nela.
- Conector SOC: a tela de produção confirmou **Configuração pendente** para empresas, colaboradores e ASOs. As chaves de Exporta Dados e o escopo autorizado são necessários. O painel exibido é uma consulta manual; não existe sincronização automática comprovada.
- Ampliar cobertura dos arquivos abaixo e das integrações, com casos de sucesso, falha, concorrência e perfis. Cobertura numérica não substitui validação operacional.
- Tratar os avisos de lint existentes por módulo e revisar dependências conforme os relatórios de segurança.
- Senior, TOTVS e sincronização offline ainda apresentam CONFIGURATION_REQUIRED/501. A revisão não os considera integrações concluídas.
- Executar homologação funcional das 110 páginas e cenários de acesso, não apenas abertura de telas. Não declarar conclusão com base no build.

## Maiores arquivos sem execução na suíte atual

| Arquivo                                                   | Linhas instrumentadas |
| --------------------------------------------------------- | --------------------: |
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
| `src/components/financial/balance-workspace.tsx`          |                   104 |
| `src/app/audits/page.tsx`                                 |                   103 |
| `src/app/absenteeism/page.tsx`                            |                   101 |
| `src/components/clients/grupo-avp-credenciamento-hub.tsx` |                    97 |
| `src/lib/integrations/rd-conversas-webhook.ts`            |                    97 |
| `src/app/integrations/soc/page.tsx`                       |                    95 |
| `src/app/whatsapp-hub/page.tsx`                           |                    91 |
| `src/app/financial/omie/page.tsx`                         |                    90 |
| `src/components/dashboard/executive-dashboard.tsx`        |                    84 |
