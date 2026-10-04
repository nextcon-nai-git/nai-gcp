# Consolidação do NAI GCP

A versão consolida o mapa e a fila Grupo AVP, importação CSV/XLSX e sincronização periódica por link Google Planilhas, além da navegação completa por módulos. Preserva autenticação Firebase, controle de perfis, tratamento de erros e configuração de App Hosting/Node 24 do GCP.

## Uso do Grupo AVP

Após entrar, abra **Grupo AVP · Mapa e fila**. No sincronizador, informe o link da planilha e habilite a sincronização automática. O link deve permitir leitura CSV pelo servidor com as permissões existentes; planilhas que exigem login podem ser importadas por arquivo XLSX/CSV. O sistema não altera compartilhamento da planilha. Configuração e fila local são isoladas pelo usuário.

A atualização automática usa cinco minutos por padrão e depende da página aberta. A consulta pausa com a aba oculta e retoma ao voltar. Trocas de conta ou de link cancelam consultas anteriores; uma resposta que chegou após edição da fila não substitui essa edição. O cache fica neste navegador e não equivale a uma gravação no Firestore.

Os totais e o mapa refletem a fila importada. Importações parciais preservam campos que não vieram na planilha, reconhecem UF separada e informam linhas inválidas ou com número associado a outro colaborador. A exportação CSV inclui contatos e protege células que possam ser interpretadas como fórmulas ao abrir no Excel.

O formulário de nova solicitação prepara uma mensagem com os dez dados do colaborador, permite revisão e oferece um link para o WhatsApp da central Nextcon. O usuário precisa enviar a mensagem na conversa; preparar ou copiar o texto não confirma envio nem agendamento. O formulário não substitui o agendador que grava solicitações no Firestore.

Dados pessoais, históricos clínicos, processos judiciais, salários, extratos e documentos financeiros da base legada não acompanham o código público. Cadastros devem vir dos dados autorizados no Firebase ou de importação autenticada. Solicitações do agendador persistem no Firestore por usuário; sugestões de IA aguardam validação e confirmação com a clínica.

## Integrações

TOTVS, Senior, gravação do classificador documental e sincronização offline retornam explicitamente configuração pendente, sem afirmar que dados foram enviados. WhatsApp exige WHATSAPP_WEBHOOK_SECRET e WHATSAPP_VERIFY_TOKEN configurados no servidor. Essas integrações devem ser habilitadas com seus serviços reais antes do uso operacional.

## Publicação

O App Hosting conectado ao GitHub publica a branch main. O workflow Firebase valida a aplicação e as regras; a publicação de regras/índices é separada, acionada manualmente com `deploy_firestore` e credenciais configuradas. Não executa a antiga publicação paralela de Hosting ou funções a cada alteração do site.

Destino: repositório nextcon-nai-git/nai-gcp, branch main; Firebase App Hosting backend nai no projeto studio-8439299034-125c7. O domínio configurado no backend é www.nai.nextconsaude.com.br. Não altera nai-azure.

O workflow de qualidade deve falhar quando formatação, lint, tipos, testes ou build falharem. A revisão funcional de outubro de 2026 não atualiza dependências: o relatório do npm ainda registra vulnerabilidades transitivas, incluindo alertas altos no conjunto Genkit e nas ferramentas de desenvolvimento. Resolver esse passivo exige atualização compatível e nova validação, sem aplicar automaticamente os downgrades ou mudanças de versão principal sugeridos pelo audit.
