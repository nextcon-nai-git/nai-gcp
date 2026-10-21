# Modelo de credenciamento de clínicas

Em Grupo AVP → Periódicos e rede AVP, **Modelo de contrato** permite cadastrar e baixar o Word fornecido pelo proprietário. Em **Clínicas e valores**, **Preparar contrato** abre o preenchimento e a prévia por clínica.

O original NEXTCON v2 é identificado por SHA-256 e armazenado em objeto privado, sem inclusão dos dados pessoais do documento no repositório ou em arquivos públicos. Somente administradores internos cadastram esse arquivo; a equipe operacional interna vinculada ao AVP pode preparar minutas. Uma nova versão contratual requer nova revisão e atualização do identificador.

A minuta preenche campos conhecidos, preserva cláusulas e anexos e mantém os campos desconhecidos entre colchetes. Razões sociais divergentes e contatos múltiplos não são escolhidos automaticamente. O preço de R$30 é a proposta do modelo, não confirmação de tarifa da clínica. Preços históricos nunca sobrescrevem o contrato.

O usuário confere a prévia antes de baixar o DOCX ou o rascunho EML com o DOCX anexado. EML é um arquivo para abrir no aplicativo de e-mail; não é envio nem rascunho gravado no Gmail. Não há chamada de envio, aprovação contratual, assinatura, atualização de credenciamento, convocação ou alteração da fila. Os campos digitados e as minutas não são persistidos nesta etapa; o original fica disponível para as próximas sessões.

As ressalvas de revisão ficam na tela: pagamento por canal alternativo ao SOCNET; guarda, sigilo e papéis de dados; multas e não captação; contagem dos prazos e campos pendentes. São orientações de revisão, não alteração automática do documento nem parecer jurídico conclusivo.

Validação: regras de acesso antes da leitura; upload imutável e idempotente; recusa de arquivo divergente; preenchimento de placeholders fragmentados pelo Word; preservação de condições; prevenção de cabeçalhos injetados no EML; remoção dos dados na troca ou revogação da sessão; verificação visual da minuta gerada a partir do original com dados fictícios.
