# Recuperação de telas e logs

As páginas autenticadas ficam dentro de `ErrorBoundary` no `AppContent`. Uma falha
de renderização mostra uma mensagem em português e o botão **Tentar novamente**,
com foco de teclado. O menu lateral e a navegação superior continuam disponíveis.
Trocar a rota cria uma nova instância do limite; tentar novamente remonta o conteúdo
da tela. Se a causa continuar, a mensagem de recuperação aparece novamente.
Exceções que chegam como `null`, texto ou outros valores também mantêm a recuperação
disponível; o logger recebe um erro genérico nesses casos, sem incluir o valor recebido.

O limite fica depois da verificação de sessão e perfil. Ele não libera conteúdo
protegido durante login, consulta do perfil ou provisionamento pendente. A cobertura
inclui essa integração e mantém os testes existentes de autenticação e permissões.

Limites de erro do React tratam falhas de renderização de componentes descendentes.
Erros de eventos, operações assíncronas, renderização no servidor e falhas no próprio
menu precisam do tratamento nos respectivos fluxos. Uma nova tentativa pode perder
o estado local da tela; ela não confirma gravação de formulários ou requisições.

O logger mantém `severity`, `message` e `timestamp` sob seu controle. O contexto não
pode substituir esses campos nem trocar o registro por um `toJSON` na raiz. Valores
BigInt são convertidos em texto, erros preservam nome/mensagem/stack e referências
circulares são sinalizadas. Uma falha de serialização produz um registro mínimo
com `contextSerializationFailed: true`, sem propagar a exceção.

Campos conhecidos de autenticação, como senha, Authorization, cookie, token e chave
privada, são removidos do contexto estruturado. Isso não é um filtro geral de dados
pessoais: não registrar documentos clínicos, dados de clientes, credenciais ou
segredos em mensagens, stack traces ou campos livres.

## Validação local

Usar Node 24 e `npm ci`, como no backend `nai`. Vitest e seu provedor de
cobertura ficam na mesma versão, `4.1.11`, compatível com essa linha do Node.

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
```

Os testes usam falhas e registros sintéticos, sem serviços ou credenciais de produção.
O calendário usa as chaves atuais do DayPicker 10 e possui testes de seleção,
datas desabilitadas e navegação entre meses.

## Resultado de 03/10/2026

- Instalação limpa com `npm ci --engine-strict`, Node 20.20.2 e npm 10.9.9.
- `npm run ci`: formatação, lint sem erros, tipos, 51 testes e build aprovados.
- Seis testes das regras de acesso aprovados no emulador Firestore.
- Validação no Chromium em 1280 e 390 pixels: calendário, foco no botão de
  recuperação, nova tentativa e troca de tela, sem erros não tratados.

Permanecem 566 avisos de lint e os avisos de bundling do OpenTelemetry. A auditoria
completa apontou 82 pacotes sinalizados (28 altos, 53 moderados e um baixo); a
auditoria de produção apontou 73 (20 altos e 53 moderados), sem críticos.
Esses números incluem propagação pela árvore e dependem dos advisories consultados.
O comando com `--audit-level=critical` passou; o gate com `--audit-level=high`
permanece bloqueado. Os pacotes de runtime não mudaram neste conjunto de alterações.
No GitHub, o job de revisão de dependências também retornou que o recurso não está
disponível para este repositório e indicou verificar a habilitação do Dependency
graph em [Security analysis](https://github.com/nextcon-nai-git/nai-gcp/settings/security_analysis).
Essa configuração precisa ser resolvida para esse job funcionar.

Referências dos mantenedores:

- https://v4.vitest.dev/guide/
- https://daypicker.dev/upgrading-v8-to-v10
- https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
