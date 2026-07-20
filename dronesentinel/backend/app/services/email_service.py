import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from threading import Thread


class EmailService:
    def __init__(self, config: dict):
        self.config = config

    def _send(self, subject: str, message: str, attachment_paths: list = None):
        if not self.config.get("enable_email", False):
            return False, "Email disabled"
        try:
            msg = MIMEMultipart()
            msg["From"]    = self.config.get("email_sender", "")
            msg["To"]      = self.config.get("email_recipients", "")
            msg["Subject"] = subject
            msg.attach(MIMEText(message, "plain"))

            for path in (attachment_paths or []):
                if os.path.exists(path):
                    with open(path, "rb") as f:
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename={os.path.basename(path)}"
                    )
                    msg.attach(part)

            with smtplib.SMTP(
                self.config.get("smtp_server", "smtp.gmail.com"),
                int(self.config.get("smtp_port", 587))
            ) as server:
                server.starttls()
                server.login(
                    self.config.get("email_sender", ""),
                    self.config.get("email_password", "")
                )
                server.send_message(msg)
            return True, "Email sent"
        except Exception as e:
            return False, f"Email failed: {str(e)}"

    def _send_html(self, subject: str, html_body: str):
        """Send an email with an HTML body (renders inline in the client)."""
        if not self.config.get("enable_email", False):
            return False, "Email disabled"
        try:
            msg = MIMEMultipart("alternative")
            msg["From"]    = self.config.get("email_sender", "")
            msg["To"]      = self.config.get("email_recipients", "")
            msg["Subject"] = subject
            # Plain-text fallback for clients that don't render HTML
            plain = (
                "Your email client does not support HTML. "
                "Please open the tracking_summary.html file saved in the session folder."
            )
            msg.attach(MIMEText(plain, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(
                self.config.get("smtp_server", "smtp.gmail.com"),
                int(self.config.get("smtp_port", 587))
            ) as server:
                server.starttls()
                server.login(
                    self.config.get("email_sender", ""),
                    self.config.get("email_password", "")
                )
                server.send_message(msg)
            return True, "Email sent"
        except Exception as e:
            return False, f"Email failed: {str(e)}"

    def send_async(self, subject: str, message: str, attachment_paths: list = None):
        """Fire-and-forget plain-text email."""
        Thread(
            target=self._send,
            args=(subject, message, attachment_paths),
            daemon=True
        ).start()

    def send_html_async(self, subject: str, html_body: str):
        """Fire-and-forget HTML email (report rendered directly in email body)."""
        Thread(
            target=self._send_html,
            args=(subject, html_body),
            daemon=True
        ).start()

    def test_connection(self) -> tuple[bool, str]:
        try:
            with smtplib.SMTP(
                self.config.get("smtp_server", "smtp.gmail.com"),
                int(self.config.get("smtp_port", 587))
            ) as server:
                server.starttls()
                server.login(
                    self.config.get("email_sender", ""),
                    self.config.get("email_password", "")
                )
            return True, "Connection successful"
        except Exception as e:
            return False, str(e)
