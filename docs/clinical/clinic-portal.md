# Portal restrito de atendimento ocupacional

O agendamento possui um painel **Portal restrito da clínica**, ao lado do gerador de kit. A equipe identifica clínica, e-mail individual do médico, nome, CRM/UF, recepção opcional e validade entre 1 e 30 dias. Deve conferir a identidade profissional e os exames com PGR/PCMSO. Um novo convite revoga o anterior, mantendo o histórico privado.

O botão copia o link para envio manual por WhatsApp/e-mail. O sistema não envia mensagens nem cria agendamento no SOC. O destinatário precisa entrar/criar conta com o e-mail convidado e confirmá-lo. A conta não recebe perfil interno, permissão sobre empresas ou acesso global. O primeiro acesso vincula o convite ao UID; recriar a conta com o mesmo e-mail não restaura o acesso antigo.

Recepção: identificação e confirmação de recebimento. Médico convidado: riscos e exames previamente conferidos, ficha clínica, data efetiva, resultados e conclusão. O salvamento usa versão para bloquear sobrescritas concorrentes e trava após submissão. Nenhuma conclusão é gerada por IA. A data de atendimento não é inferida da emissão.

Após revisão, o médico baixa uma minuta de ASO, completa os campos ainda pendentes (inclusive responsável PCMSO e datas de exames), assina pelo procedimento habitual e devolve somente o ASO em PDF, até 5 MiB. Esse upload não verifica assinatura criptográfica e não marca o pedido automaticamente como ASO concluído. A equipe baixa o documento recebido e faz a conferência habitual. Não há integração com um fornecedor de assinatura eletrônica nesta entrega, nem publicação automática no portal do cliente ou transmissão ao eSocial.

## Persistência e privacidade

- `clinic_portal_private/{id}` contém snapshot mínimo, grants, ficha e metadados. Subcoleção `events` registra leituras e alterações sem conteúdo clínico nos logs.
- Firestore client SDK não pode ler ou gravar essa árvore, inclusive SUPER_ADMIN. Os endpoints do servidor aplicam convite, e-mail confirmado, UID, expiração e revogação.
- PDFs ficam em `clinic-portal-private/{id}/{random}.pdf`, sem URL pública ou token de download. O prefixo herda deny das regras Storage atuais. Endpoint de download permite médico com convite vigente ou responsável interno pelo pedido (somente ASO, nunca ficha clínica).
- O agendamento compartilhado recebe somente ID do portal e andamento, sem anamnese, medicamentos, resultados ou conclusão.
- Revogação/expiração bloqueia o convidado; a equipe responsável mantém acesso ao ASO recebido para conferência. Histórico não é apagado pela revogação. Retenção e eventuais retificações clínicas exigem procedimento específico; a versão submetida é imutável.

## Publicação

1. Executar CI e emulador de regras, incluindo `tests/rules/clinic-portal.test.ts`.
2. Publicar as regras Firestore deste commit (workflow Firebase validation, `deploy_firestore=true`). Confirmar que o SDK não acessa `clinic_portal_private`, inclusive com conta interna. Confirmar deny de Storage no prefixo privado.
3. Configurar `CLINIC_PORTAL_ENABLED=true` em runtime e realizar rollout. O padrão é desabilitado, para impedir criação de prontuários antes das regras que excluem a coleção do fallback operacional.
4. Conferir Email/Password habilitado no Firebase Authentication, envio de verificação/recuperação, domínio autorizado e acesso do service account ao bucket configurado em `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`.
5. Homologar com contas e dados sintéticos: recepção, médico, terceiro, convite vencido/revogado, duas abas concorrentes e PDF devolvido. Confirmar que link encaminhado não concede acesso e que a conta convidada não acessa áreas internas.

A ativação não está comprovada por testes unitários ou pelo merge do código. O ambiente publicado precisa dessa homologação.
