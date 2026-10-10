# Revisão do NAI GCP — 10/10/2026

Base: main, commit 21bb86b. Escopo automatizado: 571 arquivos em src, inventário das rotas de API, suíte integral de testes, lint, TypeScript e auditoria de dependências de produção. A inspeção manual concentrou-se nos pontos sinalizados pela varredura. Isto não constitui certificação de revisão linha a linha de todos os arquivos, conformidade regulatória ou ausência de vulnerabilidades.

## Correções

- Ficha do cliente consulta o cadastro e colaboradores persistidos; elimina fallback de empresa inventada, três colaboradores artificiais por unidade, datas e aptidão de ASO presumidas, médico coordenador fixo, prestadores associados apenas por cidade e indicadores estáticos de conformidade/eSocial.
- Preserva anexos por cliente, jornadas e acesso aos módulos de engenharia, saúde, prestadores, colaboradores e eSocial. Erros de acesso e cadastro ausente têm estados próprios. A troca de cliente remonta as assinaturas de dados.
- Catraca deixa de sortear aptidão/EPI e gravar decisões artificiais. Tela declara a integração indisponível e encaminha para módulos existentes. Nenhum registro histórico foi apagado.
- Fila eSocial mantém leitura dos últimos 100 eventos do cliente e elimina geração aleatória de eventos. Status interno não é apresentado como prova de transmissão.
- Analytics duplicado com séries fixas redireciona ao painel com fontes persistidas.
- Excluído componente de assinatura digital simulado sem referências no projeto. O componente médico utilizado no ASO permanece.
- Sugestão de exames exige autenticação e perfil autorizado tanto na API como na server action. Entrada limitada e validada, idade obrigatória, JSON inválido tratado; dados são interpolados no prompt. Sugestões exigem revisão médica.
- Soma de meses usa calendário UTC e limita o dia ao final do mês de destino, evitando deriva de fuso e transbordamento de fevereiro.
- Jornada de entregas aponta responsáveis, prazos e evidências para o centro de operação.
- Configuração ESLint obsoleta removida; diretórios de saída ficam no flat config.
- Atualizações compatíveis no lockfile, sem force/major: auditoria de produção passou de 77 alertas (16 altos) para 75 (14 altos), sem críticos. Genkit e plugin Google permanecem alinhados em 1.42.0.

## Pendências explícitas

- Há alertas de dependências remanescentes, sobretudo transitivos. Migrar versões principais exige validação própria; não foram forçados downgrades sugeridos pelo audit.
- O lint legado ainda possui avisos (baseline: 1.733; após simplificação: aproximadamente 1.656), embora sem erros. Não foram desabilitadas regras para ocultá-los.
- Outras páginas e flows legados ainda exigem revisão funcional e de autorização individual. Uma varredura por padrões não comprova segurança de todas as server actions.
- Regras de periodicidade clínica, recomendações de IA e enquadramentos normativos necessitam revisão pelo responsável técnico; o ajuste de calendário não valida essas regras.
- Anexos genéricos em sourceDocuments ainda não integram a contagem de PGRs estruturados em pgr_cards. Anexo não implica análise ou aprovação técnica.
- Integrações reais de catraca/biometria e confirmação de protocolos eSocial continuam dependentes de configuração e evidências externas.
