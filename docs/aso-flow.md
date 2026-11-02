# Esteira de ASOs: planilha, cards, documentos e mapa

## Problema corrigido

A importação AVP, o agendador por usuário, a agenda clínica e os kits tinham persistências diferentes. O avanço genérico de cards podia registrar envio, confirmação da clínica e conclusão sem executar ou comprovar a ação. O mapa de periódicos dependia da planilha e não refletia os casos salvos na esteira AVP.

Esta alteração acrescenta uma esteira compartilhada por cliente e colaborador em **ASO — Agendamento e Clínica → Esteira** (`/health-control?tab=esteira`). NAI importa oferece o botão **Importar planilha de ASOs**; o cadastro do cliente oferece **Cards e pasta de ASOs** com filtro do cliente. Os registros legados continuam identificados em suas áreas e não são migrados ou vinculados por nome.

## Entrada por planilha

CSV e XLSX com uma aba preenchida, até 5.000 linhas e 10 MB. O navegador faz prévia em lotes de 200 e o servidor refaz a identificação no momento da gravação. A confirmação importa somente as linhas liberadas. Após uma interrupção, reimportar preserva os cards já criados.

| Coluna          | Regra                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| CNPJ empregador | Cliente ativo único no cadastro; não é o CNPJ da clínica                    |
| CPF             | Colaborador único desse cliente, com vínculo compatível com o tipo de exame |
| Colaborador     | Nome deve corresponder ao CPF cadastrado                                    |
| Cidade / UF     | Local do atendimento/trabalho informado, com UF válida                      |
| Unidade         | Estabelecimento ou vínculo informado na origem                              |
| Tipo de exame   | Admissional, periódico, demissional, retorno ou mudança de risco            |
| Competência     | Ciclo real no formato AAAA-MM ou MM/AAAA                                    |
| Cargo / setor   | Opcionais; quando preenchidos, devem corresponder ao cadastro               |

Clientes/colaboradores ausentes, homônimos, CPF/CNPJ inválidos, dados divergentes e duplicidades de cadastro ficam em conferência. Não há criação de cadastro por aproximação de nome nem escolha automática de outro CNPJ. A identidade do card combina cliente, colaborador, unidade, cidade/UF, tipo e competência. O fingerprint do CPF permite detectar uma alteração posterior do cadastro.

Para retorno ao trabalho, o vínculo pode estar ativo ou afastado; para demissional, ativo ou desligado; para os demais tipos, ativo. Essa regra valida a situação cadastral para a operação, sem alterar o cadastro ou estabelecer aptidão médica.

## Ações e evidências

| Ação                             | Resultado e requisito                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Registrar agendamento confirmado | Clínica ativa vinculada ao cliente, data, horário e referência da confirmação                                           |
| Abrir SOC                        | Abre o acesso operacional existente; não afirma criar pedido automaticamente                                            |
| Anexar kit SOC                   | PDF efetivamente emitido no SOC, código de empresa, número de pedido e confirmação de identidade                        |
| Enviar kit                       | Gmail configurado, destinatário atual da clínica e confirmação da equipe; resposta real do provedor grava o comprovante |
| Registrar envio externo          | Referência do envio já realizado; identificado como registro manual no histórico                                        |
| Confirmar exame                  | Registra comparecimento com data real                                                                                   |
| Receber ASO                      | PDF, identificação, data, origem e referência conferidos pela equipe                                                    |
| Conferir ASO                     | Confirma documento/identidade, vincula o hash e registra o arquivo privado na pasta do cliente                          |
| Enviar ASO                       | Exige o mesmo arquivo conferido/arquivado e o email cadastrado do cliente; só após resposta de envio o card é encerrado |
| Cancelar / registrar falta       | Exige motivo; não permite ignorar um ASO já recebido                                                                    |

Os PDFs têm até 5 MB, assinatura de arquivo `%PDF-`, hash SHA-256 e acesso autenticado. Essa verificação de integridade não comprova assinatura digital, aptidão ou validade clínica. A revisão operacional não substitui o ato médico. Ficha clínica, prontuário e pedido de exame não devem ser confirmados como ASO.

Arquivos são mantidos em caminho privado por cliente, colaborador, card, tipo e hash. O índice da pasta é privado e acessível pela esteira filtrada do cliente; não se publica o documento em link anônimo ou em acervo geral. A nova versão do PDF exige nova conferência. Reanexar o mesmo PDF não limpa a revisão nem a entrega. O nome canônico do ASO contém colaborador, data e cidade.

## Mapa

O mapa da esteira usa os mesmos cards carregados e o resultado confirmado de cada ação:

- Vermelho: a preparar.
- Verde: agendado, kit enviado ou aguardando ASO.
- Azul: ASO recebido, conferido ou enviado/encerrado.
- Amarelo: cancelamento ou falta.

A conclusão da entrega permanece indicada no card; azul significa recebimento do ASO, e não recebimento do email pelo cliente. Não há alteração das faixas do mapa de custos.

No mapa AVP existente, a API de periódicos também projeta os casos da esteira AVP anterior por identidade exata (`sourceId + unidade + admissão`). Status original e operacional ficam separados. Casos ambíguos, pendências de identidade, cancelamentos ou conflitos não recebem cor de sucesso por inferência. Salvar um caso atualiza o mapa da mesma sessão sem aguardar o ciclo horário da planilha. Cards novos da esteira genérica são refletidos no mapa dessa própria esteira; uma migração dos registros anteriores requer conciliação explícita dos vínculos.

