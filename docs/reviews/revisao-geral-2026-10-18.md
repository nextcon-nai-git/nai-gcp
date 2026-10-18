# Revisão verificável do NAI — 18/10/2026

## Estado medido

A revisão não está em 100%. O inventário contém 594 arquivos TypeScript/TSX de implementação e 122,065 linhas físicas em `src`, além de 79 rotas de API e 110 páginas. Todos foram incluídos na varredura de arquivos; isso não significa leitura manual integral.

Suíte local: 2,219 testes em 231 arquivos passaram. Cobertura V8: 60.22% de linhas (12,505/20,765 instrumentadas), 59.13% de instruções, 53.37% de ramos e 50.65% de funções. Existem 233 arquivos com linhas instrumentadas e nenhuma linha executada. Linhas físicas e linhas instrumentadas são medidas diferentes.

TypeScript e ESLint global passaram, sem erros; os avisos preexistentes de lint continuam registrados como pendência. Nenhuma exclusão de cobertura foi acrescentada. O mínimo de cobertura de linhas exigido no CI subiu de 30% para 60%; as regras de acesso do servidor não foram ampliadas.

O JSON adjacente registra caminho, hash SHA-256, tamanho e cobertura por arquivo, incluindo explicitamente que revisão manual não foi afirmada. Não contém dados de clientes, documentos reais ou credenciais.

## Cobertura por diretório

| Diretório      | Arquivos | Linhas executadas/instrumentadas | Cobertura |
| -------------- | -------: | -------------------------------: | --------: |
| `__tests__`    |        1 |                              9/9 |    100.0% |
| `actions`      |       16 |                          188/385 |     48.8% |
| `ai`           |       44 |                          424/659 |     64.3% |
| `app`          |      208 |                        2859/6665 |     42.9% |
| `components`   |      119 |                        2656/5435 |     48.9% |
| `contexts`     |        1 |                            45/47 |     95.7% |
| `firebase`     |       14 |                          151/230 |     65.7% |
| `hooks`        |        9 |                          247/390 |     63.3% |
| `lib`          |      126 |                        3723/4313 |     86.3% |
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
- 33 testes do componente cobrem falhas de upload, obtenção de URL e metadados, confirmação pendente, remoção, tamanho/tipo, empresa ausente, rascunho, troca de conta/colaborador, duplicidade, somente leitura e atualização concorrente de anexos e interseção de permissões por perfil. As páginas descartam formulários e fichas abertas ao mudar de conta. As páginas consumidoras ainda exigem homologação funcional; não se presume cobertura integral por esses testes.
- Revisão do PR #154: controles de escrita exigem a interseção das permissões do Storage e da ficha. Perfis clínicos, CLIENT_ADMIN e Operações no dossiê de cliente não podem iniciar uploads que seriam recusados nos metadados. Dossiês de clientes e NXC bloqueiam fechamento durante a vinculação; abas do dossiê de cliente também ficam bloqueadas. As regras do servidor continuam sendo a autoridade; não foram ampliadas.
- Remover um vínculo não exclui o objeto armazenado. Uploads cuja vinculação falha e rascunhos abandonados podem deixar objetos sem vínculo; limpeza requer política de retenção e autorização próprias. URLs locais legadas não são recuperadas automaticamente.
- A tentativa autorizada de publicação de regras/índices, workflow #380 (`39124531480`), passou testes/build e falhou antes do deploy: `FIREBASE_SERVICE_ACCOUNT_JSON ausente ou inválido`. É necessário corrigir a credencial no GitHub Actions. O rollout do site de #153 foi concluído; isso não comprova publicação das regras/índices.

## Marco de 60% — continuidade após o PR #154

