# Homologação autenticada — 13/10/2026 (Brasília)

Acesso confirmado em produção com perfil interno SUPER_ADMIN. Nenhum e-mail,
mensagem, convite, cobrança, documento clínico ou transmissão fiscal foi enviado.

## Evidências desta rodada

- Dashboard e 48 destinos únicos do menu lateral: navegação inspecionada. As telas
  de carregamento foram diferenciadas dos títulos renderizados. Isso não atesta
  os fluxos de gravação, todos os perfis ou as 106 páginas do repositório.
- Omie: conexão identificada e consulta de contas a receber retornou tabela
  paginada de produção. Nenhuma baixa ou alteração financeira executada.
- Notas fiscais: consulta pelo Omie disponível na interface; emissão direta pelo
  NAI explicitamente indisponível. Não houve emissão nem cancelamento.
- Controle de acesso em campo: catraca, biometria e verificação de EPI informadas
  como indisponíveis. Não considerar integração homologada.
- Prestadores: link de convite adicionava 55 mesmo quando o telefone já possuía
  o código internacional. Correção reutiliza getWhatsAppLink; regressões cobrem
  telefone nacional e internacional. Nenhum link de envio foi acionado.
- Academia: base REAL_TRAININGS vazia. Percentuais, contagens da biblioteca,
  aumento de engajamento, presença diária, validade de certificados e alegações
  de QR/biometria eram fixos. Removidos indicadores sem fonte e explicadas as
  funções ainda indisponíveis. Isso corrige a apresentação, não implementa LMS.

## Pendências para encerramento

- Homologação funcional de gravação e isolamento por perfil, além da navegação.
- Implantação integral das regras Firestore e índices ainda pendente; Storage
  e restrições fiscais confirmados conforme atualização abaixo.
- Segurança de dependências: avaliação e mitigação dos alertas registrados.
- Backup, restauração isolada, proteção de branch e publicação do SHA.
- Integrações ainda não implementadas (Academia, controle físico, emissão fiscal
  direta), assinatura e recibos eSocial não podem ser declarados concluídos.

Os testes e o CI de cada PR são evidências técnicas separadas destas observações.
Não há percentual global de 100% atestado nesta rodada.

## Atualização de infraestrutura — 23:50 Brasília

- PRs #114, #115 e #116 integrados. CI do #116: 1.472 testes em 163 arquivos,
  compilação, tipos e verificações de segurança aprovados.
- App Hosting confirmou o SHA ed7a191 (PR #115) como versão atual na primeira
  inspeção. Às 23:53, a Academia em produção já apresentou a correção do PR #116:
  “Não apurado”, base local explícita e ações não implementadas desabilitadas.
- Storage: regras do PR #114 publicadas pelo console, recarregadas e comparadas
  integralmente ao texto preparado (4.854 caracteres). A fonte de contrato não
  admite sobrescrita nem exclusão pelo cliente.
- Workflow manual 38502065853: validação aprovada, incluindo 1.469 testes de
  aplicação e 129 testes de regras. Deploy falhou antes da publicação porque
  FIREBASE_SERVICE_ACCOUNT_JSON estava ausente. Não foi criada credencial.
- Firestore: aplicada proteção fiscal de prestadores sobre a versão que já estava
  publicada (base 768fcae), sem ampliar as permissões clínicas. Snapshot exato em
  releases/firestore-2026-10-13.rules. Testes da combinação: 22/22 aprovados em
  providers-access, tenant-admin-boundary e user-profile, com ambos os emuladores.
  Após recarregar o console, o texto publicado coincidiu integralmente com o
  candidato validado (18.508 caracteres).
  As regras completas da main ainda diferem nas permissões clínicas de médicos;
  esta implantação parcial não deve ser confundida com publicação integral.
- Banco principal: backups programados e recuperação pontual desativados.
  Não foi presumida retenção, orçamento ou capacidade de restauração.
- Domínio com www conectado no Firebase. Domínio sem www não consta na lista
  de domínios do backend nesta inspeção.
- Branch main retornou protected=false. Checks aprovados não equivalem a
  política obrigatória de revisão/merge.

- Tentativa de configurar proteção da main pelo console foi bloqueada pela
  revisão automática de aprovação: mudança persistente de controle de acesso
  exigindo autorização específica. Nenhuma regra foi criada.
