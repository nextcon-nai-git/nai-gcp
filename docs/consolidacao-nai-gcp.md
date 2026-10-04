# Consolidação do NAI GCP

A versão consolida o mapa e a fila Grupo AVP, importação CSV/XLSX e sincronização periódica por link Google Planilhas, além da navegação completa por módulos. Preserva autenticação Firebase, controle de perfis, tratamento de erros e configuração de App Hosting/Node 24 do GCP.

## Uso do Grupo AVP

Após entrar, abra **Grupo AVP · Mapa e fila**. No sincronizador, informe o link da planilha e habilite a sincronização automática. O link deve permitir leitura CSV pelo servidor com as permissões existentes; planilhas que exigem login podem ser importadas por arquivo XLSX/CSV. O sistema não altera compartilhamento da planilha. Configuração e fila local são isoladas pelo usuário.

Dados pessoais, históricos clínicos, processos judiciais, salários, extratos e documentos financeiros da base legada não acompanham o código público. Cadastros devem vir dos dados autorizados no Firebase ou de importação autenticada. Solicitações do agendador persistem no Firestore por usuário; sugestões de IA aguardam validação e confirmação com a clínica.

## Integrações

TOTVS, Senior, gravação do classificador documental e sincronização offline retornam explicitamente configuração pendente, sem afirmar que dados foram enviados. WhatsApp exige WHATSAPP_WEBHOOK_SECRET e WHATSAPP_VERIFY_TOKEN configurados no servidor. Essas integrações devem ser habilitadas com seus serviços reais antes do uso operacional.

## Publicação

Destino: repositório nextcon-nai-git/nai-gcp, branch main; Firebase App Hosting backend nai no projeto studio-8439299034-125c7. O domínio configurado no backend é www.nai.nextconsaude.com.br. Não altera nai-azure.
