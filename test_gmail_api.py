#!/usr/bin/env python3
"""Teste manual de autenticação Gmail com delegação de domínio do Workspace."""

import argparse
import os
from pathlib import Path
import sys

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def testar_conexao_gmail(arquivo: str, usuario: str) -> int:
    if not arquivo or not Path(arquivo).is_file():
        print("Defina GMAIL_SERVICE_ACCOUNT_FILE com o caminho da chave fora do repositório.", file=sys.stderr)
        return 2
    if not usuario or "@" not in usuario:
        print("Defina GMAIL_DELEGATED_USER com o usuário do Google Workspace.", file=sys.stderr)
        return 2

    try:
        from google.auth.exceptions import GoogleAuthError
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError:
        print("Instale as dependências: python -m pip install -r requirements-gmail.txt", file=sys.stderr)
        return 2

    try:
        creds = service_account.Credentials.from_service_account_file(arquivo, scopes=SCOPES)
        delegated_creds = creds.with_subject(usuario)
        with build("gmail", "v1", credentials=delegated_creds, cache_discovery=False) as service:
            messages = service.users().messages()
            result = messages.list(userId="me", maxResults=5, labelIds=["INBOX"]).execute(num_retries=2)
            subjects = []
            for message in result.get("messages", []):
                data = messages.get(
                    userId="me", id=message["id"], format="metadata", metadataHeaders=["Subject"]
                ).execute(num_retries=2)
                headers = data.get("payload", {}).get("headers", [])
                subject = next(
                    (h.get("value", "") for h in headers if h.get("name", "").casefold() == "subject"),
                    "(sem assunto)",
                )
                # Assuntos são dados externos: remova controles antes de imprimir no terminal.
                subjects.append("".join(c for c in subject if c.isprintable()) or "(sem assunto)")

        print(f"Conexão OK. {len(subjects)} e-mail(s) encontrado(s) na caixa de entrada.")
        for subject in subjects:
            print(f"- {subject}")
        return 0
    except HttpError as error:
        print(
            f"Gmail recusou a chamada (HTTP {error.resp.status}). Confira API habilitada, usuário e escopos autorizados no Workspace.",
            file=sys.stderr,
        )
    except GoogleAuthError:
        print("Falha de autenticação. Confira a chave e a delegação de domínio autorizada pelo administrador.", file=sys.stderr)
    except (OSError, ValueError):
        print("Não foi possível carregar a chave ou acessar o serviço. Confira o arquivo e a conectividade.", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--credentials",
        default=os.environ.get("GMAIL_SERVICE_ACCOUNT_FILE") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", ""),
        help="Caminho da chave JSON fora do repositório; padrão: GMAIL_SERVICE_ACCOUNT_FILE.",
    )
    parser.add_argument(
        "--subject",
        default=os.environ.get("GMAIL_DELEGATED_USER", "atendimento.grupoavp@nextconsaude.com.br"),
        help="Usuário do Workspace em nome de quem a Service Account acessa o Gmail.",
    )
    args = parser.parse_args()
    return testar_conexao_gmail(args.credentials, args.subject)


if __name__ == "__main__":
    sys.exit(main())
