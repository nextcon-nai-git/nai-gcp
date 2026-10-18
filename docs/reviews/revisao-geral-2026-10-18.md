# Revisão verificável do NAI — 18/10/2026

## Estado medido

A revisão não está em 100%. O inventário contém 593 arquivos TypeScript/TSX de implementação e 122,061 linhas físicas em `src`, além de 79 rotas de API e 110 páginas. Todos foram incluídos na varredura de arquivos; isso não significa leitura manual integral.

Suíte local: 2,023 testes em 214 arquivos passaram. Cobertura V8: 52.61% de linhas (10,887/20,692 instrumentadas), 51.75% de instruções, 46.51% de ramos e 43.17% de funções. Existem 257 arquivos com linhas instrumentadas e nenhuma linha executada. Linhas físicas e linhas instrumentadas são medidas diferentes.

TypeScript passou. A análise ESLint global terminou sem erros e com 1.291 avisos antes da remoção dos imports ociosos da página AVP nesta revisão. Os arquivos alterados foram conferidos separadamente. Nenhum limite de qualidade ou regra de acesso foi relaxado.

O JSON adjacente registra caminho, hash SHA-256, tamanho e cobertura por arquivo, incluindo explicitamente que revisão manual não foi afirmada. Não contém dados de clientes, documentos reais ou credenciais.

## Cobertura por diretório

| Diretório      | Arquivos | Linhas executadas/instrumentadas | Cobertura |
| -------------- | -------: | -------------------------------: | --------: |
| `__tests__`    |        1 |                              9/9 |    100.0% |
| `actions`      |       16 |                           70/391 |     17.9% |
| `ai`           |       44 |                          422/659 |     64.0% |
| `app`          |      208 |                        1881/6628 |     28.4% |
| `components`   |      119 |                        2331/5398 |     43.2% |
| `contexts`     |        1 |                            45/47 |     95.7% |
| `firebase`     |       14 |                          151/230 |     65.7% |
| `hooks`        |        9 |                          160/390 |     41.0% |
| `lib`          |      125 |                        3615/4308 |     83.9% |
| `repositories` |        3 |                            48/48 |    100.0% |
| `scripts`      |        2 |                             0/37 |      0.0% |
| `services`     |       45 |                        2143/2496 |     85.9% |
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

## Revisão clínica, sessões e diretório de empresas

- PR #150 integrado em `fb6d00c`; PR #151 integrado em `7f3da91`. Ambos tiveram CI, Security, Firebase validation e rollout App Hosting aprovados. O hook de documento limpa a leitura ao trocar a assinatura; os repositórios preservam IDs reais e impedem sobrescrita na criação com ID explícito.
- PR #152 integrado em `e2990b3` após CI, Security e Firebase validation aprovados: autorização do histórico clínico exige empresa própria ou explicitamente atendida. Coleções clínicas raiz deixam de herdar a regra operacional; novos atendimentos vinculam paciente existente, autor autenticado e datas impostas pelo servidor. Regras impedem alteração/exclusão direta, dados fora do escopo, linhas de cuidado inválidas e criação em empresa excluída, inclusive em lote. O índice `companyId`/`timestamp` foi incluído. São 37 novos cenários no emulador.
- O COREN fixo foi removido. O profissional deve informar seu registro; isso não equivale a validação externa no conselho. A UI confirma gravação somente após a resposta e limpa o paciente ao mudar a unidade. Não houve alteração de registros reais.
- As telas antigas de PEP estruturado, evolução e psicossocial usavam dados vazios ou números fixos. Agora explicitam as integrações ausentes, sem simular auditoria, notificações, assinatura ou transmissão ao eSocial. A consulta de enfermagem mostra até 200 registros com data de recebimento do servidor; registros legados sem essa data requerem revisão própria.
- Livro Diário: testes reproduziram exposição do livro anterior durante a troca de conta, estado inadequado após logout e consultas iniciadas por uma importação que terminou após a saída. A interface é recriada por sessão e ignora a continuação obsoleta da importação. Doze testes de telas financeiras incluem erro de API, resposta atrasada e revogação do PDF.
- Diretório de empresas: consultas restritas usam somente os IDs autorizados, em lotes de até 30. A interface aguarda todos os lotes, preserva falhas sem divulgar resultados parciais e elimina respostas da conta anterior. A navegação e o formulário clínico usam essa fonte; o seletor não promove cadastros locais sem persistência a unidades operacionais. A opção global só aparece no escopo global. Nove regressões cobrem assinaturas, troca de conta, revogação, falha parcial e limite de lote.
- PGR: 10 dos 13 cenários novos falhavam antes da correção. A consulta agora isola a primeira renderização por conta, empresa e tipo de coleção; cancela leituras anteriores e não inicia uma requisição quando as credenciais só terminam após a saída. Uma resposta antiga não sobrepõe atualização mais recente. Erros de consulta e respostas malformadas são exibidos; a notificação de alteração de card só ocorre após persistência confirmada.
- Revisão do PR #153: Operações central conserva o diretório geral sem receber o indicador de acesso clínico global. Seis regressões incluem tenantId sem companyId e revogação de escopo. O seletor usa uma capacidade específica de navegação, separada do acesso clínico/administrativo.
- Publicação de regras e índices é separada do rollout do site. A integração de código e o build não comprovam que as regras propostas estejam ativas em produção.

