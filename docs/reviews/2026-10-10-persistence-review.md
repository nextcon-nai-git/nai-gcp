# Revisão de persistência e respostas comerciais — 10/10/2026

## Problemas corrigidos

- A ação de relatório SST usava o SDK de navegador no servidor e gravava sem cliente obrigatório. Agora valida entrada, autenticação, perfil, vínculo e existência do cliente antes da IA; usa Admin SDK, registra autoria autenticada e aguarda a persistência.
- Relatórios de visita são salvos no acervo `companies/{companyId}/reports`, com análise e revisão profissional pendente. O formulário substitui o relatório fixo da NATIVA; nenhum registro de produção foi excluído.
- O upload documental não grava mais uma URL `local://` quando o Storage falha. Arquivos recebem identificador exclusivo e classificação não é apresentada como auditoria concluída.
- Contatos comerciais exigem autenticação, limites de entrada e campos permitidos; autor e empresa vêm da sessão. A interface informa falhas de gravação e impede envios simultâneos.
- Removidos fallback que inventava clínica, confirmação de reserva e preços, e instruções de IA que prometiam proteção jurídica total. Respostas comerciais explicam que valores e disponibilidade dependem da equipe.
- Removidos botão legado, JSON de demonstração e serviço de relatório sem consumidores; eliminados imports sem uso nas telas alteradas.

## Verificação

- 554 testes em 84 arquivos, incluindo 11 novos testes de autorização e persistência.
- TypeScript sem erros; validação de formatação, lint e build de produção.
- CI e validação das regras Firebase exigidos antes da integração.

## Limites conhecidos

- A revisão é incremental; não certifica ausência de falhas em todo o produto.
- Dependências transitivas continuam com alertas documentados na revisão anterior. Não foram aplicados overrides incompatíveis; versões Genkit publicadas foram consultadas e já correspondem à linha atual instalada.
- Rascunhos não equivalem a assinatura técnica ou conclusão das ações recomendadas.
- Nenhuma consulta, visita ou lead de teste foi criado em produção.
