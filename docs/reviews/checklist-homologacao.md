# Checklist de encerramento da revisão NAI-GCP

Escopo inventariado em 13/10/2026: 106 páginas e 68 rotas de API em `src/app`.
Cobertura automatizada, leitura de código e homologação operacional são medidas
separadas. Não existe percentual global atestado de revisão linha a linha.

Cada item só pode ser concluído com evidência vinculada ao commit ou ambiente
correspondente. Uma aprovação de teste sintético não conclui um fluxo real.

| Item                      | Critério de encerramento                                                                  | Estado e evidência atual                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Qualidade de código       | Tipos, formatação, testes, lint e build aprovados no SHA integrado                        | Base com 1.448 testes aprovados; 1.347 avisos de lint permanecem; conferir checks de cada PR.                   |
| Regras de dados           | Firestore e Storage sem falhas de isolamento, concorrência e integridade                  | PR #114: 129 testes locais aprovados; checks hospedados em acompanhamento.                                      |
| Reservas de prestadores   | Identidade fiscal, duplicidade e atualização concorrente protegidas                       | PR #114 fecha reserva com ID divergente; testes sintéticos, publicação de regras a confirmar.                   |
| Documentos e contratos    | Fonte original preservada, reimportação idempotente, erro sem falso sucesso               | PR #114 corrige regra de Storage; homologação autenticada pendente.                                             |
| Segurança de dependências | Alertas altos/críticos resolvidos ou risco avaliado com mitigação documentada             | 12 altos, 59 moderados, zero críticos no audit de produção. Pendentes.                                          |
| Navegação e interface     | Conferir estados normais, vazios, erro e retomada das páginas por perfil                  | Domínio com www abre login; sessão autenticada ausente nesta execução. Não foram homologadas 106 telas.         |
| Cadastros e importações   | Clientes, colaboradores, prestadores e arquivos persistem sem duplicar nem cruzar tenants | Regressões automatizadas disponíveis; confirmação funcional autenticada pendente.                               |
| Fila clínica              | Agendamento, check-in, revisão profissional do original e conclusão coerentes             | Implementado e testado com fixtures; homologação clínica pendente, sem decisões clínicas automatizadas.         |
| Comercial e financeiro    | Proposta, aprovação, contrato, implantação, produção, cobrança e recebimento coerentes    | Testes disponíveis; condições comerciais não representadas estão no relatório remanescente.                     |
| Omie e fiscal             | Consultas conciliadas; operações externas homologadas em ambiente próprio                 | Sem confirmação de credenciais, baixas bidirecionais ou emissão direta nesta sessão.                            |
| Assinatura e eSocial      | Certificado, provedor, assinatura, transmissão e recibo verificados                       | Pendente; rascunhos e mocks não equivalem a protocolos válidos.                                                 |
| Webhooks e comunicações   | Autorização, validação de entrada, limites e erros seguros                                | Revisão incremental em andamento. Proibido enviar e-mails/mensagens reais sem revisão e autorização do usuário. |
| Domínio e deploy          | SHA publicado confirmado; regras/índices publicados separadamente                         | Sem www retornou 502 neste navegador; com www chegou ao login. Deploy não inferido do merge.                    |
| Recuperação               | Backup/PITR configurados e restauração exercitada em ambiente isolado                     | Pendência histórica, sem nova confirmação de configuração nesta sessão.                                         |
| Governança de acesso      | Perfis e chaves restritos; proteção de main conferida                                     | Pendências históricas de proteção, credenciais e alertas precisam de inspeção atual.                            |

Não encerrar esta lista reduzindo escopo, ocultando avisos, desabilitando testes,
criando dados clínicos presumidos ou tratando serviços explicitamente
indisponíveis como implementados. Integrações ausentes e acesso externo devem
permanecer como pendências concretas, com causa e próximo passo.
