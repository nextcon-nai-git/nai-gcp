# eSocial S-1.3 — pacote implantado em 26/10/2026

Estes oito XSDs são cópias integrais, sem alterações, do pacote oficial vigente em
01/11/2026. A origem, SHA-256 do ZIP e SHA-256/tamanho de cada arquivo estão em
`provenance.json`. O pacote futuro de dezembro de 2026 não é usado.

Fonte: https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/2026-10-26_esquemas_xsd_v_s_01_03_00-1-1.zip/

As tabelas oficiais utilizadas pelos formulários estão em
`src/lib/esocial-official-tables.json`. Foram extraídas das tabelas 01, 06, 13, 14,
15, 17, 18, 20, 24 e 27 do leiaute NT 07/2026, revisão de 20/10/2026. O HTML oficial
inclui linhas com vigência futura: o seletor filtra a data e exclui os motivos de
afastamento 46–53, pertencentes ao pacote ainda não implantado em outubro.
A origem, hash e quantidade de linhas extraídas constam da mesma proveniência.

## Validação no NAI

`src/services/esocial/events.ts` usa libxml2-wasm/XSD real. Carrega somente estes
arquivos, verifica seus hashes e oferece os dois includes/imports por buffers
virtuais de nomes fixos. Não registra leitor genérico de arquivos ou de rede.
DTD/declarações de entidades, instruções de processamento, XInclude e referências
externas de esquema são recusados antes do parse. Há limites de bytes, elementos,
profundidade, atributos e unicidade do evento.

O XSD oficial exige `ds:Signature`. Para validar **rascunhos sem assinatura**, o
validador usa uma cópia em memória em que somente esse elemento fica opcional.
Os arquivos oficiais permanecem intactos. XML com assinatura usa o XSD original.
O resultado distingue `signed: false/true`; esse campo indica presença estrutural,
não autenticidade da assinatura. A verificação criptográfica pertence ao assinador.

Validação XSD não consulta o RET, a RFB, conselhos profissionais, a procuração,
validação clínica, prazos ou aceite do governo. O resultado permanece
`businessValidation: "NOT_EVALUATED"` e não fornece recibo/protocolo presumido.
Originais, retificações e exclusões dependem dos controles de identidade e de
revisão da mensageria. A exclusão suportada aqui se limita aos cinco eventos de
trabalhador gerados por este módulo.

Os testes usam somente identidades/documentos sintéticos. Nenhum teste transmite
evento, carrega certificado real ou envia mensagem a pessoas.
