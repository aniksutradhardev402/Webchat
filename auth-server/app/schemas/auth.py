import re
from pydantic import BaseModel, EmailStr, field_validator

PASSWORD_PATTERN = re.compile(
    r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\':\"\\\|,.<>\/?]).{8,}$'
)

# Usernames that are reserved and cannot be registered
RESERVED_USERNAMES = {
    "admin", "administrator", "root", "system", "support",
    "moderator", "mod", "staff", "superuser", "null", "undefined",
    "api", "ws", "chat", "auth", "login", "logout", "register",
    "me", "user", "users", "bot", "guest", "anonymous",
}

# Email domains that only work via OAuth — block password registration
GOOGLE_DOMAINS = {"gmail.com", "googlemail.com"}

# Known disposable / temporary email providers — block these at registration
DISPOSABLE_DOMAINS = {
    # Mailinator family
    "mailinator.com", "trashmail.com", "trashmail.net", "trashmail.io",
    "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.info",
    "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.me",
    "spam4.me", "yopmail.com", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
    "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
    "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
    # Temp-mail family
    "temp-mail.org", "tempmail.com", "tempmail.net", "tempmail.de",
    "temp-mail.de", "tempr.email", "discard.email", "crap.wtf",
    "fakemail.net", "throwam.com", "throwaway.email", "maildrop.cc",
    "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
    # 10 minute mail
    "10minutemail.com", "10minutemail.net", "10minutemail.de",
    "10minutemail.org", "10minutemail.co.uk", "10minemail.com",
    "minutemailbox.com", "dispostable.com", "fakeinbox.com",
    # Throw-away / burner
    "burnermail.io", "throwam.com", "throwam.net", "mailnull.com",
    "mailnull.net", "spamevader.com", "armyspy.com", "cuvox.de",
    "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com",
    "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
    "mohmal.com", "mailtemp.info", "mailet.io", "inboxalias.com",
    # Other popular disposable services
    "mailnesia.com", "mailnull.com", "spamfree24.org", "spam.la",
    "spamhere.net", "spamhereplease.com", "spaml.com", "spaml.de",
    "spamoff.de", "spamspot.com", "spamthis.co.uk", "spamtroll.net",
    "trashdevil.com", "trashdevil.de", "trashemail.de", "trash-mail.at",
    "trash-mail.com", "trash-mail.de", "trash-mail.io", "trash-mail.net",
    "trash-me.com", "trashmail.at", "trashmail.io", "trashmail.me",
    "trashmail.org", "trashmailer.com", "trashmail.xyz",
    "wegwerfemail.de", "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
    "yepmail.net", "yourspam.eu", "zehnminutenmail.de",
    # Fake-sounding TLD tricks
    "fake.com", "fakeemail.com", "notreal.com", "noemail.com",
    "no-email.com", "noemailaddress.com", "test.com", "example.com",
    "example.org", "example.net", "invalid.com",
}


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        v = v.strip().lower()
        domain = v.split("@")[-1]

        # Block Gmail — must use "Continue with Google"
        if domain in GOOGLE_DOMAINS:
            raise ValueError(
                "Google accounts must sign in with 'Continue with Google'. "
                "Password registration is not available for Gmail addresses."
            )

        # Block disposable / temporary email providers
        if domain in DISPOSABLE_DOMAINS:
            raise ValueError(
                "Disposable or temporary email addresses are not allowed. "
                "Please use your real email address to register."
            )

        # Basic TLD sanity check (at least one dot, TLD ≥ 2 chars)
        parts = domain.split(".")
        if len(parts) < 2 or len(parts[-1]) < 2:
            raise ValueError("Please enter a valid email address.")

        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not PASSWORD_PATTERN.match(v):
            raise ValueError(
                "Password must be at least 8 characters and include "
                "at least one uppercase letter, one digit, and one special character."
            )
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters.")
        if len(v) > 30:
            raise ValueError("Username must be 30 characters or fewer.")
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError("Username may only contain letters, numbers, and underscores.")
        if v.startswith('_') or v.endswith('_'):
            raise ValueError("Username cannot start or end with an underscore.")
        if '__' in v:
            raise ValueError("Username cannot contain consecutive underscores.")
        if v.lower() in RESERVED_USERNAMES:
            raise ValueError(f"'{v}' is a reserved username. Please choose another.")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True
