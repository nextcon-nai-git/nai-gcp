# Fonte AVP e atualização de 10 minutos

O backend lê exclusivamente a aba **Fila de Agendamentos**, gid `1413127031`, da planilha privada [Planilha de pendencias Grupo AVP](https://docs.google.com/spreadsheets/d/15it07WoyDRsGs2GdhWgi3zgT8yO2pYYUquPZtzFEa6Q/edit?usp=drivesdk). A direção é Google Sheets → fila compartilhada do NAI. O importador exige os 22 cabeçalhos únicos e preserva status originais, observações, contatos, valores e solicitações repetidas. Não escreve na planilha Google.

As versões completas são gravadas no Firestore antes de trocar a versão publicada. Erros preservam a última fila válida. Edições no NAI exigem revisão atual e vínculo com AVP; mudanças concorrentes na fonte ficam sinalizadas. O navegador consulta a fila a cada **600 segundos**, e o Cloud Scheduler mantém a leitura mesmo com a tela fechada. A ação manual “Atualizar agora” é limitada a uma execução a cada 30 segundos por integração.

## Ativação no projeto existente

1. Confirme a identidade de execução do backend `nai` no Cloud Run. O valor esperado em `apphosting.yaml` é `firebase-app-hosting-compute@studio-8439299034-125c7.iam.gserviceaccount.com`.
2. Publique as regras Firestore/Storage e os índices testados antes da primeira cópia da fonte. A publicação do site segue o autorelease do App Hosting conectado à branch `main`.
3. Conceda **somente leitura** da planilha original à identidade conferida. Não torne a planilha pública e não crie chaves JSON.
4. No Cloud Shell autenticado, na revisão publicada, execute:

```bash
export AVP_RUNTIME_SERVICE_ACCOUNT='firebase-app-hosting-compute@studio-8439299034-125c7.iam.gserviceaccount.com'
bash scripts/configure-avp-sync.sh
```

O script usa o projeto existente, publica regras/índices, ativa Sheets/Places/Scheduler e cria ou ajusta `nai-avp-sheet-sync` com cron `*/10 * * * *`, fuso São Paulo e token OIDC. Não concede papéis IAM. Uma falta de permissão interrompe o script para correção específica.

## Verificação após publicação

- `/api/clients/grupo-avp/queue` sem sessão deve responder 401.
- Conta sem vínculo AVP deve receber 403 antes de qualquer leitura de dados.
- A fila autorizada deve indicar fonte conectada e a última leitura bem-sucedida.
- O agendador deve registrar HTTP 200 para a audiência e identidade configuradas. Resposta 503 conserva a fila e indica falha recuperável de fonte/configuração.
- Verifique duas leituras do agendador, separadas por 10 minutos. Não considere a ativação concluída apenas porque o job foi criado.

## Custos, clínicas e mapa

O filtro e os pins separam preço único acima de R$40, até R$40 e preço ausente/ambíguo. A margem é uma simulação bruta usando receita de R$40; não inclui tributos, custos extras ou confirmação do tipo de faturamento.

O losango azul busca até três clínicas de SST na cidade do pedido com custo acima de R$40. Contatos iniciais foram conferidos em sites oficiais; buscas adicionais usam Places com OAuth da identidade do projeto e limite global de 100 consultas por dia. Resultados Places são exibidos com atribuição e não são armazenados nem exportados. Um telefone publicado não é automaticamente tratado como WhatsApp. Os links confirmados abrem a mensagem institucional para revisão e envio pelo operador.

As posições indicam referências municipais aproximadas, usando a base pública MIT `kelvins/municipios-brasileiros`, revisão `503e2f70bbf1b4b7ec0b1f68b09086ccc38fe861`, com licença no código. Não indicam o endereço físico das clínicas. Cidades ausentes ou ambíguas ficam sinalizadas.

O KML exporta uma fotografia dos custos por município, contatos da fonte, opções verificadas e links de WhatsApp e NAI. Não inclui nomes de colaboradores ou tokens. A atualização autenticada continua no NAI; o KML não é um feed público de dados privados nem se atualiza sozinho no Earth.