- Base da rodada: `516f22c73f0eb0c7eee2787c0f31943ba8d3d967`, com 2.039 testes em 214 arquivos e 52,60% de cobertura de linhas. Foram acrescentados 180 testes em 17 arquivos, mantendo a seleção de fontes do V8. O percentual mede execução de linhas instrumentadas, não conclusão da revisão manual nem homologação de produção.
- Consultas de CEP e CNPJ deixam de inventar endereço, empresa, contato e situação ativa quando todos os provedores falham. Índices econômicos deixam de completar a resposta com valores fixos apresentados como atuais; retorno vazio, inválido ou indisponível gera falha explícita. As heurísticas existentes de grau de risco/SESMT/CIPA e inferência de website ainda exigem revisão própria: esta rodada não as valida como enquadramento técnico.
- Clientes: a lista usa somente os cadastros persistidos no escopo consultado, sem misturar o cache global do navegador. Exclusão e ativação aguardam persistência; falhas não geram sucesso. Atualizar situação não recria empresa excluída. Novos cadastros deixam de receber conformidade fixa de 100%; a sincronização preserva os registros existentes. Foram mantidas as autoridades de acesso do servidor.
- Colaboradores: o arquivamento otimista identifica empresa e colaborador juntos; IDs iguais em empresas diferentes não ocultam a outra ficha. NXC inicia e exibe ASO sem informação como PENDENTE, remove a conformidade eSocial fixa e ignora confirmação de gravação recebida após trocar de conta.
- Central, relatórios, faturamento mensal, Omie, SOC e agendamento: testes exercitam troca de conta/empresa, token atrasado, falhas e respostas antigas. As correções impedem as continuações identificadas depois da saída e bloqueiam envios duplicados. Operações já enviadas ao servidor não são desfeitas pela troca de sessão.
- Relatórios: PDF não vazio e inferior a 10 MiB; confirmação somente após upload e vínculo. Mudança de sessão/empresa interrompe a continuação do upload antes de gravar metadados. Objetos já armazenados podem ficar sem vínculo; limpeza continua dependente de política própria.
- Agendamento ASO: formulário começa sem empresa, função e riscos de exemplo. Erros são exibidos e liberam nova tentativa. Cópia de kit aguarda confirmação da área de transferência. O botão que apenas simulava resolver alertas fica desabilitado com a limitação explícita. As clínicas estáticas e os fluxos clínicos ainda não foram homologados por estes testes.
- Navegação: sidebar respeita estado controlado e tem título acessível no painel móvel. Testes adicionais cobrem busca de comandos, notificações, dashboard, riscos, auditorias e validação/autenticidade/deduplicação de webhooks RD Conversas.
- Evidência de regressão: 20 cenários direcionados foram executados contra os arquivos originais de `main` e todos falharam; os mesmos comportamentos passam com as correções. A suíte usa dados sintéticos e mocks de serviços externos e persistência: não comprova integrações reais nem realizou envio de e-mail ou alteração de registros reais.
- Regras/índices continuam com a pendência de credencial descrita abaixo. O rollout do aplicativo não será tratado como publicação de regras de segurança.
- Verificação final local: suíte completa com 2.219 testes aprovada, cobertura de linhas de 60,22%, Prettier, ESLint sem erros, TypeScript e build de produção aprovados. Os 594 hashes do inventário correspondem aos arquivos desta rodada.
- Autorização de integração: após o bloqueio inicial do envio pela revisão automática, o usuário autorizou explicitamente em 18/10/2026 enviar a revisão ao `nextcon-nai-git/nai-gcp`, abrir o PR e integrar/publicar após aprovação dos checks. A validação e o rollout remotos devem ser conferidos no commit final; a autorização não comprova sua conclusão.

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
| `src/app/ppe-management/page.tsx`                         |                   144 |
| `src/app/ppe-kiosk/page.tsx`                              |                   118 |
| `src/app/cassi-billing/page.tsx`                          |                   115 |
| `src/app/field-inspection/page.tsx`                       |                   115 |
| `src/app/absenteeism/page.tsx`                            |                   101 |
| `src/components/clients/grupo-avp-credenciamento-hub.tsx` |                    97 |
| `src/app/whatsapp-hub/page.tsx`                           |                    91 |
| `src/components/dashboard/executive-dashboard.tsx`        |                    84 |
| `src/app/clients/cassi/page.tsx`                          |                    83 |
| `src/components/commercial/nai-floating-widget.tsx`       |                    82 |
| `src/components/layout/top-nav.tsx`                       |                    80 |
| `src/app/developer/page.tsx`                              |                    75 |
| `src/components/clients/client-documents.tsx`             |                    70 |
| `src/app/action-plans/page.tsx`                           |                    69 |
| `src/app/agentes-ia/page.tsx`                             |                    65 |
| `src/app/checklists/page.tsx`                             |                    65 |
| `src/app/contracts/page.tsx`                              |                    63 |
| `src/components/ui/chart.tsx`                             |                    63 |
| `src/app/time-tracking/page.tsx`                          |                    61 |
| `src/components/kanban/kanban-board.tsx`                  |                    61 |
