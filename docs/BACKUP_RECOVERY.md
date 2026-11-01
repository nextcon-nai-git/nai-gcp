# Verificação local de arquivos e exercício de recuperação

O NAI inclui um utilitário **offline** para empacotar uma exportação já concluída,
verificar sua integridade e ensaiar a recuperação dos arquivos em uma pasta temporária
isolada. Ele não exporta dados do Firestore, não envia arquivos ao Google Drive e não
restaura um banco. A integração em `src/actions/google-drive-backup.ts` continua
pendente e retorna `isConnected: false`; nenhum backup externo está comprovado.

## O que este exercício comprova

O utilitário calcula SHA-256 de cada arquivo, registra o conjunto exato de arquivos e
diretórios em um manifesto e exige uma referência de integridade guardada **fora** do
pacote. O comando `drill` recria esses arquivos em um diretório temporário privado novo,
relê os bytes e compara os hashes. A cópia permanece para conferência e limpeza manual.
Isso permite descobrir corrupção,
arquivos ausentes, arquivos extras e alterações no manifesto antes de uma tentativa de
recuperação real.

O resultado não demonstra consistência transacional da exportação, retenção externa,
restauração de Firestore, recuperação de usuários do Firebase Authentication ou
funcionamento do aplicativo com os dados recuperados. Essas verificações exigem acesso
operacional e um ambiente separado.

## Criar um kit a partir de uma exportação autorizada

Use Node.js 24 em Linux e uma pasta de exportação concluída, sob controle exclusivo do
operador e sem alterações durante a execução. A origem, o kit e os diretórios pais de
saída e de trabalho precisam estar sob controle do operador ou do sistema. O utilitário apenas lê a origem; não
obtém credenciais nem consulta a origem remota. Não use a pasta do repositório, a pasta
pessoal do operador ou uma pasta de credenciais como origem.

O exemplo usa caminhos fictícios. A pasta de origem precisa existir e conter a cópia
autorizada. O destino precisa ser novo; seu diretório pai deve existir. Informe a data
real da conclusão da exportação e um rótulo de escopo sem dados pessoais:

```bash
node scripts/recovery-kit.mjs create \
  --source /tmp/nai-export-autorizado \
  --out /tmp/nai-kit-20261101 \
  --kind mixed-export \
  --project studio-8439299034-125c7 \
  --exported-at 2026-11-01T15:00:00Z \
  --scope exportacao-aprovada
```

Tipos disponíveis: `firestore-export`, `document-export`, `configuration-export`,
`mixed-export` e `synthetic-test`. O tipo, o projeto, a data e o escopo são declarações
do operador, sem confirmação remota. Não use esses campos como prova de procedência.

O destino contém `recovery-manifest.json` e uma pasta `payload/`. A saída JSON informa
contagens, bytes e `manifestSha256`. Guarde esse hash em um registro protegido separado
do kit e associe-o à evidência da exportação original. Uma cópia do hash dentro do
próprio kit não constitui uma referência confiável: alguém que altere o pacote também
poderia substituí-la. SHA-256 verifica integridade contra essa referência; não fornece
criptografia nem autenticação por assinatura.

## Verificar e ensaiar a recuperação dos arquivos

Substitua o marcador pelo hash de 64 caracteres previamente registrado fora do kit:

```bash
node scripts/recovery-kit.mjs verify \
  --kit /tmp/nai-kit-20261101 \
  --expected-manifest-sha256 HASH_REGISTRADO_FORA_DO_KIT

node scripts/recovery-kit.mjs drill \
  --kit /tmp/nai-kit-20261101 \
  --expected-manifest-sha256 HASH_REGISTRADO_FORA_DO_KIT
```

Não existe opção de destino de restauração. O exercício cria sua própria pasta
temporária com nome aleatório e permissões restritas, copia e relê os arquivos.
**O utilitário nunca apaga pastas.** A cópia temporária permanece ao terminar, inclusive
se a verificação falhar. Uma falha na criação também pode deixar um kit parcial no
destino solicitado. Ambos os casos indicam `manualCleanupRequired: true`.
O kit original permanece disponível.
Nenhum desses comandos acessa APIs de nuvem, altera o banco, envia eSocial ou dispara
e-mails.

