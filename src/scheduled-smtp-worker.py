"""Private child. stdin receives one JSON envelope; stdout is status only."""
import json
import os
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.policy import SMTP


def run():
    state = "not-dispatched"
    connection = None
    try:
        request = json.loads(sys.stdin.buffer.read(800001))
        key = request["idempotencyKey"]
        if not re.fullmatch(r"[0-9a-f]{64}", key):
            return state
        host, port = os.environ["SMTP_HOST"], int(os.environ["SMTP_PORT"])
        sender = os.environ["SMTP_FROM"]
        context = ssl.create_default_context(cafile=os.environ.get("SMTP_TEST_CA"))
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        resend = os.environ.get("SMTP_PROFILE") == "resend-smtp"
        # Keep the vendor's opaque key on one ASCII header line (SMTP's
        # absolute line-length bound is 998 bytes before CRLF).
        text = EmailMessage(policy=SMTP.clone(max_line_length=998) if resend else SMTP)
        text["From"], text["To"], text["Subject"] = sender, request["to"], request["subject"]
        text["Message-ID"] = f"<{key}@{sender.rsplit('@', 1)[1]}>"
        if resend:
            if host != "smtp.resend.com":
                return state
            text["Resend-Idempotency-Key"] = key
        text.set_content(request["text"], charset="utf-8")
        if os.environ["SMTP_TLS"] == "implicit":
            connection = smtplib.SMTP_SSL(host, port, timeout=8, context=context)
        else:
            connection = smtplib.SMTP(host, port, timeout=8)
            connection.ehlo()
            connection.starttls(context=context)
        connection.ehlo()
        connection.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
        # Establish the single authorized envelope before DATA. A lost
        # response or refusal here cannot have transmitted the report body.
        if connection.mail(sender)[0] != 250:
            return state
        if connection.rcpt(request["to"])[0] not in (250, 251):
            return state
        # Once DATA starts, any exception or process loss is ambiguous.
        state = "unknown"
        if connection.data(text.as_bytes())[0] == 250:
            state = "accepted"
    except Exception:
        pass
    finally:
        if connection is not None:
            try:
                connection.close()
            except OSError:
                pass
    return state


if __name__ == "__main__":
    print(run())
