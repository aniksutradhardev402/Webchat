
import os
import logging
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS = os.getenv("SMTP_FROM", "noreply@webchat.aniksutradhar.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:6000")


def _verification_html(verify_url: str, username: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #0f0f14; color: #e2e2e8; margin: 0; padding: 40px 20px; }}
    .card {{ max-width: 480px; margin: 0 auto; background: #1a1a2e;
             border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 40px; }}
    h2 {{ color: #fff; margin-top: 0; }}
    p  {{ color: rgba(255,255,255,0.7); line-height: 1.6; }}
    .btn {{ display: inline-block; padding: 14px 32px; background: linear-gradient(135deg,#6366f1,#8b5cf6);
            color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600;
            font-size: 15px; margin: 20px 0; }}
    .footer {{ margin-top: 32px; font-size: 12px; color: rgba(255,255,255,0.3); }}
    .url {{ word-break: break-all; color: rgba(255,255,255,0.4); font-size: 12px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>Verify your email address</h2>
    <p>Hi <strong>{username}</strong>, welcome to WebChat!</p>
    <p>Click the button below to verify your email address and activate your account.
       This link expires in <strong>24 hours</strong>.</p>
    <a href="{verify_url}" class="btn">Verify Email Address</a>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p class="url">{verify_url}</p>
    <div class="footer">
      If you didn't create an account on WebChat, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
"""


async def send_verification_email(to_email: str, username: str, token: str) -> bool:
    """Send a verification email using Resend. Returns True on success, False on failure."""
    if not RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY is not set — skipping verification email. "
            "Set RESEND_API_KEY in your .env file to enable email sending."
        )
        # In dev with no key, log the token so you can still test
        verify_url = f"{FRONTEND_URL}/api/auth/verify?token={token}"
        logger.info(f"[DEV] Verification URL for {to_email}: {verify_url}")
        return False

    resend.api_key = RESEND_API_KEY
    verify_url = f"{FRONTEND_URL}/api/auth/verify?token={token}"

    try:
        params: resend.Emails.SendParams = {
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Verify your WebChat email address",
            "html": _verification_html(verify_url, username),
        }
        resend.Emails.send(params)
        logger.info(f"Verification email sent to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send verification email to {to_email}: {exc}")
        return False
