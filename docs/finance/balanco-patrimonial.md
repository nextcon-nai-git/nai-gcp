# Balanço Patrimonial

O menu Financeiro inclui **Balanço 2025**, em `/financial/balanco`. A tela prioriza o exercício de 2025, permite selecionar outros documentos, compara saldos iniciais e finais e apresenta Ativo, obrigações com terceiros e Patrimônio Líquido. Os valores nunca são embutidos no código.

Use **Importar balanço** para enviar o PDF textual original do SPED, até 10 MB e 20 páginas. O extrator reconhece as colunas Descrição, Saldo Inicial e Saldo Final pela posição no PDF, preserva valores negativos e centavos, confere empresa/período e exige igualdade dos totais Ativo e Passivo. Formatos digitalizados ou diferentes são recusados; não há OCR ou inferência por IA. A extração deve ser conferida com o PDF original, disponível por botão na mesma tela.

O Passivo total do SPED inclui o Patrimônio Líquido. O indicador de obrigações deduz o PL; a tabela preserva os rótulos do documento e não soma grupos e subcontas. Estes saldos não alimentam DRE, faturamento ou fluxo de caixa.

As APIs `/api/financial/balances` e `/api/financial/balances/[id]` exigem a autenticação e autorização financeira existentes (SUPER_ADMIN ou ADMIN sem tenant). Os objetos são privados no bucket configurado, sob `financial-balances/v1/`, negado pelo fallback das Storage Rules. O PDF é servido por resposta autenticada, sem URL pública, com `Cache-Control: private, no-store`.

O SHA-256 dos bytes identifica o documento. Escritas usam geração zero e registram usuário/data. Reimportação idêntica preserva o original; PDFs diferentes permanecem como documentos separados. O JSON finaliza a importação depois do PDF. Nenhum PDF ou dado contábil real deve ser colocado no Git. Publicar a funcionalidade não importa automaticamente documentos: o upload exige sessão financeira autenticada no aplicativo.

Validação direcionada: `npx vitest run src/lib/financial/balance.test.ts src/services/financial-balance.test.ts src/app/api/financial/balances/route.test.ts`.
