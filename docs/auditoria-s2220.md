# Auditoria documental do S-2220

Em **Operacional → eSocial e governança → Mensageria eSocial**, abra um evento S-2220, escolha o provedor e clique em **Auditar evento**. O perfil precisa ser interno, ter acesso clínico e estar autorizado para a empresa. O resultado informa quais verificações locais falharam, recomendações e o modelo que respondeu. Uma nova edição invalida o resultado mostrado.

O NAI confere os procedimentos e a vigência nas tabelas oficiais incluídas no repositório. A adequação dos exames ao PCMSO é revisada pela equipe clínica. O índice soma 25 pontos por pendência documental até 100. Um resultado inapto sinaliza revisão médica prioritária. O evento só segue para transmissão pelo fluxo existente da mensageria.

## Configuração

O Vertex usa as credenciais de aplicação da identidade de execução e o projeto do ambiente. O modelo Argon usa o endpoint multirregional `us`. O App Hosting precisa disponibilizar `OPENAI_API_KEY` e `ANTHROPIC_API_KEY` no ambiente de execução para habilitar os provedores correspondentes. Use referências aos segredos no ambiente publicado. A callable usa os segredos Firebase com esses mesmos nomes. A equipe de implantação deve conceder à identidade do serviço acesso aos segredos utilizados e ao Vertex AI.

A função `auditS2220` aceita `{companyId, evento}` em uma chamada Firebase autenticada. O código de validação e o controle de acesso são compartilhados com a server action do Next.js. Para preparar e verificar a função isolada, execute na raiz:

```sh
npm ci
npm run build:s2220-function
npm ci --prefix functions/audit-s2220
```

O predeploy prepara o pacote para `firebase deploy --only functions:s2220-audit`. O ambiente usa o projeto configurado em `.firebaserc`. Um teste automatizado utiliza dados sintéticos e modelos simulados.

## Cloud Logging

Execute `npm run infra:ai-metrics -- --dry-run` para inspecionar os filtros. Execute `npm run infra:ai-metrics` com credenciais Google autorizadas para criar ou atualizar e reler as três métricas. Em Logs Explorer, filtre por `jsonPayload.serviceContext.service="nai-gcp-ai-engine"`.

| Métrica                          | Unidade e interpretação                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `nai_ai_fallback_count`          | Uma conclusão bem-sucedida por um provedor alternativo                                  |
| `nai_ai_critical_failures_count` | Uma geração que esgotou a cadeia                                                        |
| `nai_ai_execution_latency`       | Distribuição em milissegundos do início até o sucesso, incluindo esperas e retentativas |

Os logs registram tentativas do executor, motivos padronizados, modelo e contagens de tokens quando informadas pelo provedor que concluiu a geração. Uma rejeição de conteúdo ou de solicitação encerra a cadeia e produz um evento próprio. Toda a análise documental permanece disponível quando a IA fica indisponível.
