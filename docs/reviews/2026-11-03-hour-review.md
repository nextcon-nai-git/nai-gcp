# Revisão geral do NAI — 03/11/2026

## Escopo e método

Revisão iniciada às 02:32:43 UTC, com uma hora reservada para inspeção,
reprodução de defeitos, correções e validação. Base: `main` no commit
`81585d343a8ba4529ace3cf9f2b82896b1109df8`; trabalho isolado em
`review/nai-hour-20261103`.

O inventário inicial abrangeu 1.341 arquivos versionados e 1.101 arquivos em
`src`, incluindo 376 arquivos de testes. A revisão combinou verificações
automatizadas gerais, leitura dirigida dos fluxos de maior risco e revisão
cruzada das alterações. Isso não equivale a uma auditoria manual de cada linha
nem a uma garantia de ausência de defeitos.

As frentes examinadas incluíram autenticação, regras Firestore/Storage,
administração, ASO, eSocial, PGR, documentos, produção, financeiro, integrações,
assistentes de IA, dependências e workflows. Nenhum envio real de e-mail,
transmissão ao eSocial, operação no Omie ou implantação foi necessário para os
testes. As regressões usam dados sintéticos.

## Alterações

| Frente             | Resultado                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autorização        | Regras e serviços seguem a prioridade do vínculo de empresa já definida em `parseClaims`; perfis excluídos ou suspensos deixam de sustentar sessões e operações administrativas.  |
| ASO e eSocial      | Leituras demoradas verificam novamente o acesso antes de devolver dados. O vínculo conferido pelo médico inclui a identidade da empresa e do trabalhador.                         |
| Revisão clínica    | Alteração da identidade após a conferência exige nova validação explícita. Revisões anteriores são preservadas; conclusões históricas consistentes mantêm a resposta idempotente. |
| CNPJ               | A validação considera a entrada original e preserva letras válidas, sem converter uma entrada inválida em outro documento ao remover caracteres.                                  |
| Financeiro         | A aprovação e a rejeição respeitam a separação entre criador, último editor e revisor. Acesso ao DRE e despacho ao Omie são verificados nos limites das operações demoradas.      |
| Exportações        | Relatórios CSV reutilizam o escape de texto existente; valores monetários permanecem numéricos.                                                                                   |
| PGR e documentos   | Revisões, arquivos e consultas permanecem vinculados à fonte e à autorização atuais; mudanças de sessão e empresa invalidam dados e respostas pendentes na interface.             |
| Planos de ação     | Consultas usam o vínculo atual e aguardam o carregamento válido do perfil. Dados antigos não reaparecem durante suspensão ou erro de sessão.                                      |
| Assistentes        | Operações demoradas voltam a verificar o administrador e o escopo das empresas. O assistente médico verifica o acesso clínico atual antes de encaminhar o contexto à IA.          |
| Kits e integrações | Geração e recuperação de kits verificam o perfil atual. Consultas AVP e despacho de mensagens revisadas respeitam alterações de acesso durante a operação.                        |
| CI                 | O build de validação deixa de receber uma credencial de IA desnecessária. O teste de revisão de contrato aguarda a interface resultante da extração.                              |
| Documentação       | `docs/CI.md` passa a refletir os gates e as versões efetivas do ambiente.                                                                                                         |

### Compatibilidade e decisões

- As permissões corporativas internas e as carteiras explicitamente autorizadas
  foram preservadas e incluídas nos controles positivos dos testes.
- Uma resposta válida de uma integração já acionada continua sendo registrada;
  a revalidação de acesso não descarta recibos nem provoca reenvio automático.
- Reservas financeiras cujo despacho foi interrompido continuam disponíveis
  para reconciliação, sem liberação automática de estado incerto.
- Revisões clínicas abertas anteriores à inclusão do vínculo de identidade
  precisam de nova conferência explícita do original. Registros já concluídos
  não são reabertos automaticamente.
- Não foram alteradas dependências nem aplicadas atualizações gerais por
  `npm audit fix`.

## Evidências locais

| Verificação                                         | Resultado                                     |
| --------------------------------------------------- | --------------------------------------------- |
| Suíte inicial                                       | 4.380 testes em 376 arquivos, todos aprovados |
| Rodada intermediária após correções, com cobertura  | 4.523 testes em 379 arquivos, todos aprovados |
| Reexecução isolada após diagnóstico da rodada final | 69 testes em cinco arquivos, todos aprovados  |
| Regras Firestore e Storage                          | 243 testes em 21 arquivos, todos aprovados    |
| Regressões de segurança de dependências             | 57 testes aprovados                           |
| Infraestrutura e recuperação offline                | 52 testes aprovados                           |
| TypeScript                                          | Sem erros                                     |
| ESLint                                              | 0 erros e 1.300 avisos em 1.152 arquivos      |
| Prettier e `git diff --check`                       | Aprovados                                     |

Foram acrescentados 168 casos na suíte da aplicação e 28 casos nas regras.
Os defeitos corrigidos tiveram regressões específicas verificadas antes e
depois das alterações, com controles positivos para os acessos e operações que
devem continuar funcionando.

A última rodada local completa executou 4.548 testes: 4.543 passaram e cinco
falharam. Três falhas foram estouros do limite de tempo em testes de interface
que não foram alterados, durante uma execução com contenção de recursos e lint
concorrente. Duas vieram de simulações de respostas clínicas autorizadas que
usavam um perfil de RH: essas fixtures foram corrigidas para médico e empresa
compatíveis, sem afrouxar as asserções. A repetição isolada dos cinco arquivos
afetados passou nos 69 testes. Nenhum timeout foi aumentado. O resultado
integrado final e o build devem ser confirmados pelos checks do PR.

### Cobertura da rodada integrada com 4.523 testes

| Métrica      | Cobertura |
| ------------ | --------: |
| Instruções   |    75,15% |
| Ramificações |    69,51% |
| Funções      |    69,99% |
| Linhas       |    76,77% |

Os limites configurados em `vitest.config.ts` foram atendidos. A cobertura mede
execução de código nos testes; não mede, isoladamente, a correção do negócio.

### Dependências

O gate `scripts/security/check-audit.mjs` passou, incluindo a verificação dos
backports de segurança já presentes no repositório. Os relatórios brutos ainda
apontam pacotes afetados por versão:

| Escopo                | Baixos | Moderados | Altos | Críticos |
| --------------------- | -----: | --------: | ----: | -------: |
| Todas as dependências |      1 |        86 |     7 |        0 |
| Somente produção      |      0 |        71 |     2 |        0 |

Esses números são contagens de pacotes afetados, não de vulnerabilidades
independentes. Os avisos altos foram aceitos pelo gate apenas após a verificação
das correções locais existentes. Os avisos baixos e moderados continuam
pendentes de tratamento; um gate aprovado não os declara resolvidos.

## CI e limites da revisão

O build de produção deve rodar no CI isolado, conforme `SECURITY.md`. O resultado
de build, CodeQL e demais jobs deve ser conferido nos checks do SHA final do PR;
não se deve inferir aprovação remota a partir dos testes locais.

Esta rodada não substitui homologação com contas e integrações reais, análise
de capacidade com dados de produção ou execução completa das jornadas no
navegador. Também não realizou migrações de dados ou de anexos existentes.
Pendências que exigem planejamento operacional ou tratamento reservado devem
ser acompanhadas separadamente, sem publicar evidências sensíveis no PR.

Pontos de manutenção observados incluem o passivo de avisos de lint e
dependências, paginação de algumas leituras financeiras e a confirmação dos
pontos de emissão dos webhooks antes de ativar automações adicionais.
