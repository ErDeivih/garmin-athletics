import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

from app.core.config import settings

_PBKDF2_ITERATIONS = 120_000
_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 días

# Tokens revocados (logout). En memoria: válido para instancia única;
# con múltiples réplicas usar Redis/BD (pendiente Fase 11).
_REVOKED_TOKENS: set = set()


def revoke_token(token: str) -> None:
    _REVOKED_TOKENS.add(token)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, expected_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        ).hex()
        return hmac.compare_digest(digest, expected_hex)
    except (ValueError, AttributeError):
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_token(user_id: str, ttl_seconds: int = _TOKEN_TTL_SECONDS) -> str:
    payload = json.dumps({"sub": user_id, "exp": int(time.time()) + ttl_seconds}).encode("utf-8")
    payload_b64 = _b64url_encode(payload)
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{signature}"


def verify_token(token: str) -> Optional[str]:
    """Devuelve el user_id si el token es válido y no ha expirado; None en caso contrario."""
    try:
        if token in _REVOKED_TOKENS:
            return None
        payload_b64, signature = token.rsplit(".", 1)
        expected = hmac.new(
            settings.SECRET_KEY.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if float(payload["exp"]) < time.time():
            return None
        return str(payload["sub"])
    except (ValueError, KeyError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Cifrado simétrico ligero para secretos en BD (credenciales Garmin por usuario)
# Esquema: keystream HMAC-SHA256(key, nonce || contador) XOR plaintext
# ---------------------------------------------------------------------------

def _derive_key() -> bytes:
    return hashlib.sha256(b"ga-secret-box:" + settings.SECRET_KEY.encode("utf-8")).digest()


def _keystream(key: bytes, nonce: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        block = hmac.new(key, nonce + str(counter).encode(), hashlib.sha256).digest()
        out.extend(block)
        counter += 1
    return bytes(out[:length])


def encrypt_secret(plaintext: str) -> str:
    key = _derive_key()
    nonce = secrets.token_bytes(16)
    data = plaintext.encode("utf-8")
    cipher = bytes(a ^ b for a, b in zip(data, _keystream(key, nonce, len(data))))
    return "enc1$" + _b64url_encode(nonce + cipher)


def decrypt_secret(token: str) -> Optional[str]:
    try:
        scheme, payload = token.split("$", 1)
        if scheme != "enc1":
            return None
        raw = _b64url_decode(payload)
        if len(raw) < 17:
            return None
        nonce, cipher = raw[:16], raw[16:]
        key = _derive_key()
        data = bytes(a ^ b for a, b in zip(cipher, _keystream(key, nonce, len(cipher))))
        if not data:
            return None
        return data.decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None
