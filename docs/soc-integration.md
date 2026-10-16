# Integração SOC — leitura e conferência

## Escopo desta entrega

Central `/integrations/soc` e API `/api/integrations/soc`: empresas, colaboradores por empresa, ASOs emitidos por códigos de colaboradores e período, além das últimas 50 consultas realizadas pelo NAI. Somente SUPER_ADMIN ou ADMIN/OPERATIONS internos, sem tenant de cliente. Nenhuma escrita no SOC/RM, exclusão de matrícula/RG, emissão de parecer, criação de usuário ou envio de mensagem.

O desenho se inspira nas funcionalidades públicas de integração, conferência e monitoramento da [SmarTrics](https://www.smartrics.com.br/solucoes/) e [Bemper](https://www.bemper.com.br/soc). Não incorpora código, credenciais ou componentes proprietários desses fornecedores.

## Evidência real em 16/10/2026

Inspeção autenticada no SOC, empresa principal **1005519**, usuário ADM-NEXTCON. O identificador usado no formulário de login não é o código da empresa principal.

| Verificação no SOC                                                    | Resultado observado                                                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Tela 733, busca de Exporta Dados                                      | 9 relatórios cadastrados                                                                                                      |
| Cadastro de Empresas, execução HTML                                   | 257 registros; nenhum nome abreviado/razão social contém AVP                                                                  |
| Cadastro de Funcionarios (Por Empresa), filtro 1005519, execução HTML | 14 registros, todos com CODIGOEMPRESA 1005519; 10 matrículas vazias, nenhuma repetida entre as preenchidas; coluna RG ausente |
| Tela 299, Consulta Importação, 09–16/10/2026, Todas as Empresas       | “Sem Movimentação...”                                                                                                         |
| Tela 774, Configuração de Integração                                  | Nenhuma linha listada na abertura; não comprova ausência de outras integrações                                                |

Matrícula vazia é um indício para conferir a regra do vínculo, não prova de cadastro incorreto. Não foi feita qualquer correção de colaborador. A tela 299 consultada não comprova o estado de todos os Web Services nem dos logs do integrador RM. A causa dos erros desconhecidos ainda não foi identificada: faltam retorno original, data/hora, serviço, empresa e identificador da execução.

Estas verificações são **leituras reais na interface SOC**. Não são testes da API NAI publicada, das chaves Exporta Dados a partir do servidor NAI, do agendador ou da sincronização RM. Nenhuma dessas etapas foi declarada operacional nesta entrega.

## Grupo AVP: empresa e unidades confirmadas

Depois de receber as siglas do usuário, a inspeção encontrou **ASSOBES ENSINO SUPERIOR LTDA, empresa SOC 2306171** (razão social inicial STAMP SERVICOS EDUCACIONAIS LTDA). As nove instituições aparecem nas unidades dessa empresa. A consulta real de colaboradores retornou **5.685 registros em 43 códigos de unidade**, incluindo todas as situações cadastrais; não equivale a 5.685 empregados ativos. **195 registros sem matrícula** e nenhuma repetida entre as matrículas preenchidas, sem conclusão automática de incorreção.

| Instituição informada | Códigos de unidade SOC                | Registros retornados |
| --------------------- | ------------------------------------- | -------------------: |
| ASSOBES               | 2 a 33, conforme unidades cadastradas |                2.547 |
| CEUDESP               | 286 e 300                             |          128 + 2.709 |
| ASCEC                 | 245                                   |                   65 |
| ASPER                 | 243                                   |                   15 |
| APESU                 | 293                                   |                   95 |
| AESPI                 | 306                                   |                   42 |
| AESA                  | 251                                   |                   20 |
| AVIES                 | 147                                   |                    7 |
| AESMS                 | 250 e 304                             |               17 + 1 |

A unidade 246, FORTALEZA - ASSOCIADA, retornou mais 39 registros. Sua associação a uma das nove siglas não foi presumida. CEUDESP tem duas unidades com o mesmo nome, e AESMS aparece com dois nomes; o conector preserva CODIGOUNIDADE e o painel filtra pelo código, sem juntar registros pelo nome. O teto de resposta foi aumentado para 16 MB para acomodar a base consolidada, mantendo limite de 20 mil linhas e rejeição explícita de excesso.

Consulta real de **Dados ASO com exames**, empresa 2306171, período de emissão **01–16/10/2026**, retornou **4 linhas e 4 fichas** da mesma empresa, com emissões em 01/10 e 08/10. Não foram copiados pareceres ou resultados clínicos para este documento. Esse relatório representa ASOs emitidos, não a fila de agendamento. A repetição com pFuncionario=1 e os quatro códigos de colaboradores retornou as mesmas quatro linhas, todas da empresa e dos colaboradores solicitados, validando na interface o filtro usado pelo conector.

## Contratos conferidos na tela 733

| Relatório                              | Código observado | Acesso POST/WS | JSON | Última execução exibida antes dos testes |
| -------------------------------------- | ---------------- | -------------- | ---- | ---------------------------------------- |
| Cadastro de Empresas                   | 185065           | Sim/Sim        | Não  | 04/02/2026                               |
| Cadastro de Funcionarios (Por Empresa) | 155091           | Sim/Sim        | Sim  | 04/02/2026                               |
| Dados ASO com exames                   | 221493           | Sim/Sim        | Sim  | 15/10/2026                               |
| ASOs no período (por empresa)          | 221495           | Sim/Sim        | Sim  | 30/09/2026                               |

Todos esses quatro relatórios estavam ativos. O conector usa CSV para empresas e JSON nos dois outros recursos. O código 221495 não é usado: o layout inspecionado não expõe CODIGOEMPRESA para validar o vínculo. A saída de Dados ASO com exames inclui empresa e funcionário, mas o NAI remove CPF, pareceres e resultados clínicos e deduplica linhas de exames pela ficha/empresa/funcionário.

Endpoint documentado dentro do SOC: `https://ws1.soc.com.br/WebSoc/exportadados?parametro=...`. O parâmetro contém JSON com `empresa`, `codigo`, `chave`, `tipoSaida` e filtros específicos. A documentação chama esse acesso de POST, mas exemplifica uma URL para colar no navegador; esta implementação usa GET conforme a URL documentada. O transporte ainda deve ser homologado a partir do servidor. Não registrar URLs completas, pois contêm chave.

- Colaboradores: `empresaTrabalho`, `cpf` vazio, `parametroData=0`, datas vazias. Colunas mínimas CODIGOEMPRESA, CODIGO, MATRICULAFUNCIONARIO. NAI preserva zeros à esquerda, não compara CPF e não supõe que matrícula repetida seja necessariamente erro.
- ASOs: `empresa` é o código da empresa consultada (2306171 na verificação real), diferente da empresa principal usada nas consultas de empresas/colaboradores. A tela 733 confirmou esse filtro na execução real; a autenticação dessa combinação de empresa e chave pelo servidor NAI ainda precisa ser homologada. `pFuncionario=1`, `funcionario` com 1–50 códigos explícitos, intervalo de até 31 dias, `pDataIncAso=2` (emissão), tipos 1–6. Qualquer registro fora da empresa/colaboradores solicitados rejeita toda a resposta. Exige validação do comportamento real do escopo na homologação.
- Até 16 MB e 20 mil linhas por resposta, timeout 20 s, sem redirecionamento, sem cache. Não há truncamento silencioso. Retorno desconhecido/HTML/erro não vira lista vazia. Mensagens e corpos brutos do provedor nunca são enviados ao navegador ou gravados no histórico.

## Configuração segura pendente

Provisionar segredos no gerenciador do ambiente e vinculá-los ao runtime do App Hosting. Não colar chaves no chat, GitHub, `.env` versionado ou formulário de configuração comum.

| Variável                               | Valor/uso                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SOC_PRINCIPAL_COMPANY_ID               | 1005519, após confirmar escopo do contrato                                                         |
| SOC_ALLOWED_COMPANY_IDS                | Até 5 códigos de empresas explicitamente autorizadas, separados por vírgula; sem padrão automático |
| SOC_COMPANIES_CODE / SOC_COMPANIES_KEY | 185065 e sua chave Exporta Dados                                                                   |
| SOC_EMPLOYEES_CODE / SOC_EMPLOYEES_KEY | 155091 e sua chave Exporta Dados                                                                   |
| SOC_ASOS_CODE / SOC_ASOS_KEY           | 221493 e sua chave Exporta Dados                                                                   |
| SOC_MONITOR_SECRET                     | Segredo dedicado, aleatório, mínimo 32 caracteres, para o agendador                                |

Os códigos foram observados; as chaves não foram copiadas para código ou relatório. Uma configuração preenchida não declara conexão: somente uma consulta bem-sucedida registra resposta do provedor. O Grupo AVP foi localizado após o usuário informar suas instituições: empresa SOC 2306171 (ASSOBES), com as instituições representadas em unidades. Usar SOC_ALLOWED_COMPANY_IDS=2306171 para esse escopo, após provisionamento seguro; a empresa principal de autenticação continua 1005519. Nenhuma autorização é inferida automaticamente do nome AVP.

## Monitoramento diário

Workflow `.github/workflows/soc-monitor.yml`: 07:00 de São Paulo (10:00 UTC), sujeito ao atraso normal do GitHub Actions. Permanece desabilitado até definir a variável de repositório `SOC_MONITOR_ENABLED=true` e o segredo GitHub `SOC_MONITOR_SECRET`, igual ao segredo do runtime NAI. Habilitar somente após homologação e publicação do endpoint. O workflow não envia e-mails nem mensagens; notificações nativas do GitHub dependem das preferências dos usuários.

`POST /api/integrations/soc/monitor` consulta sequencialmente cadastros das empresas autorizadas (máximo 5), registra contagens e indícios de matrícula, bloqueia repetição em 10 min e falha se não conseguir registrar o resumo. O agendador não consulta ASOs automaticamente, não corrige dados, não extrai logs de terceiros e não prova sucesso das cargas RM. Histórico protegido por API em `webhook_deliveries/soc-monitor/runs`; regras existentes vedam acesso direto do SDK cliente. Os resumos não contêm dados de pessoas. Definir retenção operacional antes de escala prolongada.

## Requisitos para Ricardo Junior — minuta para revisão, não enviada

1. Confirmar empresa/coligada/filial do RM, versão, modalidade e fornecedor do integrador atual; obter endpoints/WSDL, documentação de autenticação e ambiente de homologação. O endpoint TOTVS existente no NAI continua explicitamente não configurado.
2. Confirmar sentido de cada fluxo: RM → SOC para cadastros; SOC → RM para ASOs/fechamento; sistema mestre e chave estável por empresa/vínculo; admissão, desligamento, readmissão e múltiplos vínculos.
3. Obter execução com erro real: horário/fuso, serviço/operação, código de retorno e mensagem integral por canal seguro, identificador de correlação, payload reduzido e registro de origem/destino. Distinguir autenticação, contrato, rejeição de dados, dependência cadastral, indisponibilidade e erro ainda não classificado. Não atribuir causa por palavras isoladas.
4. Obter relatório/contrato que inclua RG e regra de matrícula do RM. Não remover matrícula enquanto ela for chave de localização ou do vínculo. Para cada divergência: evidência → proposta → revisão → correção individual no sistema mestre → nova carga → comparação → encerramento. Registrar antes/depois e plano de restauração fora de logs gerais.
5. Definir campos obrigatórios de fechamento por tipo de pasta, momento de conclusão, responsáveis, regras de reabertura, idempotência, retentativa e tratamento de retorno parcial. Só liberar escrita com homologação desses contratos.
6. Estimar separadamente: autenticação/conectividade; layouts e mapeamento; monitoramento e diagnósticos; saneamento individual; escrita/idempotência; homologação, implantação e treinamento. Não há estimativa de horas confirmada sem esses insumos.

## Usuário Felipe e treinamento

Confirmar a plataforma do novo cadastro e o perfil mínimo de acesso. Não criar usuário duplicado nem enviar senha em texto simples. Preparar convite ou fluxo de primeiro acesso oferecido pelo sistema, com revisão antes de enviar a felipe@nextconsaude.com.br. Cadastro, convite e treinamento ainda não foram executados.

Roteiro de treinamento proposto: identificar empresa e vínculo; conferir campos obrigatórios antes de fechar pasta; revisar retorno da integração; localizar falha por execução; corrigir individualmente na origem; confirmar nova carga; registrar evidência e escalar erros sem causa conhecida. Agendar somente depois de definir participantes, plataforma e checklist específico do RM.

## Homologação antes de considerar operacional

Validação local de código em 16/10/2026: 48 testes direcionados aprovados (contratos, isolamento, autenticação, agendador e privacidade dos registros); TypeScript e ESLint dos arquivos alterados aprovados; build Next.js concluído. O build reportou avisos preexistentes em outros módulos. As etapas abaixo continuam pendentes e são distintas dessa validação.

1. Configurar os segredos e o escopo e publicar a versão aprovada.
2. Conferir uma empresa e um colaborador reais nos dois sistemas, incluindo zeros à esquerda e vínculos.
3. Consultar ASOs de um colaborador/período conhecido e confirmar escopo, datas e deduplicação; sem dados clínicos no painel.
4. Confirmar respostas reais JSON/CSV, codificação e erros de autorização sem expor chaves. Ajustar layout apenas a partir de evidência.
5. Executar monitoramento manual, conferir resumo persistido, habilitar agendamento e comprovar a primeira execução diária.
6. Somente depois do contrato RM, homologar alterações individuais e sucesso da próxima carga. Testes unitários não substituem essas etapas.