## Anexos e confirmação de gravação

- O upload não converte falhas do Storage em URLs locais `blob:`/`data:`. A lista e a confirmação aguardam tanto o armazenamento quanto a gravação do vínculo. Falhas mantêm a lista anterior e permitem nova tentativa.
- Caminhos seguem os namespaces já previstos nas regras: `clientes/{companyId}/colaboradores/{employeeId}` e `internos_nextcon/colaboradores/{employeeId ou draft UUID}`. Não há empresa padrão `c1` nem diretório temporário compartilhado. Formatos aceitos: PDF, PNG e JPG, arquivos não vazios e estritamente menores que 10 MiB.
- A interface isola operações por conta, empresa e colaborador, ignora uploads concluídos depois da saída e bloqueia operações duplicadas. Alterações imediatas usam `arrayUnion`/`arrayRemove`, sem substituir os demais anexos no servidor. `updateDoc` evita recriar uma ficha excluída.
- No formulário NXC, um arquivo enviado fica preparado até salvar o colaborador. A ficha aguarda a gravação e permanece aberta em caso de falha; salvar/fechar é bloqueado durante o envio. Cada abertura reinicializa os dados do colaborador escolhido. A mensagem não promete transmissão ao eSocial.
- 17 testes do componente cobrem falhas de upload, obtenção de URL e metadados, confirmação pendente, remoção, tamanho/tipo, empresa ausente, rascunho, troca de conta/colaborador, duplicidade e somente leitura. As páginas consumidoras ainda exigem homologação funcional; não se presume cobertura integral por esses testes.
- Remover um vínculo não exclui o objeto armazenado. Uploads cuja vinculação falha e rascunhos abandonados podem deixar objetos sem vínculo; limpeza requer política de retenção e autorização próprias. URLs locais legadas não são recuperadas automaticamente.
- A tentativa autorizada de publicação de regras/índices, workflow #380 (`39124531480`), passou testes/build e falhou antes do deploy: `FIREBASE_SERVICE_ACCOUNT_JSON ausente ou inválido`. É necessário corrigir a credencial no GitHub Actions. O rollout do site de #153 foi concluído; isso não comprova publicação das regras/índices.

## Verificação em produção

Os 51 destinos únicos do menu abriram com título de página e sem erro de carregamento no momento da captura. Essa inspeção é de navegação, não homologação das 110 páginas nem de todas as operações. Doze telas ainda exibiam carregamento de dados na primeira captura; Central e SOC foram conferidos novamente após o carregamento.

A Central publicou instruções v1.1 e o formulário de obrigações individuais. Continuava sem registros. O AVP publicou a indicação de quantidades desconhecidas separadas dos exames confirmados. Nenhum registro real foi criado, alterado ou excluído; nenhuma comunicação externa foi enviada.

A revisão visual encontrou números fixos no mapa AVP e seis entregas do workshop marcadas no código como concluídas. As correções do PR #150 foram confirmadas em produção: o mapa passou a usar as contagens da fila e o roteiro iniciou com 0 de 9 conferências locais. A persistência do roteiro do workshop não foi implementada; a tela agora identifica suas marcações como locais.

O rollout do PR #152 também foi confirmado. O formulário publicado exige informar COREN e a consulta explicita seu limite e a ausência de transmissão ao eSocial. A aba PEP declara que a consulta estruturada ainda não está conectada; não presume ausência de histórico. Nenhum formulário clínico foi enviado.

## Pendências comprovadas

- Publicar e verificar as regras e o índice clínico propostos. A ampliação de acesso clínico de perfis explicitamente vinculados deve passar pela confirmação exigida no fluxo de publicação.
- Implementar as fontes e fluxos reais ainda ausentes de PEP estruturado, evolução, assinatura/retificação e avaliação psicossocial; as mensagens de indisponibilidade não representam entrega dessas funções.
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
| `src/app/employees/page.tsx`                              |                   162 |
| `src/app/ppe-management/page.tsx`                         |                   144 |
| `src/app/client-center/page.tsx`                          |                   126 |
| `src/components/aso/scheduling-workspace.tsx`             |                   120 |
| `src/app/ppe-kiosk/page.tsx`                              |                   118 |
| `src/components/ui/sidebar.tsx`                           |                   117 |
| `src/app/cassi-billing/page.tsx`                          |                   115 |
| `src/app/field-inspection/page.tsx`                       |                   115 |
| `src/app/audits/page.tsx`                                 |                   103 |
| `src/app/absenteeism/page.tsx`                            |                   101 |
| `src/components/clients/grupo-avp-credenciamento-hub.tsx` |                    97 |
| `src/lib/integrations/rd-conversas-webhook.ts`            |                    97 |
| `src/app/integrations/soc/page.tsx`                       |                    95 |
| `src/app/whatsapp-hub/page.tsx`                           |                    91 |
| `src/app/financial/omie/page.tsx`                         |                    90 |
| `src/app/nxc-team/page.tsx`                               |                    84 |
| `src/components/dashboard/executive-dashboard.tsx`        |                    84 |
| `src/app/clients/cassi/page.tsx`                          |                    83 |
| `src/components/commercial/nai-floating-widget.tsx`       |                    82 |
