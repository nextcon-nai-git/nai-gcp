# Centralização da operação e assinatura eletrônica

## Objetivo

Usar o NAI como interface principal do fluxo comercial → implantação → execução → medição → faturamento → recebimento. Reduzir cadastros e controles paralelos por etapas, com evidências, reconciliação e autorização humana para ações externas.

## Primeiro incremento

O portal clínico calcula SHA-256 no recebimento de PDFs. Agora, a entrega autenticada compara o conteúdo armazenado com esse hash antes de disponibilizar o arquivo e registrar uma leitura bem-sucedida. Divergências ou ausência de hash bloqueiam a entrega com HTTP 409 e evento de auditoria. Falha de armazenamento não registra sucesso. A conferência não valida certificado, identidade ou assinatura e não altera o documento.

Registros antigos sem hash exigem conferência da origem e recuperação do hash original. Não calcular e aceitar automaticamente um novo hash do objeto atual como se fosse evidência histórica.

## Sequência de revisão do código

| Frente                | Resultado esperado                                                       | Critério para substituir controle externo                                                        |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Comercial e contratos | Cadastro único por CNPJ, oportunidades, propostas, versões e renovações  | Histórico migrado e ausência de duplicidades confirmados                                         |
| Operação              | Cards, obrigações, responsáveis, prazos, evidências e portal de clínicas | Fluxo completo testado com contratos reais e acessos de cada perfil                              |
| Campo                 | Checklists, fotos, revisão técnica e plano de ação                       | Uso móvel e recuperação após falha de conexão validados                                          |
| Financeiro            | Títulos, medições, documentos fiscais, conciliação e custos por contrato | Fechamento comparado com banco e contabilidade; transferências e aplicações separadas de receita |
| Integrações           | Adaptadores, segredos no servidor, idempotência, tentativas e auditoria  | Repetição de eventos não duplica registros; falha permanece visível                              |
| Assinaturas           | Solicitação vinculada à versão exata do PDF e signatários autorizados    | Testes em sandbox e documento final com evidências conferidas                                    |

Essa sequência é um plano de evolução, não uma declaração de funcionalidades concluídas ou de substituição integral do SOC/ERP.

## Provedor recomendado para avaliação: Clicksign

A documentação oficial da API 3.0 oferece envelopes, signatários, requisitos de autenticação, sandbox e webhooks. Comparar proposta comercial com a D4Sign, que também documenta API, webhooks e certificado ICP-Brasil. Confirmar custo por documento, volume de assinaturas, métodos disponíveis no plano, retenção e exportação das evidências antes da contratação.

Referências:

- https://developers.clicksign.com/
- https://developers.clicksign.com/v3.0/docs/faq-duvidas-e-problemas-comuns
- https://docapi.d4sign.com.br/docs/introdu%C3%A7%C3%A3o-a-api
- https://docapi.d4sign.com.br/docs/endpoints-4

## Contrato técnico para a próxima implementação

1. Solicitar assinatura somente de uma versão aprovada, com referência do registro, hash do PDF, responsável e signatários. Reenvio deve usar a mesma identidade da solicitação ou declarar uma nova versão.
2. Manter credenciais no servidor e separar sandbox de produção. Nenhuma chave real deve ser incluída no repositório ou navegador.
3. Verificar autenticação do webhook conforme documentação atual do provedor, deduplicar eventos e vincular envelope, documento e organização. Um evento isolado não autoriza acesso a outro cliente.
4. Distinguir rascunho, aprovado para envio, enviado, parcialmente assinado, concluído no provedor, cancelado, expirado e falha. Eventos atrasados não devem reabrir documento cancelado nem substituir uma versão aprovada.
5. Recuperar PDF final e evidências pelo servidor, conferir referência e persistir hash. O hash do PDF assinado difere normalmente do PDF original; conservar ambos com suas versões.
6. Separar conclusão informada pelo provedor de validação do certificado e da conferência profissional. Um upload manual não equivale a uma assinatura digital validada.
7. Habilitar envios reais apenas após revisão e autorização. Não transformar callback em emissão fiscal, pagamento, envio de e-mail ou encerramento automático de contrato.

O adaptador e a integração externa ainda não estão implementados neste incremento. O diálogo clínico permanece explicitamente indisponível até configuração e validação do provedor.

## Base de estados implementada

`src/lib/signatures/lifecycle.ts` prepara o domínio interno para solicitações de assinatura. Vincula organização, registro, versão e SHA-256; exige aprovação registrada antes de associar uma resposta de envio; separa sandbox e produção; deduplica eventos pelo identificador e conteúdo e impede reabertura de estados encerrados. Conserva o hash original separado do hash final.

Essa base ainda não é chamada por rotas ou telas e não grava dados nem envia documentos. O servidor deve autenticar e autorizar o responsável, conferir a resposta real do provedor e persistir as alterações atomicamente. O adaptador de webhook deve verificar autenticidade e resolver referências pela base confiável; nunca considerar o JSON recebido como autorização. A conclusão requer referência das evidências, mas não equivale à validação criptográfica do certificado.

O histórico é limitado a 500 eventos por solicitação. Atingido esse limite, exige revisão; não descarta eventos antigos silenciosamente. Um reenvio após cancelamento, expiração ou troca da versão exige nova solicitação e aprovação.
