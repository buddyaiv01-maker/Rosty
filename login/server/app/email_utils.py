import smtplib
from email.message import EmailMessage

from .config import settings


def _send(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_user}>"
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_app_password)
        server.send_message(msg)


def send_otp_email(to_email: str, code: str, purpose: str) -> None:
    if purpose == "verify_email":
        subject = "Verify your Rosty account"
        heading = "Confirm your email"
        blurb = "Enter this code to verify your account and finish signing up."
    else:
        subject = "Reset your Rosty password"
        heading = "Reset your password"
        blurb = "Enter this code to reset your password."

    text_body = f"{heading}\n\n{blurb}\n\nYour code: {code}\n\nThis code expires in {settings.otp_expire_minutes} minutes. If you didn't request this, you can ignore this email."

    html_body = f"""
    <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0b0d14; color: #f5f6fa; border-radius: 16px;">
      <h2 style="margin: 0 0 8px; color: #f5f6fa;">{heading}</h2>
      <p style="color: rgba(245,246,250,0.7); margin: 0 0 24px;">{blurb}</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 20px; background: rgba(255,255,255,0.06); border-radius: 12px; color: #4fadfe;">
        {code}
      </div>
      <p style="color: rgba(245,246,250,0.5); font-size: 12px; margin-top: 24px;">
        This code expires in {settings.otp_expire_minutes} minutes. If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    """

    _send(to_email, subject, text_body, html_body)
