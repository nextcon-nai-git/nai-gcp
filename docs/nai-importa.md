# NAI importa

A entrada da tela inicial e dos menus é **NAI importa**, em `/nai-importa`. A rota anterior `/risk-management/pgr-analysis` continua disponível e compartilha a mesma implementação.

## Fluxo

1. Enviar um PDF, PNG, JPEG ou WebP de até 12 MB. PDFs têm limite de 300 páginas; enviar um documento por vez.
2. Identificar o tipo pelo conteúdo e encaminhar a análise ao especialista correspondente. Nome do arquivo e cliente selecionado não determinam a classificação.
3. Revisar identificação empresarial, evidências, prestadores candidatos, síntese do agente, ações e checklists.
4. Confirmar o cliente e integrar. O servidor grava o original, o registro documental, os vínculos e os cards; a tela apresenta as contagens efetivamente retornadas pela gravação.

| Tipo                                                            | Agente responsável                    |
| --------------------------------------------------------------- | ------------------------------------- |
| PGR e LTCAT                                                     | Engenheiro de Segurança               |
| PCMSO, ASO e perícia médica                                     | Médico do Trabalho                    |
| AEP, AET e dados ergonômicos                                    | Ergonomista                           |
| Desconhecido, ambíguo ou arquivo misto sem separação suficiente | Rascunho pendente; exige nova análise |

A chamada ao modelo utiliza o prompt do especialista identificado. Documentos escaneados ou com páginas sem texto passam antes por uma triagem visual limitada a tipo e restrição clínica. Uma capa legível não permite ignorar anexos escaneados.

Quando a IA está indisponível, excede o tempo ou não entrega análise estruturada suficiente, o resultado permanece pendente/indisponível. A extração de texto isolada não habilita a integração de uma nova análise. Os registros legados continuam consultáveis.

## Organização criada

- Cliente existente associado por identidade documental; criação de cliente novo restrita à administração global e condicionada a CNPJ válido e identificação segura.
- Prestadores separados do empregador e dos trabalhadores, com evidência explícita do papel e CNPJ. Candidatos insuficientes permanecem para revisão. A opção de cadastrar/vincular pode ser desativada.
- Cadastro existente de prestador preservado; o vínculo empresarial é acrescentado a `servedCompanies` e registrado em `provider_links`. Nenhum usuário, papel ou permissão é criado pelo importador.
- Cards com tipo documental, agente sugerido, prioridade, evidência, checklist obrigatório, responsável e prazo a definir. As sugestões ficam identificadas e dependem de revisão humana.
- Para documentos técnicos, revisão principal e preparação da devolutiva ao cliente, incluindo conferência de datas e próximos passos. A importação não envia mensagens nem cria prazos legais presumidos.
- Riscos com evidência quando aplicável, sem inventar probabilidade, severidade ou medições.
- Histórico documental e auditoria da integração.

A reimportação dos mesmos bytes para a mesma empresa reutiliza o registro, sem recriar cards nem apagar responsáveis, progresso ou checklists revisados. O hash do arquivo enviado no salvamento precisa corresponder ao da análise. As escritas de cadastro, vínculos, cards e auditoria são transacionais.

## Conteúdo clínico

PCMSO, ASO e perícias médicas são tratados como restritos. O acesso exige papel clínico explícito (`DOCTOR`, `NURSE`, `HEALTH_PROFESSIONAL`) com vínculo à empresa, ou administração autorizada. O papel genérico `PROVIDER` também representa fornecedores de engenharia e não concede acesso clínico às importações.

A íntegra da análise médica, suas ações específicas, evidências e original ficam no registro clínico. A área operacional recebe somente um envelope documental sem dados individuais e um card administrativo padronizado de revisão, com checklist. O texto desse card permanece administrativo; a conclusão exige perfil clínico autorizado. Documentos técnicos com conteúdo clínico individual ficam pendentes para separação antes da análise de engenharia ou ergonomia.

Não há emissão de ASO, decisão de aptidão, diagnóstico, conclusão pericial, assinatura profissional ou aprovação técnica automática.

## Contratos e compatibilidade

Os novos endpoints `/api/nai-importa/analyze`, `/save`, `/companies`, `/history`, `/agent-review`, `/tasks` e `/risks` usam os mesmos handlers autenticados dos endpoints `/api/pgr`. As consultas são `no-store`. O App Check mantém a política existente.

`PgrAnalysisOutput` recebe os campos opcionais `documento`, `prestadoresIdentificados` e `analiseAgente`. `getNaiDocument` normaliza o legado. `PGR_VERSION` permanece `pgr-evidence-v1`, preservando identidade e histórico.

Os cards operacionais continuam com `sourceType: "pgr"` e IDs compatíveis com os consumidores existentes. `sourceLabel: "NAI importa"`, `documentType`, `responsibleAgent` e `restricted` distinguem a origem real. O tipo do card acompanha PGR, LTCAT, PCMSO, ASO, perícia, AEP, AET ou ergonomia.

| Conteúdo                                             | Destino                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Rascunho com dono e expiração de 24 horas            | `nai_importa_drafts/{draftId}`; acesso somente pelo servidor   |
| Documento técnico ou envelope administrativo clínico | `companies/{companyId}/pgr_cards/{hash}`                       |
| Análise clínica e revisões                           | `companies/{companyId}/clinical_records/import_{hash}`         |
| Original clínico                                     | `clientes/{companyId}/prontuarios/importacoes/{hash}.{ext}`    |
| Original técnico                                     | `clientes/{companyId}/sst_nrs/{categoria}/{hash}.{ext}`        |
| Ações e riscos                                       | Subcoleções `tasks` e `risks` do cliente                       |
| Cadastro/vínculo de prestador                        | `providers/{id}` e `companies/{companyId}/provider_links/{id}` |

O tempo de expiração é verificado pelo servidor; a remoção física de rascunhos antigos não é executada pela importação. O deploy pode configurar TTL em `expiresAtMs` somente após adaptar esse campo ao tipo timestamp aceito pelo Firestore; não há TTL presumido neste código.

## Validação e publicação

Executar `npm run type-check`, `npm run lint`, `npm run test:run`, `npm run test:rules` e `npm run build`. As suites incluem roteamento por conteúdo, PDFs mistos, identidade cliente/prestador, falhas da IA, confirmação, isolamento entre empresas, dados clínicos, concorrência, repetição e integridade dos checklists.

**Publicar as regras de Firestore e Storage desta revisão antes do código no App Hosting.** Elas fecham leitura direta dos rascunhos, impedem alteração pelo navegador dos registros importados e protegem os originais clínicos. Não ativar esta versão com as regras anteriores.

Em ambiente autenticado no projeto correto, depois dos testes:

```sh
npx --yes firebase-tools@14.22.0 deploy --only firestore:rules,storage:rules --project studio-8439299034-125c7 --non-interactive
```

O App Hosting do repositório publica a branch `main`. O workflow de validação não publica regras em push. A operação manual existente de Firestore também não inclui Storage; esta alteração exige as duas regras pelo comando acima ou por fluxo equivalente autorizado. Confirmar o rollout e fazer uma importação de documento sintético sem dados pessoais, com credenciais de IA do ambiente, antes de encerrar a publicação.

Para reverter o aplicativo, reverter o commit funcional e publicar a versão anterior, preservando as regras restritivas e os registros. Não reabrir acesso aos rascunhos ou documentos clínicos para reverter a interface. A rota legada permanece disponível nesta versão para acessos antigos.
