# Administração de logins por cadastro

A engrenagem à direita do nome em Prestadores e Colaboradores NXC abre a revisão
de identidade, situação do Auth, perfil e empresas autorizadas. Somente
SUPER_ADMIN visualiza e executa estas ações; a API revalida o administrador.

- Criar: exige cadastro ativo, e-mail real, senha inicial e escopo explícito.
  A conta nasce desabilitada; só é liberada depois de gravar o perfil e a auditoria.
- Permissões: prestador permanece SCOPED_PROVIDER, limitado ao subconjunto de
  empresas já vinculadas. A equipe interna usa perfis existentes. Operações
  internas tem escopo operacional geral, explicitamente descrito no formulário.
  Engenharia, RH e técnico aceitam uma empresa por login; médico/enfermagem
  admitem empresas explicitamente selecionadas. Não há editor de permissões
  arbitrárias ou promoção para ADMIN/SUPER_ADMIN por esse painel.
- Suspender: bloqueia o perfil e o Auth e revoga sessões. As regras também negam
  acesso direto a Firestore/Storage para perfis suspensos.
- Redefinir senha: gera link privado, sem enviar e-mail, sem registrar link ou
  senha na auditoria. Uma conta suspensa permanece suspensa.
- Identidade: contas preexistentes sem vínculo não são adotadas por e-mail.
  Divergências de vínculo/identidade, revisão desatualizada e operações concorrentes
  são recusadas. Alterações de vínculo de login ficam reservadas ao servidor.
- Falhas parciais: acesso permanece bloqueado; revisar Auth, perfil e auditoria.
  Conta criada no Auth antes de uma falha de gravação pode ficar desabilitada sem
  vínculo. Não há exclusão automática nem adoção dessa conta pelo cadastro.

O trabalho incorpora a implementação do PR #206 ainda não mesclado no momento
inicial, incluindo portal /expert e suas regressões. Publicar aplicação e regras
Firestore/Storage é necessário antes de provisionar contas reais.

## Evidências em produção consultadas em 27/10/2026

- Auth exibia quatro contas, nenhuma de prestador. Dois UIDs diferentes usavam
  o e-mail da Diretoria (senha e Google). Não alterar/fundir sem revisar vínculos.
- E-mail/senha, Google e telefone habilitados; anônimo desabilitado.
- Política de senha em notificação, mínimo 6 e máximo 12, sem requisitos de classes
  de caracteres. Revisar comprimento e estratégia de adoção sem bloquear usuários.
- Storage publicado ainda tinha belongsToCompany sem excluir PROVIDER; as novas
  regras restritivas do PR #206 não estavam publicadas. Não afirmar isolamento
  operacional de prestadores com base apenas no código ou CI.
- Os dois índices da fila webhook_deliveries já constavam ativados.

## Validação exigida

1. Rodar regressões de serviço, API, interface e regras em emuladores.
2. Confirmar build/CI do SHA final e publicar regras junto da aplicação.
3. Em conta sintética autorizada, testar empresa permitida e empresa alheia,
   contratos, faturamento, prontuários, documentos diretos, suspensão e revogação.
4. Registrar existência/ativação de contas reais separadamente da publicação.

Não há evidência de login real de prestador nesta tarefa e não foram enviados
convites ou redefinidos acessos administrativos existentes.
