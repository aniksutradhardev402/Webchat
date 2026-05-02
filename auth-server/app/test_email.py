import os
import resend

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS = os.getenv("SMTP_FROM", "noreply@webchat.aniksutradhar.com")

if not RESEND_API_KEY:
    print("ERROR: RESEND_API_KEY not set")
    exit(1)

resend.api_key = RESEND_API_KEY

try:
    print(f"Attempting to send test email from {FROM_ADDRESS}...")
    params = {
        "from": FROM_ADDRESS,
        "to": ["sutradharanik12345@gmail.com"],
        "subject": "Resend Test",
        "html": "<strong>It works!</strong>"
    }
    r = resend.Emails.send(params)
    print(f"Success! Response: {r}")
except Exception as e:
    print(f"FAILED: {e}")
