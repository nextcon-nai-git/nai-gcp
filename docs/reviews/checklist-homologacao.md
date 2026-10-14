# Checklist de encerramento da revisão NAI-GCP

Escopo inventariado em 13/10/2026: 106 páginas e 68 rotas de API em `src/app`.
Cobertura automatizada, leitura de código e homologação operacional são medidas
separadas. Não existe percentual global atestado de revisão linha a linha.

Atualização de evidências em 14/10/2026: PRs #114–119 e #68, #74, #75 integrados.
A quantidade de PRs ou testes não é um percentual de homologação operacional.

Cada item só pode ser concluído com evidência vinculada ao commit ou ambiente
correspondente. Uma aprovação de teste sintético não conclui um fluxo real.

| Item                      | Critério de encerramento                                                                  | Estado e evidência atual                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qualidade de código       | Tipos, formatação, testes, lint e build aprovados no SHA integrado                        | PR #119 integrado após CI aprovado: 1.476 testes da aplicação, 129 de regras, tipos, lint, builds e CodeQL. Avisos de lint permanecem.                              |
| Regras de dados           | Firestore e Storage sem falhas de isolamento, concorrência e integridade                  | 129 testes aprovados no CI do PR #119 com CLI 15.33.0. Storage publicado; Firestore recebeu restrições fiscais, sem publicação integral da main.                    |
| Reservas de prestadores   | Identidade fiscal, duplicidade e atualização concorrente protegidas                       | Reserva com ID divergente bloqueada; regras fiscais publicadas, recarregadas e comparadas. 22 testes da combinação publicada aprovados.                             |
| Documentos e contratos    | Fonte original preservada, reimportação idempotente, erro sem falso sucesso               | Regra Storage create-only publicada e conferida. Fluxo completo de importação em homologação permanece pendente.                                                    |
| Segurança de dependências | Alertas altos/críticos resolvidos ou risco avaliado com mitigação documentada             | PR #118 corrigiu Jaeger: 10 pacotes afetados classificados como altos, 60 moderados, zero críticos. Riscos transitivos permanecem; ver avaliação de 14/10.          |
| Navegação e interface     | Conferir estados normais, vazios, erro e retomada das páginas por perfil                  | Sessão SUPER_ADMIN confirmada; dashboard e 48 destinos do menu inspecionados. Não equivale à homologação funcional das 106 páginas por perfil.                      |
| Cadastros e importações   | Clientes, colaboradores, prestadores e arquivos persistem sem duplicar nem cruzar tenants | Regressões automatizadas disponíveis; confirmação funcional autenticada pendente.                                                                                   |
| Fila clínica              | Agendamento, check-in, revisão profissional do original e conclusão coerentes             | Implementado e testado com fixtures; homologação clínica pendente, sem decisões clínicas automatizadas.                                                             |
| Comercial e financeiro    | Proposta, aprovação, contrato, implantação, produção, cobrança e recebimento coerentes    | Testes disponíveis; condições comerciais não representadas estão no relatório remanescente.                                                                         |
| Omie e fiscal             | Consultas conciliadas; operações externas homologadas em ambiente próprio                 | Conexão Omie e consulta paginada confirmadas. Emissão direta indisponível; baixas bidirecionais não homologadas.                                                    |
| Assinatura e eSocial      | Certificado, provedor, assinatura, transmissão e recibo verificados                       | Pendente; rascunhos e mocks não equivalem a protocolos válidos.                                                                                                     |
| Webhooks e comunicações   | Autorização, validação de entrada, limites e erros seguros                                | PR #115 integrado: validação, limite de corpo e erros seguros; 21 testes focados. Nenhuma mensagem enviada.                                                         |
| Domínio e deploy          | SHA publicado confirmado; regras/índices publicados separadamente                         | App Hosting confirmado em ef14822 (PR #75), incluindo #118. Sem www não configurado no backend; workflow de regras falhou por credencial ausente.                   |
| Recuperação               | Backup/PITR configurados e restauração exercitada em ambiente isolado                     | Console confirmou backups programados e PITR desativados. Restauração isolada não exercitada.                                                                       |
| Governança de acesso      | Perfis e chaves restritos; proteção de main conferida                                     | API confirmou main protected=false. Formulário enviado, mas GitHub exige confirmação Mobile em modo sudo; proteção ainda não salva. Credencial do workflow ausente. |

Não encerrar esta lista reduzindo escopo, ocultando avisos, desabilitando testes,
criando dados clínicos presumidos ou tratando serviços explicitamente
indisponíveis como implementados. Integrações ausentes e acesso externo devem
permanecer como pendências concretas, com causa e próximo passo.

## Validação intermitente corrigida no PR #119

A execução da main após #75 estourou limites no teste concorrente de contratos
e em etapas seguintes. A reprodução local identificou que o CLI 14.22.0
descartava respostas JSON do runtime de Storage quando chegavam juntas.
Um ensaio com os parsers publicados confirmou zero respostas encaminhadas
na versão antiga e ambas encaminhadas na 15.33.0, juntas ou fragmentadas.

O comando de testes agora fixa 15.33.0 e exige Java 21. O teste de concorrência
recebe 60 segundos para acomodar contenção documentada do emulador; os demais
prazos, chamadas concorrentes e asserções de segurança permanecem. Logs de
falha são retidos por sete dias, preservando o código de saída do teste.

No CI do SHA 64c2c32, 1.476 testes de aplicação e 129 de regras passaram;
checks de qualidade, builds e CodeQL aprovaram. O limite bloqueante de
criticidade da auditoria de produção e da revisão de dependências não foi
excedido. Já o comando `npm audit --audit-level=high` segue reprovando pelos
alertas documentados: seu job usa `continue-on-error: true`, portanto a cor
verde do job não representa aprovação da auditoria nem resolução dos riscos.
A execução local do novo CLI encontrou falhas de consulta entre emuladores
no ambiente com proxy; isso foi registrado no PR e não tratado como aprovação.
O código do CLI aplica ProxyAgent inclusive às requisições de loopback quando
HTTP(S)_PROXY está definido. Não houve alteração das restrições de rede locais.

O PR altera somente a infraestrutura de testes. Não publica regras clínicas,
não ativa backups e não homologa integrações externas.

## Atualização de revisão — 14/10/2026

Esta execução ampliou o fluxo de contrato no código, mas não acessou consoles,
contas de produção, credenciais, provedores nem dados reais. As condições podem
ser registradas no contrato ou com referência de aditivo. O CNPJ do tomador é
validado e, quando o cadastro vinculado contém CNPJ válido, precisa coincidir
com ele. Código de serviço é somente o valor informado; nenhuma classificação
fiscal é inferida. Setup e êxito permanecem separados da mensalidade e não criam
previsões, títulos ou receita automaticamente. Prazo contado da emissão e grade
persistem como condições, mas bloqueiam a geração de títulos neste fluxo até
existir cálculo e evidência compatíveis. Nomes informados não comprovam
assinaturas. Validade impressa da certidão e status/evidência de consulta ao
emissor são campos independentes e não autenticam o documento.

### Frentes que exigem acesso operacional

- **Backup/restore:** o último registro do Console informa backups programados e
  PITR desativados, sem restauração isolada exercitada. Administrador do projeto
  deve aprovar retenção/custo, configurar proteção e realizar restauração em
  ambiente isolado, registrando resultado e integridade.
- **Proteção da `main`:** o último estado observado foi `protected=false`; a
  tentativa no Console exigiu confirmação Mobile em modo sudo. Um mantenedor
  autorizado precisa aplicar e verificar a política de revisão/checks. Esta
  execução não alterou permissões ou proteção.
- **DNS sem `www`:** o último estado observado no App Hosting foi configuração
  necessária para o domínio sem `www`; `www` estava conectado. Responsável DNS
  precisa validar e aplicar o registro solicitado no provedor e confirmar
  resolução/TLS e domínio no backend. Nenhuma alteração DNS foi feita.
- **Regras Firestore/deploy:** o workflow de regras foi bloqueado pela ausência
  de `FIREBASE_SERVICE_ACCOUNT_JSON`. Administrador deve provisionar credencial
  pela governança do repositório e executar validação/publicação aprovada; não
  foi criada nem exposta credencial.
- **Provedores externos:** emissão de NFS-e pelo NAI, sincronização bidirecional
  de baixas Omie, assinatura/certificado, transmissão e recibos eSocial, controle
  físico e mensageria seguem sem homologação ponta a ponta. Exigem ambiente,
  credenciais/certificados autorizados, casos aprovados e aceite do responsável;
  consulta somente leitura, mock ou teste sintético não conclui homologação.
- **Código/deploy atual:** as alterações desta revisão não foram publicadas.
  É necessário CI aprovado no SHA resultante e processo de deploy autorizado.
  Esta sessão não valida funcionalmente as 106 páginas, não publica regras e
  não realiza operações em produção.

Os testes focados desta implementação cobrem compatibilidade de contratos
legados, separação de identidades, persistência sem título automático, bloqueio
de cobranças cujo vencimento depende de emissão/grade e distinção entre validade
impressa e consulta ao emissor. Eles não substituem regras no emulador, revisão
de contrato por responsável, homologação real ou teste de restauração.
