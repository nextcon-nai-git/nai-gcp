# Validação e entrada em operação do NAI

## Objetivo

Este roteiro orienta a validação de uma versão candidata com dados sintéticos e evidências
reproduzíveis. Publicação, provisionamento, execução de uma rotina e aceite do processo de negócio
são etapas distintas. Nenhuma quantidade de testes automatizados substitui o aceite das pessoas
responsáveis pela operação e pela revisão técnica.

Durante a validação desta entrega, manter `ESOCIAL_TRANSMISSION_ENABLED=false` e
`ASO_CLIENT_EMAIL_SEND_ENABLED=false`. Não instalar certificado A1, enviar eventos ao eSocial,
acionar e-mails a clientes, gerar links para usuários reais ou usar documentos clínicos reais para
exercitar falhas. Testes externos posteriores exigem ambiente, destinatários e escopo definidos.

## 1. Identificar a versão e a evidência

Antes de começar, registrar em um relatório sem dados pessoais:

- commit candidato e PRs incluídos;
- links dos jobs de CI, validação Firebase e Security daquele código;
- commit efetivamente publicado e resultado do rollout no App Hosting;
- ambiente e horário UTC de cada verificação;
- responsáveis por execução e revisão;
- itens aprovados, reprovados, não executados e bloqueados, separadamente.

Não transferir resultados de um commit anterior automaticamente para outro. Quando uma mudança
posterior afetar o cenário, repetir apenas a validação necessária. Conservar a evidência anterior
com sua versão, em vez de reescrever o histórico como se fosse uma validação atual.

O workflow de índices é independente do build. Se ele falhar por configuração de autenticação,
registrar a falha mesmo quando os índices tiverem sido ativados por outro meio. Um job ignorado ou
não executado não conta como aprovação.

## 2. Preparar dados e contas de teste

Usar um ambiente isolado e autorizado para qualquer teste que grave dados. Criar duas empresas
sintéticas, dois colaboradores sem identidade de pessoas reais e documentos de teste identificados
como sintéticos. Manter uma cópia imutável dos arquivos de entrada para repetir os cenários.

Definir contas de teste com os papéis que a aplicação já admite: administrador global, operação
interna, usuário vinculado à empresa A, usuário vinculado à empresa B e convidado de clínica com
convite vigente. Conferir os vínculos reais utilizados por cada módulo; o nome de um papel, sozinho,
não comprova acesso. Não alterar contas de produção para simular suspensão ou troca de empresa.

Verificar acesso negado com credencial ausente, perfil suspenso, vínculo removido e empresa errada.
Uma sessão que já estava aberta também precisa perder a capacidade de realizar novas etapas após
a revogação observada. Preservar os registros técnicos de operações já concluídas legitimamente.

Há uma decisão de escopo pendente no portal clínico: o acesso histórico ao ASO pelo proprietário
usa `ownerUid` e papel permitido, sem conferir a empresa atual. Uma troca de empresa mantendo o
mesmo UID ativo não revoga automaticamente esse acesso. Definir se a propriedade histórica deve
continuar válida; se a regra exigir escopo da empresa atual, persistir e validar um vínculo
confiável, incluindo o tratamento dos registros antigos. Não declarar aprovado o teste de revogação
por empresa nesse caminho enquanto essa política não for decidida e verificada.

## 3. Conferir a esteira de ASOs

| Cenário                                                                           | Resultado esperado                                                       | Evidência mínima                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| Importar um pedido e o PDF sintético correspondente                               | Um único registro com identidade e origem conferíveis                    | Identificadores sintéticos, estado e hash do arquivo |
| Repetir a mesma importação após perda de confirmação                              | Nenhuma tarefa duplicada e nenhum progresso apagado                      | Mesmo identificador e histórico preservado           |
| Repetir tentativa antiga com identidade, SOC ou PDF divergente                    | Recusa explícita, sem substituir o documento conferido                   | Resposta de conflito e estado anterior preservado    |
| Substituir deliberadamente um PDF em card mutável, com autorização e versão atual | Histórico preservado e nova conferência exigida                          | Nova versão, autoria e revisão reaberta              |
| Receber o retorno de uma clínica                                                  | Documento recebido para conferência, sem afirmar validação de assinatura | Arquivo disponível e etapa de revisão pendente       |
| Trocar o anexo escolhido no quadro                                                | Confirmações do anexo anterior são limpas                                | Nova seleção exige conferência própria               |
| Clicar duas vezes ou tentar fechar o card durante a recepção                      | Uma operação de gravação e resultado coerente                            | Contagem de requisições e estado final               |
| Revisar o documento                                                               | Só dados efetivamente conferidos avançam                                 | Autor, instante e transição de estado                |
| Tentar envio a cliente com o bloqueio ativo                                       | Envio recusado e nenhum e-mail externo                                   | Bloqueio e ausência de chamada ao adaptador          |
| Consultar documento da esteira de ASOs de outra empresa                           | Acesso negado sem bytes ou metadados sensíveis                           | Resposta e isolamento verificados                    |