As saídas de sucesso distinguem as evidências:

| Campo | Significado |
| --- | --- |
| `integrityVerified: true` | O conjunto de arquivos e os hashes conferem com o manifesto e sua referência externa. |
| `localFileRecoveryVerified: true` | Somente no `drill`: a cópia isolada foi relida e conferida. |
| `temporaryFilesRemoved: false` | No `drill`: a cópia temporária foi mantida. |
| `manualCleanupRequired: true` | Existe uma área de trabalho ou kit parcial que requer conferência e limpeza manual. |
| `workspaceId` | Nome aleatório da pasta do exercício, sem caminho absoluto nem dados pessoais. |
| `sourceSnapshotConsistencyVerified: false` | A consistência da exportação na origem não foi comprovada. |
| `offsiteBackupVerified: false` | Nenhuma retenção em destino externo foi verificada. |
| `databaseRestoreVerified: false` | Nenhuma restauração de banco foi executada. |
| `cloudCallsPerformed: false` | O utilitário não chamou APIs de nuvem. |

Os relatórios padrão não incluem nomes de arquivos, nomes de pessoas, caminhos locais,
conteúdo nem o rótulo de escopo. Falhas retornam código e mensagem genérica. O manifesto
contém caminhos relativos e metadados: trate-o como informação restrita e não anexe
manifestos de dados reais a PRs, issues ou logs públicos.

### Conferência e limpeza manual

O `workspaceId` fica dentro do diretório temporário usado pelo Node.js. Para escolher
uma área privada conhecida, crie previamente um diretório novo com modo `0700` em um
local aprovado e defina `TMPDIR` somente para o comando `drill`. Esse diretório é a
área de trabalho local; não é um destino de restauração de banco.

Antes de remover qualquer resíduo, interrompa os processos que possam escrever nessa
área, confirme o `workspaceId`, o proprietário e o conteúdo esperado. Em falhas de
`create`, confira separadamente o destino passado em `--out`. Se houve substituição
ou movimentação de pastas, não suponha que o caminho atual ainda contém o kit parcial.
O utilitário não oferece comando de limpeza; use o procedimento de retenção e remoção
do ambiente após essa conferência. Não deixe cópias locais de dados reais sem uma
política de retenção.

A decisão de não apagar automaticamente evita uma corrida entre conferir um caminho
e removê-lo: outra operação pode trocar a pasta nesse intervalo. As APIs de caminhos
usadas aqui não fornecem uma remoção recursiva atômica vinculada à identidade de uma
pasta. **O utilitário não protege contra outro processo com o mesmo UID nem contra
um administrador privilegiado.** Use uma conta/área dedicada e sem escritores
concorrentes. As checagens detectam várias alterações, mas não estabelecem isolamento
contra esses atores.

## Limites e proteções

- Até 10.000 arquivos, 20.000 diretórios, 512 MiB por arquivo, 2 GiB de conteúdo e 8 MiB
  de manifesto. A profundidade máxima é 32 e cada caminho relativo tem até 1.024 bytes.
  O uso como biblioteca permite reduzir esses limites, nunca ampliá-los.
- O destino existente é recusado. A criação usa um diretório novo com modo `0700`;
  o exercício usa `mkdtemp` para criar uma pasta privada aleatória. Nenhum dos comandos
  remove diretórios automaticamente.
- Todos os ancestrais existentes devem pertencer ao operador ou ao sistema (`root`).
  Diretórios com escrita para grupo/outros são recusados, salvo diretórios confiáveis
  com bit sticky, como `/tmp`. O sticky impede outro UID comum de substituir uma pasta
  criada pelo operador; não impede processos do próprio UID ou um administrador.
- Links simbólicos, links físicos, arquivos especiais, caminhos absolutos ou com
  travessia de diretórios, colisões de nomes e entradas adicionais são recusados.
