/** POP 01 transcribed from the approved user-facing manual; read-only training content. */
export type ProcedureBlock =
  | { kind: "heading" | "paragraph"; text: string }
  | { kind: "steps"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };
export interface ProcedureSection {
  id: string;
  title: string;
  blocks: ProcedureBlock[];
}
export interface OperatingProcedure {
  version: string;
  updatedOn: string;
  sections: ProcedureSection[];
}
export const operatingProcedure: OperatingProcedure = {
  version: "1.0",
  updatedOn: "24/10/2026",
  sections: [
    {
      id: "visao-geral",
      title: "Procedimento operacional NAI do contrato ao recebimento",
      blocks: [
        {
          kind: "paragraph",
          text: "POP 01  •  Versão 1.0  •  24 de outubro de 2026  •  Uso interno Nextcon",
        },
        {
          kind: "paragraph",
          text: "Este procedimento orienta Comercial, Operações e Financeiro a conduzir um contrato de SST desde o PDF inicial até a entrega dos serviços, emissão fiscal e conciliação do recebimento. Cada etapa precisa de responsável, prazo e evidência antes da liberação da seguinte.",
        },
        {
          kind: "heading",
          text: "Como os controles se conectam",
        },
        {
          kind: "paragraph",
          text: "A Central de Contratos e Produção é o controle principal das obrigações e dos ciclos. O ERP financeiro controla contratos financeiros, títulos, baixas e conciliação. A Esteira de ASOs do Grupo AVP acompanha os periódicos por colaborador. A equipe deve conferir e vincular esses registros; salvar em uma tela não comprova atualização automática nas outras.",
        },
        {
          kind: "table",
          headers: ["Etapa", "Responsável principal", "Entrega exigida"],
          rows: [
            [
              "Entrada e revisão",
              "Comercial e gestor do contrato",
              "PDF correto, dados revisados e início autorizado",
            ],
            [
              "Implantação",
              "Coordenador operacional",
              "Equipe, rede, dados e cronograma confirmados",
            ],
            [
              "Execução e entrega",
              "Operação e revisor técnico",
              "Serviços comprovados e entrega rastreável",
            ],
            [
              "Medição e NF",
              "Faturamento e responsável fiscal",
              "Medição aprovada, NF válida e cobrança",
            ],
            ["Recebimento", "Financeiro", "Baixa, conciliação e saldo resolvido"],
          ],
        },
        {
          kind: "heading",
          text: "Onde trabalhar",
        },
        {
          kind: "paragraph",
          text: "COMERCIAL / CONTRATOS: cadastro e documentos. IMPLANTAÇÃO / OPERAÇÕES: Central de Contratos e Produção e operação do cliente. FATURAMENTO / FINANCEIRO: ERP, títulos e conciliação. NAI Painel Estratégico: acompanhamento das pendências. Se o item não aparecer no seu perfil, solicite acesso ao administrador; não use a conta de outro operador.",
        },
        {
          kind: "heading",
          text: "Regras de operação",
        },
        {
          kind: "paragraph",
          text: "Upload não equivale a contrato validado. IA propõe dados e tarefas; pessoas conferem o original. Kit gerado não comprova atendimento. NF registrada não comprova autorização fiscal. Pagamento informado pelo cliente não comprova recebimento conciliado. Todo envio de proposta, ASO, NF ou cobrança exige revisão e autorização expressa.",
        },
      ],
    },
    {
      id: "upload",
      title: "1 Receber o contrato e preservar o original",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsável: Comercial. Revisor: gestor do contrato. Local principal: Central de Contratos e Produção, rota /production.",
        },
        {
          kind: "steps",
          items: [
            "Pesquise o cliente pelo CNPJ antes de criar qualquer cadastro. Confira razão social, unidades, contatos e situação ativa. Empresas do mesmo grupo precisam manter seus próprios CNPJs e vínculos.",
            "Pesquise contratos e ciclos existentes. Se o contrato já estiver cadastrado, abra o registro e acrescente o documento ou a versão; não crie outra esteira para corrigir um dado.",
            "Abra a entrada de documento na Central. Selecione o tipo correto: Proposta, Contrato, Anexo ou Aditivo. Para iniciar a execução, preserve o contrato formalizado e os anexos necessários.",
            "Em “Preservar PDF original”, envie o PDF com menos de 10 MB. Aguarde a indicação de fonte preservada. Se houver erro, resolva o envio antes de avançar.",
            "Use a análise por IA quando disponível. Compare os dados extraídos com o PDF, incluindo páginas, cláusulas, tabelas e anexos. Corrija os campos na tela; dado ausente deve ficar pendente para confirmação, sem estimativa.",
            "Selecione explicitamente o cliente correto e confira seu CNPJ. Informe nome do contrato, gestor e referência da conferência. Registre o que falta e quem resolverá cada pendência.",
            "Após a revisão dos campos da próxima seção, use “Salvar e gerar esteira”. Aguarde a confirmação e confira se o contrato ficou no cliente certo. Evite repetir o clique durante o processamento.",
          ],
        },
        {
          kind: "heading",
          text: "Importações anteriores",
        },
        {
          kind: "paragraph",
          text: "A rota /contracts mantém a importação para o SGI. O botão “Integrar SGI” grava contrato e tarefas nesse fluxo legado; não equivale à conclusão da implantação nem à criação de título financeiro. Ao usar um contrato antigo, confira seu registro na Central e no ERP para evitar duplicação de tarefas e cobranças.",
        },
        {
          kind: "heading",
          text: "Nome dos arquivos e referências",
        },
        {
          kind: "paragraph",
          text: "Use identificação consistente, por exemplo: CONTRATO - Cliente - CNPJ - Data - Versão.pdf. Guarde o original e as evidências de aprovação no dossiê com acesso restrito. Na referência de conferência, informe documento, versão, página ou cláusula, data e responsável.",
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  PDF preservado, cliente confirmado, duplicidades verificadas e responsável definido. O upload sozinho não autoriza mobilização ou faturamento.",
        },
      ],
    },
    {
      id: "conferencia",
      title: "2 Conferir dados e autorizar a implantação",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsáveis: Comercial, gestor do contrato e Financeiro. O responsável técnico confere as obrigações de sua área.",
        },
        {
          kind: "heading",
          text: "Conferência obrigatória antes da liberação",
        },
        {
          kind: "table",
          headers: ["Grupo", "O que conferir no original"],
          rows: [
            [
              "Identificação",
              "Contratante e contratada, CNPJs, unidades atendidas, representante e contatos autorizados.",
            ],
            [
              "Vigência e escopo",
              "Início e término, serviços, quantidades, frequência, entregáveis, exclusões e condições de início.",
            ],
            [
              "Valores e cobrança",
              "Mensalidade ou valor avulso, composição do preço, medição, vencimento, despesas, reajuste e condições especiais.",
            ],
            [
              "Formalização",
              "Versão assinada, anexos aplicáveis, poderes dos signatários e evidência do aceite.",
            ],
            [
              "Obrigações",
              "Cláusula de origem, serviço, periodicidade, responsável, prazo e critério de aceitação de cada entrega.",
            ],
          ],
        },
        {
          kind: "steps",
          items: [
            "Revise as etapas comerciais “Elaborar orçamento”, “Preparar e acompanhar proposta” e “Formalizar contrato e liberar início”. Anexe a aprovação interna, o aceite e a referência contratual correspondentes.",
            "Para contrato já assinado, justifique as etapas anteriores que forem não aplicáveis; não invente proposta, negociação ou aprovação retrospectiva.",
            "Confirme que a liberação de início foi registrada. Assinatura pendente, CNPJ divergente ou condição de início não atendida devem bloquear a mobilização.",
            "Defina o ciclo que será executado: competência ou período, unidade, serviços, entregáveis, valor e versão contratual aplicável. Em contrato recorrente, trabalhe por ciclos; mantenha os anteriores preservados.",
            "Revise as tarefas geradas a partir das obrigações. Atribua responsável, prazo e checklist. Não conclua uma obrigação apenas porque o card foi criado.",
          ],
        },
        {
          kind: "heading",
          text: "Ligação com o financeiro",
        },
        {
          kind: "paragraph",
          text: "Em “Vínculo financeiro e encerramento do contrato”, consulte os contratos e títulos do ERP, selecione o contrato correspondente do mesmo CNPJ e registre a evidência da conferência. O vínculo não gera cobrança. Para mensalidade fixa, use “Contrato ao recebimento”; regras por vida, faixas ou pró-rata exigem apuração específica conferida, sem forçar o contrato para mensalidade fixa.",
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  Contrato formalizado, condições de início atendidas, ciclo correto e passagem comercial aceita por Operações e Financeiro.",
        },
      ],
    },
    {
      id: "implantacao",
      title: "3 Implantar o contrato e preparar a execução",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsável: coordenador operacional. Etapa principal: “Implantar e mobilizar”.",
        },
        {
          kind: "steps",
          items: [
            "Realize a passagem do contrato com Comercial e Financeiro. Confirme o que será entregue, para quais unidades, em quais datas e qual condição permitirá faturar.",
            "Solicite ao cliente os dados necessários ao escopo: unidades, colaboradores, funções, locais de trabalho, documentos técnicos e contatos. Registre origem e data da base recebida.",
            "Confira duplicidades, CNPJ e vínculo dos colaboradores. Não associe pessoa a empresa somente pela semelhança do nome. Separe pendências de cadastro das tarefas já liberadas.",
            "Confirme equipe técnica, qualificação, capacidade e revisores. Para cada prestador ou clínica, confira localidade, contato, exames ou serviços disponíveis, preço aprovado e condições de atendimento.",
            "Defina cronograma, agenda, recursos e prazo de devolução dos documentos. Cada obrigação precisa de responsável e prazo. Avise o gestor sobre atrasos que afetem o contrato.",
            "No checklist de implantação do ERP, quando utilizado, confira dados e unidades, escopo, equipe ou rede e cronograma. Justifique a conferência e respeite o bloqueio de cobrança quando o contrato depender da implantação concluída.",
            "Conclua a mobilização somente após resolver os bloqueios. Com prestador indisponível, dados incompletos ou preço pendente, registre o motivo, o responsável e a nova previsão.",
          ],
        },
        {
          kind: "heading",
          text: "Execução dos serviços de SST",
        },
        {
          kind: "paragraph",
          text: "Distribua as obrigações conforme a qualificação profissional. Registre a execução efetiva: data, unidade, profissional, quantidade, horas quando aplicáveis, custo e evidência. Elabore PGR, PCMSO, laudos e demais documentos com dados conferidos, versão identificada e revisão técnica competente. IA não substitui avaliação profissional, assinatura ou confirmação de execução.",
        },
        {
          kind: "heading",
          text: "Custos e mudança de escopo",
        },
        {
          kind: "paragraph",
          text: "Confirme os custos antes de contratar ou acionar o prestador. Diferencie serviços incluídos na mensalidade de serviços cobrados à parte. Se surgir serviço extra, obtenha aprovação do preço e formalização aplicável antes da execução. Registre aditivo como nova versão na Central, com vigência; não sobrescreva ciclos já medidos. O contrato financeiro integrado possui limites para alteração de preço e requer tratamento específico pelo Financeiro.",
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  Dados suficientes, prestadores confirmados, custos aprovados, agenda definida e tarefas atribuídas. Implantação concluída exige evidência, não apenas marcação de checklist.",
        },
      ],
    },
    {
      id: "asos-avp",
      title: "4 Operar os periódicos do Grupo AVP",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsável: equipe interna AVP. Local: Grupo AVP, aba “Esteira de ASOs”. Este controle acompanha os periódicos; admissionais seguem a fila própria.",
        },
        {
          kind: "steps",
          items: [
            "Clique em “Carregar campanha e acompanhamento”. Busque o colaborador e use “Abrir caso”. Confira nome, CPF na fonte autorizada, CNPJ ou vínculo, unidade, admissão, tipo de exame e vencimento.",
            "Consulte o histórico de pedidos no SOC antes de gerar outro. Registre o resultado e a evidência da consulta, com data, responsável e referência. Ausência no relatório 270 não prova ausência de pedido.",
            "Reutilize o pedido legítimo existente. Quando a criação for necessária e autorizada, faça-a pelo fluxo habilitado e registre o número confirmado. O mesmo pedido não pode ficar vinculado a dois casos.",
            "Confirme clínica, cidade, exames, contato e valor aprovado. Gere e confira o kit no fluxo habilitado do NAI ou SOC; a aba da esteira não cria pedidos SOC nem envia kits automaticamente.",
            "Marque “Kit pronto” somente após conferir o kit. Marque “Agendado” após confirmação da clínica e do colaborador; registre a data. Registre comparecimento apenas com evidência do atendimento e defina prazo de devolução.",
            "Use “Aguardando ASO” durante a devolução. Revise diariamente os atrasos. “Preparar cobrança à clínica” gera rascunho: confira o destinatário, obtenha autorização, envie pelo canal aprovado e registre a ocorrência.",
            "Receba o ASO, importe o índice e anexe o PDF na aba de documentos. Separe ASO, ficha clínica e pedido de exames. A vinculação exige ASO anexado, sem pendência de vínculo ou retificação.",
            "Em “Em conferência”, compare o PDF com colaborador, empresa ou vínculo, tipo e data do exame, assinatura, legibilidade e versão. A conferência automática do nome não substitui CPF e vínculo. Encaminhe divergências ao responsável ou prestador.",
            "Confirme o coordenador e seu e-mail. Registre a conferência humana e salve antes de avançar para “Pronto para envio”.",
          ],
        },
        {
          kind: "heading",
          text: "Correção de pedido ou substituição do documento",
        },
        {
          kind: "paragraph",
          text: "Ao corrigir ou excluir o pedido SOC, salve e confira o resultado; o sistema libera a reserva anterior somente se ela pertencer ao caso. Em erro 409, atualize a tela e investigue a duplicidade ou edição concorrente. Ao trocar o PDF, a tela limpa revisão e referência de entrega e retorna à conferência. Salve a troca, revise novamente e registre uma nova entrega. O histórico anterior permanece.",
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  ASO correto e revisado, coordenador confirmado e registro salvo. Não use a geração do kit ou a emissão do ASO como prova isolada de atendimento realizado.",
        },
      ],
    },
    {
      id: "entrega",
      title: "5 Entregar e obter aceite do serviço",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsáveis: coordenador operacional e revisor técnico. Etapa principal: “Entregar e obter aceite”.",
        },
        {
          kind: "steps",
          items: [
            "Confira se todas as obrigações exigidas para a entrega foram executadas, com autoria, versão, revisão e assinatura competente quando aplicável. Verifique os cards individuais, não apenas o resumo do contrato.",
            "Prepare a lista do que será enviado: contrato ou ciclo, unidade, documento, versão, destinatário e canal. Confirme o endereço com a fonte autorizada e evite compartilhar dados além do necessário.",
            "Para ASOs AVP, use “Preparar entrega ao coordenador” somente após salvar a revisão. O botão prepara rascunho; a equipe precisa revisar destinatário e anexos e obter autorização expressa para enviar.",
            "Envie pelo canal autorizado. Ao coordenador, encaminhe somente o ASO conferido; mantenha a ficha clínica no acesso profissional restrito. Nos demais serviços, envie apenas o pacote liberado.",
            "Registre a entrega real: data, destinatário, canal, documentos e versões, protocolo ou referência do envio e responsável. Só então marque o ASO como “Entregue”.",
            "Acompanhe a confirmação do destinatário. Registre o aceite exigido no contrato ou a cláusula documentada que libera a medição. Envio, recebimento da mensagem e aceite técnico são fatos diferentes.",
            "Se houver correção, mantenha a ocorrência aberta, registre o motivo, providencie a nova versão e repita revisão e entrega. Não reutilize a aprovação do documento substituído.",
            "Conclua o card de entrega da Central somente quando as evidências e pendências correspondentes estiverem resolvidas. Confira manualmente a correspondência entre os ASOs da operação AVP e o ciclo do contrato.",
          ],
        },
        {
          kind: "heading",
          text: "Pacote mínimo para o Faturamento",
        },
        {
          kind: "paragraph",
          text: "Entregue ao Faturamento o contrato e a versão aplicável, competência, unidade, relação dos serviços, quantidades, preço aplicável, evidências de execução e entrega, aceite quando exigido, despesas autorizadas e pendências remanescentes. Inclua o identificador do ciclo para impedir cobranças duplicadas.",
        },
        {
          kind: "heading",
          text: "Quando bloquear",
        },
        {
          kind: "paragraph",
          text: "Bloqueie a liberação por documento errado, revisão ausente, divergência de vínculo, destinatário não confirmado, entrega sem protocolo ou aceite contratualmente exigido ainda pendente. Informe motivo, responsável e prazo de solução. Antecipações só podem seguir a cláusula e a autorização registradas.",
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  Entrega comprovada e aceite ou condição contratual de faturamento identificada. O contrato deve continuar aberto se houver obrigação pendente.",
        },
      ],
    },
    {
      id: "faturamento",
      title: "6 Medir faturar e emitir a nota fiscal",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsáveis: Faturamento, aprovador financeiro e responsável fiscal. Etapas: “Medir serviço e valor” e “Registrar NF e cobrança”.",
        },
        {
          kind: "steps",
          items: [
            "Selecione cliente, CNPJ, contrato, ciclo e competência corretos. Confira no NAI, Omie e demais controles se já existe cobrança dessa competência ou serviço. Não gere título apenas porque ele não aparece em uma das telas.",
            "Apure a medição: quantidade comprovada vezes preço contratado, acrescida das despesas autorizadas e descontados os ajustes aprovados. Separe mensalidade fixa, serviços incluídos e avulsos; não cobre novamente os incluídos.",
            "Anexe a memória de cálculo e a aprovação exigida. Na Central, abra “Registrar medição, NF, recebimento e conciliação”, informe “Valor medido” e a evidência. Salve e conclua o card de medição após a conferência.",
            "Quando usar o ERP integrado, gere a mensalidade ou o avulso em rascunho e faça a aprovação financeira. A revisão de serviço avulso exige outro administrador, diferente de quem registrou. Confira contrato e competência antes de aprovar.",
            "Antes da emissão, confirme tomador e CNPJ, endereço e inscrição quando exigida, descrição e competência do serviço, município, valor, retenções, código de serviço e configuração fiscal com o responsável habilitado. Não copie tributos de outro cliente sem revisão.",
            "Emita a NFS-e no emissor habilitado, como Omie ou portal municipal. A Central NAI registra a emissão e suas evidências; salvar os dados no NAI não emite NF. Verifique autorização, número e situação no próprio emissor. Rejeição, cancelamento ou ambiente de homologação não comprovam NF válida de produção.",
            "Gere a cobrança pelo canal financeiro habilitado, conforme contrato. Confira vencimento, beneficiário, valor e ausência de duplicidade. Boleto gerado não comprova pagamento.",
            "Volte à Central e registre valor faturado, identificador único da NF com emissor, série e número, evidência da NF e da cobrança. Vincule o título aprovado do contrato quando disponível. Salve os registros financeiros.",
            "Confira que a NF válida corresponde à medição. Prepare o envio ao contato financeiro confirmado, obtenha autorização, envie NF e cobrança e registre o protocolo. Conclua o card fiscal somente com essas evidências.",
          ],
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  Medição aprovada, NF autorizada, cobrança correta e registros vinculados. Divergência bloqueia a etapa; corrija no emissor e preserve a referência anterior.",
        },
      ],
    },
    {
      id: "recebimento",
      title: "7 Confirmar recebimento e encerrar o ciclo",
      blocks: [
        {
          kind: "paragraph",
          text: "Responsável: Financeiro. Etapa principal: “Conciliar recebimento e encerrar ciclo”.",
        },
        {
          kind: "steps",
          items: [
            "Acompanhe os vencimentos em “Pagar e receber”. Antes de cobrar um título vencido, confira se houve pagamento, retenção, baixa ou renegociação em outro controle. Toda mensagem exige revisão e autorização.",
            "Localize o crédito no extrato da conta da empresa. Confira pagador, data, valor e identificação do título. Comprovante enviado pelo cliente deve ser verificado contra o crédito ou a conciliação; promessa de pagamento não autoriza baixa.",
            "No ERP, registre a baixa no título correto, com conta, data, principal e ajustes aplicáveis. Respeite o fluxo de aprovação e mantenha a evidência. Não trate um pagamento parcial como quitação integral.",
            "Na aba bancária, concilie a baixa com o movimento do extrato. A consulta ao Omie e o controle local não garantem sincronização automática; confirme e registre as referências nos dois sistemas quando necessário.",
            "Atualize a Central: valor recebido principal, extrato ou evidência de conciliação e ajustes aprovados, com documentação. Consulte novamente os títulos do ERP e vincule o título aprovado do mesmo contrato quando disponível. O servidor confere os valores ao salvar.",
            "Confira o saldo: valor da NF menos principal recebido menos retenções ou descontos aprovados. Registre os ajustes nas rubricas apropriadas, sem usar desconto fictício para zerar uma diferença. Juros, multas e demais movimentos devem seguir o registro financeiro correto.",
            "Confirme que as entregas foram resolvidas, as tarefas concluídas, a NF está válida e o saldo está justificado e zerado. Com título ERP vinculado, a conciliação e as baixas não estornadas precisam corresponder ao ciclo.",
            "Conclua o card de recebimento e encerre o ciclo com data, responsável e evidências. Para contrato recorrente, mantenha o contrato ativo e abra o próximo ciclo na competência devida.",
            "Encerre o contrato somente ao término de sua vigência ou rescisão formalizada, depois de verificar todos os ciclos, entregas, saldos e obrigações. Encerrar um mês pago não encerra o contrato.",
          ],
        },
        {
          kind: "heading",
          text: "Exemplo de conferência financeira",
        },
        {
          kind: "paragraph",
          text: "Exemplo operacional: NF de R$ 1.000,00; principal recebido de R$ 900,00; retenção ou desconto aprovado e documentado de R$ 100,00; saldo de R$ 0,00. O extrato mostra o dinheiro recebido e a documentação sustenta o ajuste. Sem comprovação dos R$ 100,00, o saldo continua pendente. O exemplo não define tratamento tributário.",
        },
        {
          kind: "paragraph",
          text: "Critério para avançar  Recebimento comprovado, conciliação concluída, ajustes documentados e entregas resolvidas. Baixa isolada não substitui conciliação.",
        },
      ],
    },
    {
      id: "pendencias",
      title: "8 Controlar pendências e manter a rastreabilidade",
      blocks: [
        {
          kind: "heading",
          text: "Rotina diária da equipe",
        },
        {
          kind: "paragraph",
          text: "Comercial revisa contratos sem formalização e pendências de dados. Operações revisa implantação, tarefas vencidas, agendas e ASOs atrasados. Faturamento revisa serviços liberados ainda não medidos, medições sem NF e cobranças sem envio. Financeiro revisa vencimentos, créditos sem identificação e saldos sem conciliação. Cada pendência deve ter responsável, prazo e próxima ação.",
        },
        {
          kind: "heading",
          text: "Tratamento de exceções",
        },
        {
          kind: "table",
          headers: ["Ocorrência", "Como agir"],
          rows: [
            [
              "Erro 409 ao salvar",
              "Atualizar o caso, comparar a versão e conferir pedido ou vínculo. Não criar outro atendimento para contornar o erro.",
            ],
            [
              "PDF incorreto ou substituído",
              "Preservar o histórico, salvar a substituição e repetir revisão e entrega do documento correto.",
            ],
            [
              "NF rejeitada ou cancelada",
              "Corrigir no emissor; registrar situação e substituição. Não manter o ciclo como faturado com nota inválida.",
            ],
            [
              "Pagamento parcial ou divergente",
              "Registrar apenas o valor comprovado, manter saldo aberto e atribuir responsável pela diferença.",
            ],
            [
              "Mudança de escopo ou preço",
              "Formalizar a alteração, registrar versão e vigência e obter aprovação. Preservar medições anteriores.",
            ],
            [
              "Etapa concluída com erro",
              "Reabrir primeiro as etapas dependentes, registrar justificativa e corrigir com evidência; não apagar o histórico.",
            ],
            [
              "Contrato antigo em migração",
              "Conferir cobranças existentes e escolher a primeira competência livre. Não cancelar título válido para permitir a inclusão.",
            ],
          ],
        },
        {
          kind: "heading",
          text: "Registro mínimo em cada passagem",
        },
        {
          kind: "paragraph",
          text: "Cliente e CNPJ; contrato e versão; ciclo ou competência; unidade ou colaborador quando aplicável; serviço ou documento; responsável; data; valor quando aplicável; evidência; pendência e próximo responsável. Referências devem apontar para evidências acessíveis ao perfil autorizado, sem credenciais ou dados clínicos em observações gerais.",
        },
        {
          kind: "heading",
          text: "Checklist de encerramento do ciclo",
        },
        {
          kind: "paragraph",
          text: "Contrato formalizado. Implantação conferida. Serviços executados. Documentos revisados. Entrega comprovada. Aceite ou condição de cobrança registrado. Medição aprovada. NF válida. Cobrança registrada. Recebimento conciliado. Saldo e ajustes resolvidos. Histórico preservado. Próximo ciclo planejado, se recorrente.",
        },
        {
          kind: "paragraph",
          text: "Revisão do POP: gestor do contrato, quando o fluxo mudar. Referência: NAI 93ef247, docs/contract-to-cash.md e docs/avp-workflow.md.",
        },
      ],
    },
  ],
};
