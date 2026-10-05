# PGR: importação com evidências e App Check

O fluxo `/risk-management/pgr-analysis` lê páginas reais do PDF e identifica o cliente pela razão social e pelo CNPJ rotulados. O nome do arquivo, o contexto AVP e os bytes compactados não servem de identificação. Campos ausentes permanecem vazios. Índices, conceitos e linhas de ausência de exposição não comprovam riscos ocupacionais.

A seleção do cliente usa o CNPJ completo e o ID existente. Antes de integrar, o usuário confere cliente e unidade. O servidor recusa CNPJ incompatível, identificação ausente/ambígua, original trocado ou empresa não autorizada. O original fica em Storage privado; uma transação grava documento, riscos, cards com checklist e auditoria. A reimportação do mesmo original preserva andamento e responsáveis. Probabilidade, severidade, exposição e conformidade aguardam avaliação profissional.

Os cinco agentes preparam revisões em rascunho e mantêm histórico. Não prescrevem exames, definem aptidão, assinam documentos ou transmitem eSocial. A equipe revisa e executa as ações. Um card não é concluído enquanto houver item obrigatório desmarcado.

## Provedor da IA

Uma chave configurada no servidor usa Google AI/Genkit. No App Hosting/Cloud Run (`K_SERVICE`), sem chave, o fluxo PGR usa Vertex AI com as credenciais da própria identidade de execução (ADC), na região `global`. O projeto precisa ter a API Vertex AI, faturamento e a permissão de invocação apropriada na identidade real do backend. Não conceder papéis amplos ou gerar arquivos de chave. `PGR_AI_PROVIDER=disabled` permite interromper a geração. Uma falha de modelo deixa explícito o modo de extração documental; revisões indisponíveis nunca são apresentadas como concluídas.

Os PDFs digitais passam por todas as páginas, até 300 páginas e 1 milhão de caracteres. A IA recebe o texto extraído completo, com páginas. PDFs digitalizados e imagens usam leitura visual quando a IA está disponível e exigem conferência no original. Até 100 grupos de risco e 120 cards são preparados por documento; esse limite não equivale a inventário completo.

## Ativação do App Check em produção

O prazo anunciado pelo Firebase para exigir App Check no **Firebase AI Logic** é 2 de novembro de 2026. O PGR usa Genkit no servidor; sua autenticação de usuário e autorização por empresa continuam obrigatórias. O navegador também precisa de atestação para serviços Firebase e para a proteção das APIs próprias.

1. No projeto `studio-8439299034-125c7`, criar ou reutilizar uma chave reCAPTCHA Enterprise **Web, baseada em pontuação**, para os domínios reais do app: `www.nai.nextconsaude.com.br` e `nai--studio-8439299034-125c7.us-central1.hosted.app`. Incluir outro domínio somente se efetivamente servir o mesmo aplicativo. Não incluir localhost na chave de produção.
2. Registrar o web app `1:1061319966767:web:4749907ad26ff517d686da` na aba Apps do Firebase App Check com essa chave.
3. Configurar `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` com a chave pública, com disponibilidade **BUILD** no App Hosting, e fazer novo rollout. Uma variável apenas de runtime não recompila o navegador. A chave do site não é uma chave privada de serviço.
4. O SDK inicia App Check antes de Auth/Firestore/Storage e renova tokens. As APIs PGR recebem `X-Firebase-AppCheck` e verificam token e appId. Não há debug token embutido na produção.
5. Observar solicitações verificadas de clientes reais. Só depois ativar `PGR_APP_CHECK_ENFORCE=true` no runtime para exigir tokens nas APIs PGR. Um token enviado mas inválido já é recusado no modo de monitoramento.
6. Aplicar App Check ao Firebase AI Logic após validar os clientes que usam essa API. Avaliar separadamente Firestore, Storage e Authentication; não aplicar bloqueio indiscriminado enquanto o painel indicar 100% sem verificação.

Registrar chave no console, atribuir permissão ou ativar enforcement **não é feito apenas por publicar código**. Confirmar cada operação e as métricas no projeto autenticado. O Scheduler AVP a cada 10 minutos é uma integração independente; este fluxo não afirma que ele foi ativado.

## Validação e reversão

Executar `npm run type-check`, `npm run lint`, `npm run test:run`, `npm run test:rules` e `npm run build`. Os testes de integração usam somente `demo-nai-security` e dados sintéticos; exercitam Firestore real no emulador e simulam confirmação/falha de upload, sem alegar teste de Storage em produção.

Em falha de geração, manter os cards documentais para revisão e desativar somente a geração com `PGR_AI_PROVIDER=disabled`. Não restaurar o parser antigo que inventava cliente e resultados. Para reverter código, usar o rollout anterior do backend NAI, preservando os dados gravados e o histórico. Não alterar o ambiente Azure.

Referências: [Firebase App Check no Web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [App Check e Firebase AI Logic](https://firebase.google.com/docs/ai-logic/app-check), [plugin Genkit Google AI/Vertex AI](https://js.api.genkit.dev/modules/_genkit-ai_google-genai.html).
