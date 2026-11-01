# Backup nativo do Firestore: configuração proposta

## Estado observado em 01/11/2026

Na inspeção do console Firebase, o banco `(default)` estava ativo, edição Standard, em
`us-central1`. Backups diários e semanais estavam desmarcados, e a recuperação pontual (PITR)
estava desligada. Nenhuma programação foi salva nesta inspeção.

A tela de utilização consultada não informou o tamanho completo do banco. Contagem de leituras,
quantidade de documentos e tamanho de arquivos no Hosting não substituem esse valor.

## Proposta para revisão

| Item                     | Configuração                         |
| ------------------------ | ------------------------------------ |
| Projeto                  | `studio-8439299034-125c7`            |
| Banco                    | `(default)`                          |
| Recorrência              | Diária                               |
| Retenção                 | 7 dias (`604800s`)                   |
| Semanal e PITR           | Permanecem desligados nesta proposta |
| IAM da aplicação/eSocial | Nenhuma ampliação                    |
| A1 e envios externos     | Nenhuma alteração                    |

Sete dias é uma proposta inicial, não um mínimo universal. O valor de 98 dias exibido ao editar
no console é o máximo de 14 semanas. Confirmar a retenção com a operação antes da ativação.

## Custo a dimensionar

A tabela oficial de Firestore Standard em `us-central1`, consultada em 01/11/2026, informa
US$ 0,000041096 por GiB-hora de backup, aproximadamente US$ 0,03 por GiB-mês usando 730 horas.
Com tamanho estável `S` GiB e sete cópias diárias retidas, a referência de planejamento é
aproximadamente **US$ 0,21 × S por mês**. É uma aproximação de armazenamento estabilizado,
não uma estimativa da fatura deste projeto.

Restauração custa US$ 0,20 por GiB restaurado, além do uso do novo banco. Backup e restauração não
têm cota gratuita; cobrança em reais segue os SKUs aplicáveis à conta. Medir o tamanho, aprovar o
limite de gasto e acompanhar crescimento antes de assumir um valor mensal.

## Evidências necessárias depois de uma ativação autorizada

1. Programação identificada no banco correto, com recorrência diária e retenção de sete dias.
2. Primeiro backup em `READY`, com origem, `snapshotTime` e `expireTime` registrados.
3. Restauração autorizada em banco novo, conferência de dados e índices, controles de acesso e
   teste sintético da aplicação recuperada.

Salvar a programação não comprova uma cópia pronta. O horário diário varia; acompanhar a idade
real da última cópia, sem prometer recuperação máxima de 24 horas apenas pela recorrência.

O backup cobre documentos e configuração de índices. Regras de segurança, TTL, Storage,
Authentication, Secret Manager, IAM e App Hosting exigem inventário e recuperação próprios.
A restauração nativa usa backup do mesmo projeto e cria outro banco na mesma localização: esta
proposta não cria isolamento de projeto/região nem comprova cópia imutável.

Ver também [o kit local e seus limites](BACKUP_RECOVERY.md) e
[o roteiro de aceite](VALIDACAO_OPERACIONAL.md). Nenhuma restauração foi executada nesta rodada.

## Fontes primárias

- [Preços do Firestore Standard](https://cloud.google.com/firestore/pricing)
- [Backups e restauração](https://docs.cloud.google.com/firestore/native/docs/backups)
- [Exemplo oficial de programação com sete dias](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/backups/schedules/create)
- [Contrato de restauração](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases/restore)
