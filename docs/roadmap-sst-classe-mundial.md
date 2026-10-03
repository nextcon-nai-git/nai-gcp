# Plano de evolução da plataforma de Saúde e Segurança do Trabalho

## 1. Objetivo e limites

Este documento descreve uma evolução técnica e operacional para transformar a plataforma em um sistema de SST confiável, interoperável, auditável e orientado à prevenção. A expressão “classe mundial” é tratada aqui como um conjunto de capacidades verificáveis — e não como uma alegação comercial ou comparação com fornecedores.

O sistema deve apoiar profissionais habilitados, trabalhadores e gestores, sem substituir julgamento clínico, responsabilidade técnica, consulta aos trabalhadores ou interpretação jurídica. Regras regulatórias precisam ser versionadas e validadas por responsáveis de SST antes de entrar em produção.

## 2. Referenciais verificáveis

O desenho deve manter rastreabilidade entre requisito, regra implementada, evidência e versão da fonte:

- **GRO/PGR e participação dos trabalhadores:** a [NR-1 vigente e seus materiais oficiais](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadoras/normas-regulamentadoras-vigentes/nr-1) orientam o gerenciamento de riscos ocupacionais. A página do MTE também distingue o texto aplicável por data de vigência; portanto, o motor normativo não pode usar uma regra sem período de validade.
- **Eventos de SST:** o [Manual Web Geral/SST do eSocial](https://www.gov.br/esocial/pt-br/empresas/manual-web-geral) identifica S-2210, S-2220 e S-2240 e explica suas finalidades. Leiautes, tabelas e notas técnicas devem ser tratados como dependências versionadas, e não codificados somente na interface.
- **Sistema de gestão:** a [ISO 45001:2018](https://www.iso.org/standard/63787.html) especifica requisitos para um sistema de gestão de saúde e segurança ocupacional; as [diretrizes ILO-OSH 2001](https://www.ilo.org/publications/guidelines-occupational-safety-and-health-management-systems-ilo-osh-2001) organizam política, planejamento, implementação, avaliação e melhoria contínua.
- **Privacidade:** a [ANPD esclarece que dados referentes à saúde são dados pessoais sensíveis](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes). Todo fluxo deve registrar finalidade, hipótese legal, necessidade, acesso, retenção e descarte.
- **Interoperabilidade clínica:** o [HL7 FHIR](https://hl7.org/fhir/overview.html) define recursos e interfaces para troca estruturada de informações de saúde. A adoção deve usar perfis brasileiros aplicáveis e preservar os requisitos próprios de SST/eSocial.
- **Acessibilidade:** a [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/) é um padrão internacional estável para tornar conteúdo web acessível.

## 3. Leitura do estado atual do repositório

A base já contempla módulos de PGR, PCMSO, planos de ação, auditoria de eSocial, atendimento médico, treinamentos e controle de EPI. Há também autenticação Firebase, regras de segregação por empresa e esquemas Zod iniciais.

Antes de uso produtivo, porém, é necessário eliminar diferenças entre demonstração e operação real:

- o painel principal ainda apresenta valores e séries simuladas;
- o modelo de risco registra perigo e medidas de controle, mas ainda não representa de ponta a ponta fonte, exposição, pessoas expostas, método de avaliação, hierarquia de controles, risco residual, responsáveis, evidências e histórico;
- autorização por papel existe, mas o acesso a saúde precisa de granularidade por finalidade e relação assistencial, além de trilha de leitura;
- a política de segurança menciona retenção, resposta a incidente e revisão de acesso como documentação complementar, mas esses controles precisam virar processos executáveis e testados;
- a cobertura automatizada existente não demonstra, sozinha, segurança clínica, isolamento entre empresas, conformidade de eventos ou continuidade operacional.

## 4. Capacidades de produto

### 4.1 Núcleo único de pessoas, estabelecimentos e exposições

Criar um modelo canônico temporal, com identificadores imutáveis e histórico efetivo (`validFrom`, `validTo`, autor e origem), para:

- empresa, estabelecimento, setor, ambiente, cargo, função, atividade e grupo homogêneo de exposição;
- trabalhador, vínculo, lotação, mudança de função e afastamento;
- perigo, fonte, possível lesão/agravo, exposição, avaliação qualitativa ou quantitativa e responsável técnico;
- EPC, medida administrativa e EPI, vinculados à hierarquia de controles;
- exame, procedimento, ASO, restrição, aptidão e encaminhamento, com separação entre informação clínica e informação liberada ao empregador;
- acidente, incidente, quase acidente, doença relacionada ao trabalho e investigação;
- treinamento, competência, validade e evidência de participação.

Cada alteração relevante deve produzir nova versão, jamais sobrescrever silenciosamente a evidência usada em um documento ou evento já emitido.

### 4.2 GRO/PGR como ciclo contínuo

Transformar o cadastro de riscos em um fluxo operacional:

1. identificar perigos com participação dos trabalhadores;
2. caracterizar exposição e pessoas potencialmente afetadas;
3. avaliar risco inerente com método explicitamente identificado e versionado;
4. selecionar controles pela hierarquia (eliminação, substituição, engenharia, administrativos e EPI);
5. gerar plano com responsável, prazo, orçamento, dependências e critério de aceite;
6. anexar evidência da implantação e verificar eficácia;
7. calcular risco residual somente com dados aprovados;
8. revisar após mudanças, incidentes ou nos gatilhos definidos pelo processo aplicável.

O inventário de riscos e o plano de ação devem ser visões do mesmo conjunto de dados. Mapas, matriz de risco e indicadores precisam permitir chegar à evidência de origem, sem apresentar uma cor ou número como conclusão autossuficiente.

### 4.3 Saúde ocupacional com segurança clínica

- Agenda PCMSO baseada em risco, função, periodicidade aplicável e histórico, com fila de pendências e reconciliação.
- Prontuário segregado: empregador visualiza apenas a informação necessária ao processo ocupacional; notas, resultados e hipóteses clínicas ficam restritos à equipe autorizada.
- Dupla checagem para identidade, exame, trabalhador e vínculo antes da emissão do ASO.
- Assinatura digital verificável, carimbo do tempo, hash do documento e cadeia de custódia.
- Alertas de resultado crítico com confirmação de recebimento, escalonamento e protocolo definido pelo responsável clínico.
- Conciliação entre riscos do PGR, exames do PCMSO e eventos S-2220/S-2240, exibindo divergências sem alterar decisões clínicas automaticamente.
- Exportação estruturada por perfis FHIR quando houver integração clínica, mantendo minimização de dados e consentimentos/hipóteses aplicáveis.

### 4.4 Acidentes, incidentes e aprendizagem

- Captura móvel e offline de acidente, quase acidente e condição insegura, inclusive canal que preserve confidencialidade quando aplicável.
- Triagem que destaque prazo operacional da CAT sem decidir automaticamente o enquadramento.
- Investigação com linha do tempo, entrevistas, anexos, causas contribuintes, barreiras ausentes/falhas e aprovação.
- Ações corretivas vinculadas às causas, com verificação de eficácia e prevenção de encerramento sem evidência.
- Comunicação e lições aprendidas anonimizadas, evitando exposição indevida de dados de saúde.

### 4.5 eSocial determinístico e rastreável

Implementar uma esteira própria para S-2210, S-2220 e S-2240:

- esquema e tabelas oficiais por versão e vigência;
- validação local antes de transmitir, com mensagem compreensível e referência ao campo de origem;
- idempotência, fila transacional, retentativa com espera progressiva e proteção contra envio duplicado;
- assinatura, recibo, XML enviado, resposta, ambiente e certificado associados à mesma execução;
- retificação e exclusão preservando o encadeamento completo;
- reconciliação periódica entre fonte interna, transmissões e retornos;
- painel de pendências por prazo e motivo, sem classificar como “conforme” antes do aceite oficial.

### 4.6 Operação em campo

- Aplicativo web instalável, responsivo e offline para inspeções, DDS, entrega de EPI, permissões de trabalho e observações.
- Sincronização tolerante a conexão instável, conflitos explícitos e comprovante local de captura.
- QR code/NFC como atalho de identificação, nunca como único fator de autorização.
- Fotos com data, autoria e integridade; geolocalização apenas quando necessária, transparente e coberta por finalidade definida.
- Checklists versionados: respostas antigas permanecem ligadas à versão aplicada.

### 4.7 Participação e acessibilidade

- Portal do trabalhador para consultar treinamentos, riscos comunicados, instruções, solicitações e direitos sobre dados.
- Conteúdo em linguagem clara, leitura por teclado, foco visível, contraste, alvos adequados e compatibilidade com tecnologia assistiva conforme WCAG 2.2 AA.
- Confirmação de compreensão separada de mera abertura do conteúdo.
- Fluxos multilíngues quando a composição da força de trabalho exigir, mantendo a versão original e a tradução utilizada.

## 5. Dados, privacidade e segurança

### 5.1 Isolamento e acesso

- Adotar `tenantId/companyId` obrigatório e imutável em todos os registros, índices, caminhos de armazenamento, eventos e jobs.
- Aplicar menor privilégio com RBAC combinado a atributos: empresa, estabelecimento, profissão, finalidade, vínculo assistencial e período.
- Exigir MFA para perfis privilegiados e profissionais com acesso clínico; sessões de alto risco devem requerer autenticação recente.
- Separar as funções de administrar usuários, prestar atendimento, aprovar documentos e transmitir eSocial.
- Testar regras do Firestore e Storage no emulador com casos positivos e negativos para cada papel, empresa e coleção.

### 5.2 Privacidade desde o desenho

- Manter inventário de tratamentos: dado, finalidade, hipótese, controlador/operador, destinatários, localização, prazo e método de descarte.
- Coletar somente campos necessários e mascarar CPF, dados clínicos e identificadores em telas, logs, suporte e ambientes não produtivos.
- Criar política de retenção executável, com bloqueio legal, descarte verificável e relatório de exceções.
- Disponibilizar fluxo autenticado para direitos do titular e trilha de atendimento.
- Produzir relatório de impacto quando o contexto e o risco indicarem, com revisão do encarregado e segurança.

### 5.3 Auditoria inviolável

Registrar leitura, criação, alteração, exportação, impressão, assinatura, transmissão e decisão assistida, incluindo ator, papel, empresa, finalidade, instante, recurso, antes/depois quando cabível e identificador de correlação. Logs devem ser imutáveis, ter acesso separado, retenção definida e alertas para exportação em massa, acesso entre empresas e padrões anormais.

### 5.4 Engenharia de segurança

- Criptografia em trânsito e repouso, com chaves e segredos gerenciados e rotação documentada.
- Proteção de uploads por tipo, tamanho, varredura antimalware, quarentena e URL de curta duração.
- SAST, análise de dependências, detecção de segredos, testes de regras e DAST no pipeline.
- Modelagem de ameaças por fluxo crítico e teste independente periódico.
- Backups imutáveis, restauração ensaiada e objetivos RPO/RTO aprovados pelos donos do processo.
- Plano de incidentes com papéis, contatos, preservação de evidência, comunicação e exercícios.

## 6. IA responsável e verificável

A IA pode resumir, classificar ou sugerir rascunhos, mas não deve emitir aptidão, fechar investigação, declarar conformidade, transmitir evento ou prescrever conduta sem validação humana autorizada.

Controles necessários:

- identificação clara de conteúdo gerado e do profissional que aprovou;
- citação da evidência interna e da versão normativa usada;
- saída estruturada validada por esquema, com bloqueio quando faltar dado obrigatório;
- avaliação por casos representativos, incluindo falsos negativos, alucinações, mudança de norma e variação entre grupos;
- versionamento de modelo, prompt, ferramentas, fontes e resultado;
- proteção contra injeção de prompt em documentos e exclusão de segredos/dados desnecessários do contexto;
- mecanismo simples para corrigir, rejeitar e reportar uma sugestão;
- modo seguro de indisponibilidade: o fluxo manual continua funcional.

## 7. Indicadores úteis, com definição e proveniência

Todo indicador deve informar fórmula, população, janela, fonte, atualização, responsável e limitações. Separar indicadores de prevenção e de resultado, sem criar um placar opaco único.

| Dimensão | Exemplos de medidas | Validação mínima |
| --- | --- | --- |
| Riscos | exposições sem avaliação vigente; controles aguardando verificação; risco residual aprovado | vínculo com inventário e evidência |
| Ações | prazo, bloqueio, evidência aceita e eficácia verificada | histórico de status e aprovador |
| Saúde | cobertura do programa, pendências, tempo de encaminhamento | acesso agregado e supressão de grupos pequenos |
| Eventos | enviados, aceitos, rejeitados, retificados e reconciliados | recibo e versão do leiaute |
| Aprendizagem | quase acidentes tratados, investigação concluída e ação eficaz | não incentivar subnotificação |
| Plataforma | disponibilidade, latência, erros, fila, RPO/RTO e restauração | telemetria e teste documentado |

Metas devem ser definidas pelos responsáveis do processo com linha de base real. Dados simulados precisam ser marcados de forma inequívoca e jamais misturados com indicadores produtivos.

## 8. Sequenciamento de entrega

### Fundação — antes de dados reais

1. inventário de dados e fluxos, modelo temporal canônico e classificação de informação;
2. isolamento entre empresas, autorização granular, MFA e auditoria de leitura/exportação;
3. retirada ou rotulagem inequívoca de mocks; ambientes e dados de demonstração separados;
4. testes automatizados de regras, contratos, esquemas e jornadas críticas;
5. retenção, backup/restauração e resposta a incidentes executáveis;
6. catálogo normativo versionado e responsáveis formais por conteúdo.

**Critério de saída:** teste negativo comprova isolamento; restauração é demonstrada; acesso clínico aparece na auditoria; nenhum painel produtivo usa dado simulado.

### Operação essencial

1. cadastro temporal de organização, trabalhador, ambientes, funções e exposições;
2. ciclo completo GRO/PGR e plano de ação com eficácia;
3. PCMSO/ASO com segregação clínica e assinatura verificável;
4. esteira S-2210/S-2220/S-2240 com recibos e reconciliação;
5. gestão de incidentes e experiência de campo offline.

**Critério de saída:** cenários ponta a ponta são homologados pelos responsáveis técnicos, segurança, privacidade e usuários de campo, com evidências preservadas.

### Escala e integração

1. APIs versionadas, webhooks idempotentes e conectores para RH, laboratórios e dispositivos;
2. perfis FHIR para integrações clínicas aplicáveis;
3. observabilidade por empresa sem exposição cruzada de dados;
4. acessibilidade WCAG 2.2 AA avaliada automaticamente e por pessoas;
5. exercícios de carga, desastre, incidente e operação degradada.

**Critério de saída:** contratos de integração, SLOs e procedimentos de recuperação são testados e acompanhados.

### Inteligência assistida

1. busca com permissão herdada da fonte;
2. classificação e extração com confiança, evidência e fila de revisão;
3. sugestões de plano e detecção de inconsistência com aprovação humana;
4. avaliações contínuas e monitoramento de deriva.

**Critério de saída:** conjunto de avaliação aprovado, rastreabilidade completa e nenhum fluxo crítico depende exclusivamente da IA.

## 9. Governança da entrega

Para cada capacidade, registrar: dono do processo, responsável técnico, encarregado/privacidade, ameaça principal, requisito normativo, critérios de aceite, testes, monitoramento, plano de reversão e evidências. Mudanças regulatórias devem abrir análise de impacto, atualização versionada, teste de regressão e comunicação aos usuários.

Uma revisão trimestral deve examinar incidentes, acessos, exceções, restaurações, desempenho dos controles, feedback dos trabalhadores e alterações normativas. A revisão não pode ser apenas documental: deve resultar em responsáveis, prazos e verificação de eficácia.

## 10. Definição de pronto para produção

Uma funcionalidade crítica só está pronta quando:

- possui requisito e fonte versionados;
- respeita segregação de empresa e de dado clínico;
- mantém trilha de auditoria e cadeia de custódia;
- funciona com teclado e tecnologia assistiva no fluxo principal;
- contém testes de sucesso, erro, permissão negada, duplicidade e indisponibilidade;
- tem métricas, alerta, runbook, rollback e responsável de plantão;
- foi validada pelo profissional habilitado correspondente;
- informa ao usuário quando uma saída é calculada, simulada ou gerada por IA;
- não depende de dado de produção em desenvolvimento ou homologação.

Esse conjunto transforma “melhorias” em controles demonstráveis e permite evoluir a plataforma por evidência, sem depender de alegações genéricas de qualidade.
