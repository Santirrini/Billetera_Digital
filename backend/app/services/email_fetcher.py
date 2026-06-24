"""
Email Fetcher Service
Connects to Gmail via IMAP, searches for unread Bancolombia emails,
and passes them to the processing pipeline.
"""

import imaplib
import email
import re
import asyncio
from email.header import decode_header
from email.message import Message
from typing import List, Tuple
from fastapi import HTTPException

from app.config import get_settings
from app.routers.email_processing import process_email, EmailInput


def decode_str(string: str) -> str:
    """Decodes email header strings."""
    try:
        decoded_list = decode_header(string)
        result = ""
        for decoded_string, charset in decoded_list:
            if isinstance(decoded_string, bytes):
                if charset:
                    result += decoded_string.decode(charset, errors="ignore")
                else:
                    result += decoded_string.decode("utf-8", errors="ignore")
            else:
                result += decoded_string
        return result
    except Exception:
        return string


def get_email_body(msg: Message) -> str:
    """Extracts text/html or text/plain from the email message."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if "attachment" not in content_disposition:
                if content_type == "text/html":
                    return part.get_payload(decode=True).decode(errors="ignore")
                elif content_type == "text/plain":
                    return part.get_payload(decode=True).decode(errors="ignore")
    else:
        return msg.get_payload(decode=True).decode(errors="ignore")
    return ""


def fetch_bancolombia_emails_sync() -> List[dict]:
    """
    Connects to Gmail and fetches Bancolombia notification emails
    (both read and unread). Duplicates are handled by processed_emails table.
    Returns a list of dicts with subject, body, and message_id.
    Synchronous blocking function.
    """
    settings = get_settings()
    
    email_address = settings.email_address
    email_password = settings.email_password

    if not email_address or not email_password or email_address == "your_email@gmail.com":
        print("[WARN] Email credentials not configured. Skipping IMAP sync.")
        return []

    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(email_address, email_password)
        mail.select("inbox")

        from datetime import date, timedelta
        since_date = (date.today() - timedelta(days=90)).strftime("%d-%b-%Y")

        search_query = f'(SINCE {since_date} FROM "alertasynotificaciones@an.notificacionesbancolombia.com")'
        status, messages = mail.search(None, search_query)

        if not messages[0]:
            search_query_sub = f'(SINCE {since_date} SUBJECT "Alertas y Notificaciones")'
            status, messages = mail.search(None, search_query_sub)

        if status != "OK":
            return []

        email_ids = messages[0].split()
        parsed_emails = []

        for e_id in email_ids:
            res, msg_data = mail.fetch(e_id, "(RFC822)")
            if res != "OK":
                continue
                
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    subject = decode_str(msg.get("Subject", ""))
                    message_id = msg.get("Message-ID", "")
                    if not message_id:
                        message_id = f"imap_{e_id.decode()}_{hash(subject)}"

                    email_date = msg.get("Date", "")

                    body = get_email_body(msg)

                    parsed_emails.append({
                        "subject": subject,
                        "body": body,
                        "message_id": message_id,
                        "email_date": email_date,
                        "imap_id": e_id
                    })

        mail.logout()
        return parsed_emails

    except Exception as e:
        print(f"[ERROR] IMAP Sync Error: {e}")
        return []


def mark_email_as_read_sync(imap_id: bytes):
    """Marks a specific email as read using its IMAP ID."""
    settings = get_settings()
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(settings.email_address, settings.email_password)
        mail.select("inbox")
        mail.store(imap_id, '+FLAGS', '\\Seen')
        mail.logout()
    except Exception as e:
        print(f"Could not mark email as read: {e}")


async def sync_emails_task():
    """
    Background task wrapper that fetches emails and processes them
    through the FastAPI router logic asynchronously.
    """
    print("[SYNC] Corriendo sincronizacion de correos de Bancolombia...")
    
    # Run the blocking IMAP fetch in a thread pool
    emails = await asyncio.to_thread(fetch_bancolombia_emails_sync)
    
    if not emails:
        print("[INFO] No hay correos nuevos de Bancolombia.")
        return

    print(f"[INFO] Encontrados {len(emails)} correos nuevos. Procesando...")

    for mail_data in emails:
        try:
            email_input = EmailInput(
                subject=mail_data["subject"],
                body=mail_data["body"],
                message_id=mail_data["message_id"],
                email_date=mail_data.get("email_date", ""),
            )
            # Call the existing processing pipeline
            await process_email(email_input)
            
            print(f"[SUCCESS] Procesado con exito: {mail_data['subject']}")
            
            # Mark as read only if processed successfully
            await asyncio.to_thread(mark_email_as_read_sync, mail_data["imap_id"])
            
        except HTTPException as he:
            # E.g. email already processed or parsing failed
            print(f"[WARN] Error procesando (HTTP {he.status_code}): {he.detail}")
            # Mark as read so we don't keep trying to process a failed email
            await asyncio.to_thread(mark_email_as_read_sync, mail_data["imap_id"])
        except Exception as e:
            print(f"[ERROR] Error inesperado: {e}")
