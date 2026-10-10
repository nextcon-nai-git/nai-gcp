# Segunda revisão geral — NAI GCP

Base: `5c57c43`, após o PR #63. Esta rodada cobre inventário de referências, fronteiras cliente/servidor, análises de IA, telemedicina, dependências e verificações automatizadas do projeto. Inventário final: 555 arquivos TypeScript/TSX, aproximadamente 108 mil linhas. A varredura de todos os arquivos não equivale à leitura manual de cada linha nem a uma certificação de ausência de falhas.

## Correções e simplificações

- Vinte entradas de IA/server actions agora verificam sessão Firebase revogada e perfil antes de processar o conteúdo. A credencial viaja como argumento separado; não entra nos prompts. Entradas serializadas têm limite de tamanho. Telas consumidoras obtêm o token no momento da ação.
- Perfis clínicos ficam separados de operações/documentos e análises financeiras. Essas ações analisam conteúdo apresentado pelo usuário; qualquer consulta ao banco continua exigindo autorização própria por empresa.
- Dez módulos usados apenas no ambiente de desenvolvimento deixam de declarar `use server` e passam a ser `server-only`. Não criam endpoints de Server Actions por importação.
- Telemedicina registra uma sala Google Meet informada, com validação de URL, e-mails, data futura e duração de 30 minutos no fuso de Brasília. Espera a confirmação do Firestore antes de mostrar sucesso. Impede envio duplicado durante gravação. Permissões da agenda seguem o acesso administrativo já previsto nas regras.
- Elimina links de reunião aleatórios, convites supostamente enviados, sinais vitais fixos, selos HIPAA sem evidência e botão que dizia assinar prontuário mas apenas alterava status. Registros anteriores são preservados; salas simuladas/legadas sem confirmação não ficam clicáveis.
- Agenda de exames direciona ao agendador real. Remove três exames de demonstração, data fixa de julho e estado fictício de sincronização com Calendar.
- Remove componente arquivista não utilizado e sua cadeia de ações, fluxo de áudio silencioso, exemplo hello, Butler sem consumidores, wrapper de contrato não utilizado, ETL experimental sem consumidores e deduplicação por nome que poderia misturar unidades. Não remove documentos, clientes ou dados de produção.
- Remove dependências sem referências: `@genkit-ai/next`, `patch-package`, `wav` e `@types/wav`; 25 pacotes retirados da instalação. Auditoria de produção: 75 → 72 alertas, altos 14 → 12, sem críticos. Não força downgrade do Genkit nem migração major do Tailwind.
- Assistente médico deixa de atribuir CIDs fixos a palavras de sintomas. JSON clínico inválido retorna 400; resposta não permite cache e erro de streaming não expõe detalhes do provedor.

## Evidências

- 543 testes em 83 arquivos passaram, incluindo negação de sessão em cada uma das 20 entradas, perfis indevidos, limite de entrada, separação de token/prompt, formato seguro da sala, calendário e erros do streaming médico.
- TypeScript e formatação integral aprovados. Lint sem erros; avisos legados permanecem visíveis.
- Primeira compilação local atingiu o limite padrão de heap de 2 GB; repetição com o mesmo limite de 6 GB adotado pelo CI. A integração depende dos checks de build e segurança do PR.

## Limites e pendências

- Não houve revisão normativa por médico, engenheiro ou advogado. Outros parsers e prompts legados ainda contêm heurísticas e precisam de avaliação profissional antes de suas saídas serem consideradas evidências.
- Persistem 12 alertas altos de dependências transitivas e dívida de tipagem/lint. Contagem de audit não prova explorabilidade nem segurança integral.
- A sala é fornecida pelo operador: a validação de formato não comprova que exista, esteja disponível ou tenha participantes convidados. Não existe sincronização Calendar, telemetria IoT ou assinatura eletrônica de PEP neste fluxo.
- Não foram criados agendamentos, enviados convites ou submetidos dados médicos reais para testar IA. Disponibilidade e qualidade dos provedores de IA não são comprovadas por testes unitários com mocks.
- O relatório SST experimental e o salvamento de leads ainda usam inicialização de SDK cliente dentro de código servidor; a autenticação das análises foi corrigida, mas a persistência desses fluxos exige implementação própria e validação de empresa antes de migração para Admin SDK.
