# Teste de autenticação Gmail

Este diagnóstico manual lista os assuntos de até cinco mensagens da caixa de entrada. Não envia mensagens, não baixa anexos e não integra automaticamente o Gmail ao aplicativo.

## Pré-requisitos

1. Habilitar a API Gmail no projeto Google Cloud.
2. Usar uma Service Account com delegação de domínio habilitada.
3. Um administrador do Google Workspace deve autorizar o **ID de cliente OAuth** dessa Service Account e o escopo `https://www.googleapis.com/auth/gmail.readonly` nos controles de API/delegação de domínio. Permissões IAM do projeto, sozinhas, não dão acesso à caixa de e-mail.
4. O usuário delegado deve possuir uma caixa Gmail ativa no domínio. O padrão deste teste é `atendimento.grupoavp@nextconsaude.com.br`; confirme se esse é o usuário principal, e não apenas um grupo ou alias.

Referências: [delegação de domínio](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority), [listar mensagens](https://developers.google.com/workspace/gmail/api/guides/list-messages), [consultar metadados](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get).

## Executar localmente

Mantenha a chave JSON fora do checkout. Não cole a chave em código, chat, logs ou documentação.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-gmail.txt
export GMAIL_SERVICE_ACCOUNT_FILE=/caminho/fora/do/repositorio/service-account.json
export GMAIL_DELEGATED_USER=atendimento.grupoavp@nextconsaude.com.br
.venv/bin/python test_gmail_api.py
```

Também aceita `GOOGLE_APPLICATION_CREDENTIALS` como caminho, ou os argumentos `--credentials` e `--subject`. A execução retorna 0 para sucesso, 1 para falha no serviço/autenticação e 2 para configuração/dependências ausentes. Os assuntos são buscados com `format=metadata`, sem carregar o corpo. Não execute em CI público, pois os assuntos aparecem na saída.

## Proteção das credenciais

O `.gitignore` protege diretórios de segredos e nomes comuns de chaves; ele não consegue identificar toda chave com nome arbitrário. Nunca use `*.json` como regra geral: o projeto precisa versionar `package.json`, lockfile, configurações e outros JSON legítimos. Arquivos já rastreados não passam a ser protegidos pelo `.gitignore`.

Em produção, prefira identidade de workload/credenciais gerenciadas e Secret Manager quando necessário. Se um processo exigir uma chave, entregue-a em tempo de execução pelo mecanismo de segredos, em arquivo temporário fora do código, com acesso restrito. Uma variável contendo o JSON inteiro não elimina a necessidade de protegê-lo. Não adicione este teste ao deploy automático.

Este teste depende de credenciais reais e da autorização do administrador; verificações locais sem essas credenciais não comprovam acesso ao Gmail. A extração de anexos ASO exige uma implementação própria e não está incluída aqui.