- Arquivos ocultos e nomes reconhecidos de credenciais, tokens, contas de serviço e
  certificados (`.pfx`, `.p12`, `.pem`, `.key` etc.) são recusados antes da leitura do
  conteúdo. Esse filtro por nome não identifica um segredo disfarçado dentro de um
  arquivo comum. O operador deve fornecer apenas o conteúdo autorizado.
- A leitura tem limites de memória e tamanho, e verifica mudanças nos arquivos durante
  a operação. Mantenha a origem imutável e não compartilhe sua escrita com outro processo.
- Arquivos são criados com modo `0600` e diretórios com `0700`. **O kit não é
  criptografado.** Use armazenamento aprovado para o conteúdo e não confunda permissões
  locais com proteção de uma cópia externa ou garantia contra perda do disco.

O formato exige nomes portáveis, sem dois-pontos, barras invertidas, segmentos ocultos,
nomes reservados ou espaços/pontos finais. Algumas exportações podem ter nomes
incompatíveis, como um prefixo com horário contendo dois-pontos. Escolha nomes
compatíveis ao gerar a exportação autorizada. Não renomeie arquivos internos de uma
exportação do Firestore sem confirmar os requisitos do formato original.

## O que falta para comprovar recuperação operacional

O exercício local é uma etapa preparatória. A recuperação operacional deve reunir
evidências separadas para cada componente:

| Componente | Evidência ainda necessária |
| --- | --- |
| Firestore | Backup/exportação concluído, escopo, retenção e restauração em banco novo isolado; contagens e consistência dos dados restaurados. |
| Documentos privados | Cópia externa confirmada, versões, hashes e preservação das referências entre os arquivos e os registros do banco. |
| Firebase Authentication | Plano e teste próprios para recuperar identidades e validar autorização/isolamento entre empresas. |
| Código e configuração | Revisão recuperável do código, regras, índices e configuração necessária para subir um ambiente separado. |
| Certificado A1 | Plano separado de instalação/recuperação, com acesso controlado; o certificado e suas senhas não entram neste kit. |
| Operação | Registro da execução, responsável, duração, falhas e aprovação dos testes funcionais no ambiente isolado. |

Backups gerenciados do Firestore permitem restaurar em um banco novo. Uma exportação
gerenciada precisa estar concluída para ser importada. O pacote deste utilitário
preserva arquivos; não interpreta nem valida o formato de exportação do Firestore.

Durante uma futura recuperação de teste, mantenha
`ESOCIAL_TRANSMISSION_ENABLED=false` e `ASO_CLIENT_EMAIL_SEND_ENABLED=false`, com
integrações externas inativas. Antes de ativar qualquer aplicação restaurada, confirme
que ela usa apenas os recursos do ambiente isolado. Este procedimento não concede IAM,
configura provedores nem apresenta comandos de importação em produção.

RPO (perda máxima de dados) e RTO (tempo de recuperação) só podem ser registrados como
comprovados depois de medir uma restauração real e seus testes. Um CI aprovado ou um
`drill` com arquivos sintéticos não atende a esse critério.

## Testes locais

```bash
node --test scripts/recovery-kit.test.mjs
```

Em ambientes de execução que bloqueiam subprocessos do runner de testes:

```bash
node --test --test-isolation=none scripts/recovery-kit.test.mjs
```

Os testes usam dados sintéticos e pastas temporárias. Não requerem contas, banco,
credenciais, certificado A1 nem rede. Incluem integridade, recuperação isolada, recusa
de sobrescrita, manifesto adulterado, caminhos perigosos, links, arquivos extras,
limites de recursos e ausência de nomes/conteúdo nos relatórios.
As regressões de concorrência usam somente fixtures sintéticas: substituem uma pasta
depois da criação e armam uma troca no antigo ponto de limpeza, confirmando que nenhum
diretório alheio é apagado automaticamente.

## Referências oficiais

- [Exportação e importação gerenciadas do Firestore](https://firebase.google.com/docs/firestore/manage-data/export-import).
- [Backups programados e restauração em novo banco](https://firebase.google.com/docs/firestore/backups).
- [Planejamento de recuperação de desastres do Firestore](https://firebase.google.com/docs/firestore/disaster-recovery).