A aprovação de um arquivo no sistema não comprova sua autenticidade profissional, sua adequação
clínica ou o cumprimento de uma obrigação legal. Essas conclusões pertencem à revisão técnica
aplicável e devem ter evidência própria.

No portal clínico, verificar separadamente os convidados de recepção e de medicina. A recepção não
recebe ficha clínica, resultados, conclusão ou PDF. Um terceiro com link encaminhado deve ser negado.
O responsável interno mantém o acesso operacional ao ASO recebido, sem obter a ficha clínica por
esse caminho. Exercitar também a revogação do convite durante o upload e o download.

## 4. Exercitar falhas e recuperação

Os testes automatizados devem usar falhas determinísticas e dependências sintéticas. Não provocar
indisponibilidade, timeout ou corrupção deliberada nos serviços de produção.

Conferir pelo menos:

- gravação concluída com confirmação perdida;
- gravação recusada antes do commit;
- duas operações concorrentes sobre o mesmo registro;
- alteração de acesso entre leitura inicial e confirmação;
- objeto ausente, conteúdo diferente do hash esperado e tamanho acima do limite;
- resposta externa 429, resposta malformada e interrupção durante leitura;
- resultado incerto após uma requisição externa que pode ter sido recebida.

No último caso, não reenviar automaticamente apenas para obter uma resposta. Conservar a reserva,
o identificador da tentativa e os indícios disponíveis; conciliar o resultado antes de autorizar
uma nova ação. Um arquivo que possa estar referenciado por um commit não pode ser removido porque
o cliente da aplicação deixou de receber a confirmação.

As transações do Firestore não incluem Firebase Auth, Storage, Secret Manager ou provedores
externos. Documentar os resíduos e os caminhos de recuperação dessas fronteiras; não apresentar
uma sequência de chamadas como se fosse uma única transação distribuída.

## 5. Verificar infraestrutura e execução

Seguir [Ativação segura da infraestrutura eSocial](ESOCIAL_INFRASTRUCTURE.md) para WIF, contas
separadas, IAM mínimo, cofre vazio, OIDC e correlação de logs. Não usar uma chave JSON permanente
como atalho para uma federação ainda não configurada.

O bloqueio de novas transmissões não impede a conciliação de respostas antigas nem outras
atualizações da fila. Antes de um ensaio que pretenda ser inerte sobre os dados de negócio, conferir
fila elegível vazia ou usar ambiente isolado. Se isso não puder ser comprovado, registrar o ensaio
como bloqueado; não apagar, cancelar ou alterar eventos reais para preparar o teste.

| Camada             | Critério de aceite                                                | Limite da evidência                       |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------- |
| Código             | Testes, tipos, lint e build aprovados no commit registrado        | Não prova configuração ou serviço externo |
| Publicação         | Rollout concluído para o commit candidato                         | Não prova provisionamento                 |
| Cofre              | Metadados acessíveis, zero versões e políticas conferidas         | Não comprova assinatura nem transmissão   |
| Agendador          | Alvo, método, conta, audience, frequência e estado conferidos     | Não comprova execução                     |
| Execução OIDC      | Tentativa correlacionada com o handler correto e resultado inerte | Não homologa o eSocial                    |
| Homologação futura | Cenários restritos, A1 autorizado e recibos reais correlacionados | Não autoriza automaticamente produção     |

O painel em `/admin/operations` é de consulta para administrador global. Distingue configuração
presente, ausência de evidência, atraso, execução parcial e falha. Um contador zero, um HTTP 200 ou
um token aceito não demonstra que houve atualização de dados de negócio. Confrontar os contadores
com o cenário esperado e a origem dos dados.

