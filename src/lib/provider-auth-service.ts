"use client";

/** Contas são provisionadas pelo administrador no Firebase; o cadastro do prestador não cria credenciais compartilhadas. */
export async function createProviderAccount(
  _email: string,
  _name: string
): Promise<{
  uid: string | null;
  email: string;
  isNew: boolean;
  alreadyExists: boolean;
} | null> {
  throw new Error(
    "Cadastro salvo sem criar login. O administrador deve provisionar a conta no Firebase e orientar a recuperação de senha."
  );
}
