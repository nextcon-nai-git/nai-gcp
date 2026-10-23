# Esteira operacional AVP

A aba **Esteira de ASOs** em `/clients/grupo-avp` consulta os participantes da campanha e as evidências existentes. O acompanhamento é salvo no servidor em `webhook_deliveries/grupo-avp-workflow`, com acesso somente à operação interna autorizada, versão otimista e histórico por alteração. Não usa armazenamento local.

## Uso

1. Carregar campanha e acompanhamento. Buscar participante por nome, unidade ou cidade.
2. Conferir CPF, vínculo, admissão, vencimento e histórico de pedidos no SOC. Registrar a referência da consulta e reutilizar pedidos existentes. Ausência de resultados no relatório 270 não significa ausência de pedido.
3. Informar o pedido e clínica confirmados, responsável e etapa. O mesmo número de pedido não pode ser associado a dois casos. Datas de agenda, comparecimento e prazo são confirmações da equipe, não conclusões inferidas do status da planilha.
4. A fila destaca cobranças quando o prazo de devolução informado está vencido. Preparar e copiar o rascunho para revisão; não há envio automático.
5. Importar o índice e anexar o PDF na aba de documentos. Vincular somente evidência `aso`, anexada e sem pendência de vínculo/retificação. A API confere o nome; o operador deve conferir também CPF, empresa/vínculo, data, tipo, assinatura, legibilidade e versão no PDF.
6. Confirmar o coordenador da unidade e seu e-mail. A etapa Pronto para envio libera um rascunho. Anexar somente o ASO conferido; nunca ficha clínica. Após envio autorizado em canal existente, registrar a referência e marcar Entregue.

## Limites desta entrega

- Consulta SOC e geração de kits continuam no fluxo existente; esta entrega não faz consultas SOC de fundo nem cria pedidos SOC.
- Não considera ASO emitido como exame realizado. Não preenche resultado, parecer ou assinatura.
- Não faz OCR novo nem atesta validade de assinatura digital; registra a conferência humana.
- Não envia e-mails ou WhatsApp, nem agenda cobranças em segundo plano. As ações e atrasos são calculados ao carregar a tela; as mensagens são rascunhos.
- A entrega não cadastra contatos de coordenadores por inferência. Eles precisam ser confirmados pela equipe.
- Esta esteira cobre a campanha de periódicos. A fila de admissionais permanece na aba existente e não é unificada silenciosamente por nome.
- Nenhum caso real foi marcado como concluído por esta alteração de código.
