# Homologação do contrato ao recebimento

Rodada de 24 de outubro de 2026. Base funcional: `3dbd7eb` (PR #192).
O objetivo desta rodada é comprovar a integração lógica entre a Central e o ERP
sem concluir exames, emitir NF, gerar cobrança externa ou enviar mensagens reais.

## Escopo e limites da evidência

Os três cenários novos usam `saveProductionCommand`, preservação e leitura de
fonte, esquemas e comandos financeiros reais. Armazenamento, cadastro e leitura
do livro financeiro são substituídos por adaptadores em memória. Todos os registros
são sintéticos. Não há acesso a Firebase, SOC, Omie, bancos ou serviços de envio
nesses testes. A fonte PDF testa preservação e integridade de bytes, não assinatura
ou validade documental. A referência de NF é fictícia e não corresponde a emissão.

Isso comprova regras de serviço e domínio; não constitui homologação do navegador,
do armazenamento real, dos provedores externos ou da operação de produção.

## Roteiro integrado automatizado

Arquivo: `src/services/production-central.test.ts`, grupo
`homologação sintética integrada do contrato ao recebimento`.

| Passagem                        | Verificação realizada                                                                                        | Resultado na execução direcionada        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Proposta e contrato financeiro  | Pedido submetido e aprovado por outro operador; criação do contrato sem título automático                    | Aprovado                                 |
| Upload e cadastro da Central    | Fonte preservada, cliente conferido e obrigação contratual gerada                                            | Aprovado com adaptadores em memória      |
| Formalização e implantação      | Nove cards percorridos por comandos; mensalidade bloqueada antes da implantação                              | Aprovado                                 |
| Execução e revisão              | Produção bloqueada enquanto a tarefa contratual está incompleta                                              | Aprovado                                 |
| Serviço incluído na mensalidade | Segunda revisão e rejeição de cobrança avulsa duplicada                                                      | Aprovado                                 |
| Medição e título                | Mensalidade única, aprovação do título e vínculo ao contrato da Central                                      | Aprovado                                 |
| Registro fiscal                 | Medição e referência fictícia de NF registradas, sem emissão externa                                         | Aprovado no domínio; emissor não testado |
| Pagamento parcial               | Baixa de R$ 40 e conciliação; encerramento rejeitado, sem alteração persistida                               | Aprovado                                 |
| Quitação com ajuste             | Baixa residual de R$ 60, com R$ 10 de retenção sintética e R$ 2 de juros; fechamento bloqueado até conciliar | Aprovado                                 |
| Conciliação final               | Principal líquido de R$ 90, ajuste de R$ 10, caixa de R$ 92 e saldo zero para título de R$ 100               | Aprovado                                 |
| Encerramento do ciclo           | Nove cards e uma tarefa concluídos; contrato recorrente permanece ativo                                      | Aprovado                                 |
| Estorno posterior               | Exige desfazer conciliação; depois do estorno o vínculo fica divergente e impede encerrar contrato           | Aprovado                                 |
| Repetição e concorrência        | Repetição do comando confirmado não grava novamente; nova operação com versão antiga recebe 409              | Aprovado                                 |
| Histórico                       | Fonte e eventos anteriores preservados; tentativas rejeitadas não alteram o livro                            | Aprovado                                 |

Executar:

```sh
npx vitest run src/services/production-central.test.ts
npm run test:run
npm run type-check
npm run format:check
npm run lint
```

A execução direcionada aprovou 54 testes nos três arquivos de serviço, hook e
página. A primeira execução geral após a correção aprovou 2.966 de 2.968 testes;
dois testes preexistentes excederam o limite de 5 segundos (página NXC e leitura
PDF). A repetição com concorrência reduzida é uma verificação separada; não
omitir esses resultados nem considerar timeout como aprovação. TypeScript,
formatação e lint passaram sem erros (1.271 avisos preexistentes).

O build de produção não foi repetido localmente nesta rodada. Os checks do PR,
incluindo suíte completa, emulador de regras e build, são evidência separada e
devem ser associados ao SHA testado antes de mesclar/publicar. O resultado de
publicação também precisa ser confirmado no App Hosting e na tela autenticada.

## Evidências de produção

A sessão autenticada confirmou o perfil interno SUPER_ADMIN. A Central em
`/production` carregou sem registros selecionáveis e com contadores zerados. Isso
não comprova ausência de contratos no acervo: a vinculação dos registros antigos
à Central permanece por verificar. O procedimento completo abriu com suas nove
seções; a busca sem acento `conciliacao` encontrou quatro seções. As nove instruções
de trabalho também carregaram. Nenhum registro operacional foi alterado.

Ao abrir `/contracts`, a consulta ao acervo recebeu `permission-denied` do Firestore
e o listener global levou a página à tela de falha crítica. A cópia integral das regras publicadas, obtida no console, não contém a regra
de listagem de contratos para equipe interna presente no código-fonte. A versão
marcada como publicada no console é de 22/10/2026 às 16:08, no fuso exibido. O deploy comum da aplicação não publica regras do Firestore: o workflow
exige acionamento específico. A comparação também encontrou diferenças clínicas fora deste escopo; portanto,
não publicar todo o arquivo como correção isolada do acervo.

A correção desta rodada permite tratamento local de erros de permissão somente
por opção explícita. O acervo já limpa dados privados e interrompe importações
quando há erro; agora pode exibir essa negativa e um acesso à Central sem acionar
a falha global. A negativa continua válida, e nenhuma regra ou consulta foi ampliada.
Consumidores com tratamento global e local usam assinaturas separadas, para um
consumidor local não suprimir o erro global de outro. Os testes cobrem limpeza dos
dados em cache, assinatura posterior e coexistência dos dois modos.

O ERP `/financial/operacoes` abriu mediante consulta explícita. A visão Contratos
não mostrou contratos, e o painel exibiu valores gerenciais zerados na competência
2026-10. Isso não substitui conferência do Omie nem prova inexistência de títulos
em outros módulos.

A aba Esteira de ASOs do Grupo AVP carregou a campanha e mostrou 1.972 participantes,
com limite de 100 na tabela e contadores zerados de cobranças atrasadas, prontos
para revisão de envio e entregues com referência. A leitura funcionou; não foram
abertos casos, modificados pedidos, substituídos PDFs, gerados kits ou enviados
ASOs. Esses contadores não constituem auditoria individual dos participantes.

As consultas HTTP sem autenticação a `/api/production`, `/api/production/finance`
e `/api/clients/grupo-avp/workflow` retornaram 401. Isso comprova rejeição desse
acesso, não isolamento entre dois clientes ou correção dos dados reais.

## Correção de permissão preparada, ainda não publicada

Para o acervo, a diferença necessária é acrescentar este bloco dentro de
`match /databases/{database}/documents`, preservando as demais regras publicadas:

```text
match /{path=**}/contracts/{contractId} {
  allow list: if isNextconOfficial();
}
```

`isNextconOfficial()` já existe na configuração publicada. O bloco autoriza
somente listagem por equipe interna; não acrescenta escrita, acesso anônimo ou
listagem global por cliente. O teste existente
`tests/rules/contracts-import.test.ts` cobre a consulta limitada e ordenada do
acervo para SUPER_ADMIN, ADMIN e OPERATIONS internos e nega a clientes e anônimos.
Os checks de regras do GitHub devem passar no SHA revisado. Não confundir esses
testes no conjunto do repositório com um ensaio da configuração antiga publicada.

A cópia publicada comparada tem SHA-256
`edb1a53f698493b2877d44fdec45dd691e09844150de6091e73148c345f9414d`.
Uma configuração preparada somente com esse bloco (e comentário explicativo) tem
SHA-256 `edd81bc8a5d807dbe9acdd01187cae9e93784f213b8385231ef80b9ceb841573`.
Antes de publicar, conferir que a configuração ativa não mudou desde a leitura.

A publicação pelo navegador é uma alteração de acesso a documentos privados e
exige confirmação específica no momento da ação. Até isso ocorrer, o acervo
continua sem a permissão necessária; o tratamento local evita apenas a falha global.

## Portas ainda abertas para homologação operacional

| ID  | O que executar                                                                          | Responsável                     | Evidência necessária para fechar                                                       |
| --- | --------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| H01 | Entrar com perfil interno autorizado e abrir Central, guia e cards                      | Administrador interno           | Tela carregada, versão publicada e perfil confirmados                                  |
| H02 | Percorrer contrato sintético no ambiente de homologação                                 | Comercial e Operações           | Upload real, extração conferida, responsáveis, prazos e histórico                      |
| H03 | Testar duas sessões editando o mesmo registro                                           | Operações                       | Um salvamento aceito e conflito explícito na outra sessão, sem perda de histórico      |
| H04 | Validar periódicos AVP em ambiente isolado, incluindo correção de pedido e troca de PDF | Equipe AVP                      | Vínculos corretos e invalidação da revisão/entrega antiga, sem envio de ASOs           |
| H05 | Homologar emissão fiscal e cobrança no ambiente de testes do emissor                    | Financeiro e responsável fiscal | Autorização/rejeição/cancelamento e vínculos comprovados; nenhuma NF real nesta rodada |
| H06 | Homologar retorno de baixa e conciliação com conectores de testes                       | Financeiro                      | Parcial, retenção, duplicidade, estorno e saldo final conferidos                       |
| H07 | Verificar papéis interno, cliente, clínica e médico com contas de teste                 | Administração                   | Leitura/escrita permitidas e negadas conforme papel, sem ampliar permissões            |
| H08 | Ensaiar recuperação de backup e indisponibilidade das integrações                       | Administração técnica           | Restauração verificada, tempo medido e procedimento de recuperação                     |
| H09 | Treinar operadores e revisar cadastros                                                  | Gestor de cada área             | Execução acompanhada, pendências atribuídas e aceite operacional                       |

H01 está parcialmente comprovado: sessão, Central e guia carregam; os cards não
puderam ser exercitados porque não havia registros na Central. H02 a H09 continuam
pendentes de evidência operacional. A autorização do acervo também permanece aberta. Não usar dados de clientes
reais como massa descartável. Não registrar assinatura, exame realizado ou entrega
por inferência. Não criar cobranças externas nem enviar mensagens para testar telas.

## Critério de conclusão

Considerar um fluxo homologado somente após registrar ambiente, versão, cenário,
perfil, resultado observado, evidência e revisor. Bloqueios e cenários não executados
permanecem abertos. O sucesso dos testes automatizados não autoriza declarar o
sistema inteiro como 100 por cento concluído.
