# Central do Cliente — referências e implementação

Consulta às páginas públicas oficiais em 10/10/2026. As referências orientam necessidades funcionais; interface, textos e implementação são próprios do NAI.

| Referência pública                                                                                                                         | Benefício anunciado                                                                                 | Adaptação implementada                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Maxipas — https://www.maxipas.com.br/tecnologia                                                                                            | Plataforma unificada, gestão de periódicos, documentos, indicadores e solicitações por departamento | Central única com indicadores, prazos, documentos e seis departamentos de atendimento                      |
| SOC — https://www.soc.com.br/portal-do-cliente-soc-rh/ e https://www.soc.com.br/blog-de-sst/conheca-a-nova-funcionalidade-do-soc-o-soc-rh/ | Visibilidade de SST para o cliente, exames, documentos e agendamentos                               | Visão administrativa por empresa, documentos recentes e acompanhamento dos pedidos pelo status operacional |
| MagSaúde — https://magsaude.com.br/                                                                                                        | Controle dos prazos de periódicos, apoio ao RH/SESMT e agendamento online                           | Fila de periódicos vencidos/próximos, busca por colaborador/setor, exportação CSV e solicitação de apoio   |

## Entrega

- Rota `/client-center`, disponível no menu principal.
- Autenticação Firebase verificada no servidor; escopo de empresa reutiliza a autorização do painel executivo.
- Projeção administrativa: nenhum CPF, salário, diagnóstico, aptidão ou prontuário é retornado pela API.
- Prazos calculados em dias de São Paulo, apenas a partir de `nextAsoDate`. Datas ausentes não são estimadas a partir do último exame. Exclui registros demitidos, inativos e removidos.
- Solicitações criam cards reais em `companies/{companyId}/tasks`, com estado `todo`, autoria da sessão e descrição disponível no editor do Kanban. `dueDate` vazio mantém o card visível nas consultas existentes sem inventar um prazo.
- UUID e transação impedem duplicações em reenvios da mesma solicitação. Reutilização do ID com conteúdo diferente gera conflito.
- Falhas parciais de fontes são explícitas. Limites de 2.000 colaboradores, 1.000 ações e 50 documentos; a interface informa consultas parciais.
- CSV exporta a seleção filtrada e neutraliza fórmulas em campos textuais.

## Validação e limites

566 testes passaram em 86 arquivos. TypeScript e lint dos novos arquivos aprovados. Compilação de produção e CI são verificados antes da integração.

A solicitação de agendamento não reserva clínica ou horário. A equipe confirma o atendimento pelo fluxo operacional existente. Não foram implementadas integrações com as empresas de referência, envio automático de WhatsApp/e-mail, aplicativo nativo ou transmissão automática de eSocial. Esses recursos não são anunciados como ativos na central.

Nenhum registro real de cliente foi criado para testes.