## Gmail: preparação e ativação

O transporte utiliza a biblioteca Google já instalada e OAuth com atualização de credencial no servidor. A conexão Gmail usada pelo assistente fora do NAI não configura automaticamente o aplicativo.

Variáveis necessárias no ambiente/Secret Manager:

| Variável                      | Uso                                                              |
| ----------------------------- | ---------------------------------------------------------------- |
| `ASO_GMAIL_ENABLED`           | `true` para habilitar a configuração                             |
| `ASO_GMAIL_MAILBOX`           | Email principal da caixa autorizada                              |
| `ASO_GMAIL_CLIENT_ID`         | Aplicativo OAuth autorizado                                      |
| `ASO_GMAIL_CLIENT_SECRET`     | Segredo OAuth, somente no servidor                               |
| `ASO_GMAIL_REFRESH_TOKEN`     | Credencial autorizada para a caixa, somente no servidor          |
| `ASO_MAIL_SYNC_INVOKER_EMAIL` | Identidade OIDC do job de leitura                                |
| `ASO_MAIL_SYNC_AUDIENCE`      | Audiência exata da rota interna do monitor                       |
| `ASO_MAIL_OPERATOR_UID`       | Perfil NAI existente que define a carteira autorizada do monitor |

O consentimento deve cobrir `gmail.readonly` e `gmail.send`. Os tokens não passam pelo navegador, PR, logs ou respostas. Antes de qualquer operação Gmail, `getProfile` verifica que a conta autorizada é a caixa configurada. Variáveis presentes indicam **configuração**, não validação operacional de credenciais, escopos ou execução do job.

`POST /api/internal/aso-mail-sync` aceita somente OIDC com emissor verificado, audiência e email configurados. O perfil do operador é relido a cada chamada; suspensões e restrições de carteira permanecem válidas. Provisionar um job periódico para essa rota é etapa de implantação separada e deve ser validado pelo histórico real de execução. Esta alteração não cria o job nem concede escopos.

### Envio e recuperação

O envio reserva o card em transação após revalidar operador, CPF/vínculo, cliente, clínica, destinatário e arquivo. A reserva e outbox usam o hash do documento e destinatário. A resposta Gmail produz um identificador real; comprovante, estado do card e liberação da reserva são gravados na mesma transação.

Não há repetição automática do POST de envio. Timeout, queda do processo ou resposta incerta mantêm a reserva e o card aberto. **Verificar envio** procura o `Message-ID` exato em Enviados e confere o destinatário. Não localizar a mensagem não é autorização para reenviá-la. Uma reserva sem comprovante requer conferência operacional antes de liberar repetição; esse PR não adiciona liberação automática por tempo decorrido.

### Retornos

O assunto contém um identificador opaco único do card. O monitor busca PDFs em respostas com esse identificador e remetente igual ao email da clínica. Não associa somente por nome. Cabeçalhos duplicados/ambíguos, estrutura excessiva, anexos inválidos e mensagens sem vínculo não avançam a esteira. Há cursor de leitura e paginação da lista de candidatos.

Anexos recebidos ficam privados como **candidatos**. A equipe abre o original e confirma a identidade e o tipo de documento antes de recebê-lo como ASO. Só então a cor pode passar a azul; a conferência e o envio ao cliente são passos separados. Mensagens fora do assunto rastreado ou enviadas por outro endereço continuam exigindo recepção manual e conciliação.

## Limites de implantação

- Geração de pedido/kit e download de PDF no SOC continuam dependentes de operações e credenciais homologadas. O Exporta Dados existente não é tratado como geração de pedido nem como PDF recebido.
- Gmail e monitor estão implementados com testes simulados; faltam configuração real, concessão de escopos, job e piloto em produção para comprovar operação.
- Agendamento nesta entrega registra uma confirmação efetivamente obtida com a clínica. Não reserva horários numa agenda externa inexistente.
- Encerramento prova envio aceito pelo provedor ou envio externo documentado. Não prova leitura, entrega final na caixa do cliente ou conclusão de obrigações externas.
- As regras existentes negam acesso direto ao namespace `clinic_portal_private` e a caminhos Storage não liberados. Toda leitura/escrita do fluxo passa pelas APIs autenticadas; prestadores restritos e clientes não herdam acesso aos documentos.

## Verificação antes da publicação

Executar TypeScript, testes da importação/esteira/email/mapa e build. Após configurar o ambiente, validar um piloto autorizado com cliente, colaborador, clínica e destinatários reais: importar e reimportar, conferir agendamento/pedido SOC, enviar um kit, localizar resposta, receber/conferir o PDF, conferir pasta, enviar ao cliente e observar mapa/card. Conferir também recusa de outro cliente, falha de envio, repetição do job e troca de PDF. Aprovação de testes locais não substitui esse piloto.

Referências de implementação: [envio Gmail](https://developers.google.com/workspace/gmail/api/guides/sending), [consulta de mensagens](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), [anexos](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages.attachments/get), [OAuth para aplicações de servidor](https://developers.google.com/identity/protocols/oauth2/web-server).