Ver [Observabilidade operacional](OPERATIONS_OBSERVABILITY.md) para campos, limites de
persistência e filtros. A instrumentação não configura um canal de alertas: destinatário,
responsável, escala de atendimento e teste de notificação permanecem decisões operacionais.

## 6. Validar backup e recuperação de forma separada

Usar [Backup e recuperação](BACKUP_RECOVERY.md) para conferir um pacote de exportação já concluída.
O kit local verifica integridade de arquivos e uma cópia de recuperação. Ele não exporta o banco,
não cria cópia externa, não restaura Firestore e não prova consistência entre banco, Storage e Auth.

A [proposta de backup nativo diário](FIRESTORE_BACKUP_PLAN.md) registra a configuração de sete
dias, o estado observado e a fórmula de custo. Ela permanece uma proposta para revisão, sem
programação salva ou restauração executada.

Antes de declarar recuperação operacional aprovada:

1. Definir o conjunto de dados e configurações necessário para recuperar o serviço, incluindo os
   componentes que não fazem parte de uma exportação do Firestore.
2. Definir retenção, criptografia, localização da cópia e quem pode restaurar.
3. Aprovar metas de perda máxima de dados e tempo de recuperação. Registrar valores medidos; não
   prometer metas que ainda não foram ensaiadas.
4. Restaurar em destino isolado e autorizado, sem sobrescrever produção.
5. Conferir contagem e amostra de registros, vínculos entre empresas, objetos referenciados e
   permissões. Exercitar uma operação sintética no ambiente recuperado.
6. Registrar duração, ponto de recuperação, falhas, dependências e limpeza controlada.

Não executar restauração de produção nem exclusão de resíduos como parte de um simples teste do
kit. Arquivos clínicos recuperados exigem os mesmos controles de acesso e retenção dos originais.

## 7. Não confundir disponibilidade de tela com entrega de integração

A tela CASSI deve indicar quando a operação integrada está indisponível. Consultar uma referência
contratual ou abrir o agendador não comprova criação de ordem, faturamento, SLA cumprido ou devolutiva
enviada. A futura integração precisa demonstrar persistência, autoria, consistência e resultado.

O Audit Studio deve indicar a indisponibilidade da auditoria automática enquanto não houver
análise efetiva com evidências e revisão. Uma resposta fixa, percentual constante de confiança ou
risco de exemplo não pode ser apresentado como conclusão sobre um cliente real.

Uma busca de clínicas deve conservar a distinção entre contato local verificado e sugestão do
provedor. Um nome retornado pela busca não prova credenciamento, capacidade técnica, disponibilidade,
preço ou aceitação pela operadora. Conferir os dados necessários antes de encaminhar o atendimento.

Integração Google Drive, backup externo, alertas, homologação eSocial e e-mail a clientes precisam
de evidências próprias antes de serem anunciados como ativos.

## 8. Liberação gradual e acompanhamento

A liberação para operação interna exige aceite de um percurso completo por uma pessoa que realizará
o trabalho: entrada, conferência, tratamento de erro, retomada e conclusão. Registrar os pontos de
confusão e corrigir o fluxo antes de ampliar a utilização.

Manter um responsável por acompanhamento e um caminho claro para interromper novas ações externas.
No início, acompanhar uma carga delimitada e definida pela equipe; medir tempo de conclusão, erros,
pendências e necessidade de intervenção. O volume inicial e os limites aceitáveis devem ser acordados
com a operação, e não inferidos da aprovação do build.

Uma reversão de código usa uma versão publicada conhecida e deve preservar os dados e os recibos
já produzidos. Antes de reverter, verificar compatibilidade com dados gravados pela versão mais
nova. Reversão não desfaz e-mail, transmissão ou efeito externo já realizado.

## Registro de aceite sugerido

Para cada cenário, registrar: versão, ambiente, responsável, horário UTC, entrada sintética,
resultado esperado, resultado observado, evidência, pendência e decisão do revisor. Usar
`aprovado`, `reprovado`, `não executado` ou `bloqueado`; evitar um único percentual de prontidão que
oculte um bloqueio essencial.

O aceite final é condicionado aos cenários e ao uso definidos. Novos clientes, volumes, integrações
ou obrigações podem exigir nova validação. Este roteiro não declara o NAI homologado.
