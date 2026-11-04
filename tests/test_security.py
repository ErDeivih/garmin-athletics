import sys
from pathlib import Path

# Añadir backend al sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.core.security import (
    hash_password,
    verify_password,
    create_token,
    verify_token,
    encrypt_secret,
    decrypt_secret,
)


def test_password_hash_roundtrip():
    stored = hash_password("MiPasswordSegura123!")
    assert stored.startswith("pbkdf2$")
    assert "MiPasswordSegura123!" not in stored
    assert verify_password("MiPasswordSegura123!", stored)
    assert not verify_password("otra_password", stored)


def test_password_hash_unique_salts():
    a = hash_password("misma_password")
    b = hash_password("misma_password")
    assert a != b  # salts distintos


def test_verify_password_malformed():
    assert not verify_password("x", "cadena-malformada")
    assert not verify_password("x", "")


def test_token_roundtrip():
    token = create_token("usuario-abc-123")
    assert verify_token(token) == "usuario-abc-123"


def test_token_invalid_signature():
    token = create_token("usuario-abc-123")
    tampered = token[:-4] + "0000"
    assert verify_token(tampered) is None
    assert verify_token("garbage.token") is None
    assert verify_token("") is None


def test_token_expired():
    token = create_token("usuario-abc-123", ttl_seconds=-10)
    assert verify_token(token) is None


def test_secret_encryption_roundtrip():
    secret = "MiPasswordGarmin123!"
    enc = encrypt_secret(secret)
    assert enc.startswith("enc1$")
    assert secret not in enc
    assert decrypt_secret(enc) == secret
    # Dos cifrados del mismo texto difieren (nonce aleatorio) pero ambos descifran
    enc2 = encrypt_secret(secret)
    assert enc != enc2
    assert decrypt_secret(enc2) == secret


def test_secret_decryption_invalid():
    assert decrypt_secret("enc1$garbage!!") is None
    assert decrypt_secret("formato-malo") is None


if __name__ == "__main__":
    test_password_hash_roundtrip()
    test_password_hash_unique_salts()
    test_verify_password_malformed()
    test_token_roundtrip()
    test_token_invalid_signature()
    test_token_expired()
    test_secret_encryption_roundtrip()
    test_secret_decryption_invalid()
    print("SUCCESS: Todas las pruebas de seguridad (hash + tokens + cifrado) han pasado correctamente.")
