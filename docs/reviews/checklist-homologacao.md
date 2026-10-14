# Checklist de encerramento da revisão NAI-GCP

Escopo inventariado em 13/10/2026: 106 páginas e 68 rotas de API em `src/app`.
Cobertura automatizada, leitura de código e homologação operacional são medidas
separadas. Não existe percentual global atestado de revisão linha a linha.

Cada item só pode ser concluído com evidência vinculada ao commit ou ambiente
correspondente. Uma aprovação de teste sintético não conclui um fluxo real.

| Item                      | Critério de encerramento                                                                  | Estado e evidência atual                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Qualidade de código       | Tipos, formatação, testes, lint e build aprovados no SHA integrado                        | PR #116: 1.472 testes, tipos, lint e build aprovados no CI. Avisos de lint permanecem.                   |
| Regras de dados           | Firestore e Storage sem falhas de isolamento, concorrência e integridade                  | PR #114 integrado e 129 testes aprovados. Storage publicado; Firestore recebeu restrições fiscais, sem publicação integral da main.                                      |
| Reservas de prestadores   | Identidade fiscal, duplicidade e atualização concorrente protegidas                       | Reserva com ID divergente bloqueada; regras fiscais publicadas, recarregadas e comparadas. 22 testes da combinação publicada aprovados.                   |
| Documentos e contratos    | Fonte original preservada, reimportação idempotente, erro sem falso sucesso               | Regra Storage create-only publicada e conferida. Fluxo completo de importação em homologação permanece pendente.                                             |
| Segurança de dependências | Alertas altos/críticos resolvidos ou risco avaliado com mitigação documentada             | 12 altos, 59 moderados, zero críticos no audit de produção. Pendentes.                                          |
| Navegação e interface     | Conferir estados normais, vazios, erro e retomada das páginas por perfil                  | Sessão SUPER_ADMIN confirmada; dashboard e 48 destinos do menu inspecionados. Não equivale à homologação funcional das 106 páginas por perfil.         |
| Cadastros e importações   | Clientes, colaboradores, prestadores e arquivos persistem sem duplicar nem cruzar tenants | Regressões automatizadas disponíveis; confirmação funcional autenticada pendente.                               |
| Fila clínica              | Agendamento, check-in, revisão profissional do original e conclusão coerentes             | Implementado e testado com fixtures; homologação clínica pendente, sem decisões clínicas automatizadas.         |
| Comercial e financeiro    | Proposta, aprovação, contrato, implantação, produção, cobrança e recebimento coerentes    | Testes disponíveis; condições comerciais não representadas estão no relatório remanescente.                     |
| Omie e fiscal             | Consultas conciliadas; operações externas homologadas em ambiente próprio                 | Conexão Omie e consulta paginada confirmadas. Emissão direta indisponível; baixas bidirecionais não homologadas.                            |
| Assinatura e eSocial      | Certificado, provedor, assinatura, transmissão e recibo verificados                       | Pendente; rascunhos e mocks não equivalem a protocolos válidos.                                                 |
| Webhooks e comunicações   | Autorização, validação de entrada, limites e erros seguros                                | PR #115 integrado: validação, limite de corpo e erros seguros; 21 testes focados. Nenhuma mensagem enviada. |
| Domínio e deploy          | SHA publicado confirmado; regras/índices publicados separadamente                         | App Hosting PR #115 confirmado e correção #116 visível. Sem www não configurado no backend; workflow de regras falhou por credencial ausente.                    |
| Recuperação               | Backup/PITR configurados e restauração exercitada em ambiente isolado                     | Console confirmou backups programados e PITR desativados. Restauração isolada não exercitada.                                         |
| Governança de acesso      | Perfis e chaves restritos; proteção de main conferida                                     | API confirmou main protected=false. Credencial do workflow ausente; alterações de escopo clínico não publicadas pelo console.                            |

Não encerrar esta lista reduzindo escopo, ocultando avisos, desabilitando testes,
criando dados clínicos presumidos ou tratando serviços explicitamente
indisponíveis como implementados. Integrações ausentes e acesso externo devem
permanecer como pendências concretas, com causa e próximo passo.
