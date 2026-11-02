# Dependências: correções de segurança de 27/10/2026

A auditoria inicial registrou 15 pacotes de severidade alta (82 ocorrências no
total), incluindo dependências que herdam o mesmo aviso de um pacote transitivo.
Atualizações compatíveis removeram seis ocorrências altas: SDK MCP, body-parser,
follow-redirects, undici, Vite e a cadeia de zod-to-json-schema. O lockfile registra
as versões resolvidas, inclusive Zod 4.6.7 nos consumidores de Zod 4.

As nove ocorrências altas restantes no `npm audit` por versão são preservadas no
relatório bruto. Elas se concentram em duas bibliotecas sem atualização compatível
com a aplicação: Zod 3, exigido pelo Genkit, e extract-zip 2.0.1, exigido pelo CLI.
Não houve renomeação desses pacotes, falsificação de versões nem downgrade do
Genkit para fazer o scanner ficar verde.

## Correções locais

- **Zod 3.25.76:** rejeita arrays acima de `.max()`/`.length()` e conjuntos acima
  de `.max()`/`.size()` antes de percorrer os elementos. A correção é aplicada em
  CommonJS, ESM e fonte TypeScript. Mantém as interfaces usadas pelo Genkit.
- **Zod 4 incluído no pacote Zod 3:** o entry point alternativo recebe a árvore v4
  oficial do Zod 4.6.7, instalada como `zod-security-v4`. Isso evita deixar o
  caminho alternativo vulnerável enquanto se corrige apenas a API v3.
- **extract-zip 2.0.1:** rejeita entradas de symlink, verifica cada diretório antes
  de criar descendentes e recusa sobrescrever symlinks existentes. O arquivo final
  usa `O_NOFOLLOW` quando disponível. ZIPs que dependam de symlinks deixam de ser
  aceitos; extração normal de arquivos continua funcionando. O destino deve ser
  um diretório controlado pelo processo, sem escritores locais não confiáveis.

O `postinstall` aplica somente as alterações revisadas, com hashes SHA-256 antes
e depois. Uma versão ou conteúdo inesperado aborta a instalação. `prebuild`
confere os hashes e a igualdade das árvores v4 antes de permitir gerar artefatos.
Não usar `--ignore-scripts` para produzir uma publicação.

## Verificação e manutenção

`npm run test:dependency-security` verifica coleções grandes, versões CJS/ESM,
v4 mini, conversão de schemas e execução real de um fluxo Genkit sem rede, ZIP
malicioso, symlinks preexistentes, extração normal e a política de auditoria.

O CI não usa mais `continue-on-error` para a auditoria. A verificação permite
somente os três avisos abaixo, nos caminhos exatos corrigidos e depois de
verificar os patches. Um aviso alto novo, crítico, cópia transitiva não corrigida,
falha de rede ou relatório inválido bloqueia o job. O JSON bruto é preservado como
artefato, com os nove avisos por versão ainda visíveis. Avisos moderados e baixos
não são declarados corrigidos por este trabalho.

### Validação do relatório do npm

O gate valida a estrutura relevante do relatório v2 antes de aplicar qualquer exceção:
mapas e objetos, nomes e severidades conhecidas, listas de caminhos e origens, referências
transitivas existentes e contadores inteiros não negativos. Os contadores `high` e `critical`
são obrigatórios; os demais contadores e o total são conferidos quando presentes. O resumo
conta **pacotes afetados**, inclusive avisos propagados, e não a quantidade de advisories.
Campos adicionais do npm, como detalhes de correção e CVSS, continuam permitidos.

Uma advisory direta não pode ser mais grave do que o pacote que a contém. Uma referência
transitiva por nome, porém, aponta para um pacote que pode agregar outras advisories;
por isso, o gate não exige que pai e dependência tenham a mesma severidade.

Relatório inválido significa que o gate não pôde confiar na entrada e bloqueou a avaliação.
Vulnerabilidade sem correção significa que um relatório válido contém um aviso bloqueante
fora das três exceções específicas. Ambos impedem o job, com diagnósticos distintos.
A correção de 01/11/2026 foi motivada por casos sintéticos aceitos pelo parser anterior;
não é evidência de exploração nem de relatório inválido retornado pelo npm em produção.

As regressões puras podem ser executadas sem instalar dependências ou consultar o registry:

```sh
node --test tests/security/audit-gate.test.mjs
```

O comando `npm run test:dependency-security` inclui essas regressões e mantém a conferência
de hashes/versões e os testes de ataque aos patches. Formato conferido na serialização oficial
do [relatório npm v2](https://github.com/npm/cli/blob/v11.9.0/workspaces/arborist/lib/audit-report.js)
e das [origens de vulnerabilidade](https://github.com/npm/cli/blob/v11.9.0/workspaces/arborist/lib/vuln.js).

Quando houver versões oficiais compatíveis, remover os patches correspondentes,
o alias v4 e as exceções específicas, atualizar o lockfile e repetir todas as
regressões. Não ampliar a lista de exceções para contornar uma falha de CI.

Referências oficiais:

- [Zod GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
- [Correção upstream de limites de coleções](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)
- [extract-zip GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)
- [extract-zip GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)

Código corrigido e testes aprovados não comprovam publicação em produção. Registrar
separadamente o SHA do rollout e o resultado dos testes autenticados de acesso.
