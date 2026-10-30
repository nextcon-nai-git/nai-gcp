# Periódicos AVP: fontes atuais, mapa e atualização horária

A operação interna lê a aba **Controle** da campanha e **NAI Credenciamento** da base de credenciamento. Os links são configurados em **Periódicos e rede AVP → Fontes e atualização** por administrador interno. IDs, registros pessoais e credenciais não são publicados no repositório. O formulário mostra o e-mail real da identidade de leitura obtida pelo Google Auth; conceder somente leitura às duas fontes, sem torná-las públicas.

## Leitura e publicação

- A campanha usa o cabeçalho da linha 4 e conserva a linha original, mesmo com colunas extras ou reordenadas. CPF + admissão deduplicam os registros; CPF não é devolvido pela API nem gravado na versão publicada.
- O credenciamento usa o cabeçalho da linha 2. O valor negociado preenchido tem prioridade sobre o atual. Valor ambíguo permanece sem preço; a autorização para agendamento não comprova contrato assinado.
- Prestadores e preços históricos continuam nas abas privadas anteriores, identificados por origem. A campanha atual não depende da antiga cópia da convocação.
- As duas fontes devem passar pela validação antes de trocar a configuração. Escritas em partes completam uma versão imutável antes da troca do ponteiro. Falhas preservam a última leitura íntegra, com data e erro visíveis.
- Configuração e versões ficam em `clinic_portal_private/avp_periodic_control`, namespace existente sem acesso direto pelo SDK cliente. As APIs aplicam a autorização interna AVP antes de ler os dados. A configuração exige administrador interno e revisão atual.

## Atualização horária

O endpoint OIDC existente `/api/internal/avp-sheet-sync` continua atualizando a fila de ASOs a cada chamada e também consulta os periódicos quando muda a hora UTC. O job existente de dez minutos faz essa verificação; não é criado outro job nem alterado seu intervalo. O controle usa lease e limita novas tentativas a 30 segundos. Uma falha da fila não impede a tentativa dos periódicos e vice-versa.

A tela consulta o snapshot a cada hora e ao retornar à aba. Uma leitura vencida também pode ser renovada ao abrir o painel. Isso não substitui o job de servidor: o campo **Última chamada do agendador** deve ser conferido na configuração após a implantação. `lastScheduledAt` registra uma leitura efetivamente concluída pelo agendador; `schedulerSeenAt` registra cada chamada recebida, inclusive quando ainda não venceu o intervalo. Não afirmar execução com a tela fechada sem essa evidência.

## Mapas

O mapa dos periódicos apresenta um marcador por município e status, preservando situações mistas:

| Cor      | Status                                          |
| -------- | ----------------------------------------------- |
| Vermelho | Não iniciados; em contato até haver agendamento |
| Verde    | Agendados; realizados aguardando ASO            |
| Azul     | ASO recebido ou data de recebimento registrada  |
| Amarelo  | Cancelados, faltas ou não comparecimento        |

Status desconhecido, divergência entre linhas duplicadas ou recebimento em registro cancelado ficam para conferência, sem cor inventada. Cidades sem coordenada permanecem na lista. As posições são referências municipais, não endereços de colaboradores ou clínicas.

O botão **Mapa de custos** abre o mapa único já existente da operação. Ele usa o mesmo snapshot do credenciamento: verde abaixo de R$40; amarelo de R$40 a menos de R$50; vermelho de R$50 a R$70, inclusive; roxo acima de R$70. Ausência de preço permanece explícita. O pin municipal usa o maior preço atual das clínicas do município, e o detalhe mostra cada valor. O histórico da fila permanece disponível. A aba de ASOs é desmontada quando fica inativa para não manter outro mapa e consultas em segundo plano.

## Validação

Testar leitura por cabeçalhos, preços atuais e históricos, limites de cor, status mistos, versões completas, falhas de fonte/escrita, concorrência, intervalo de uma hora, token OIDC e autorização. Após a publicação, conferir as contagens contra as duas planilhas, as quatro cores em testes e os estados realmente presentes em produção. Confirmar o heartbeat e a leitura programada separadamente de uma atualização manual.
