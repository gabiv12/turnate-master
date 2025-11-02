# app/security.py
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict

from jose import jwt, JWTError            # pip install "python-jose[cryptography]"
from passlib.context import CryptContext   # pip install passlib[bcrypt]

# ===== Config =====
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h por defecto

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ===== Password helpers =====
def get_password_hash(password: str) -> str:
    return _pwd_ctx.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _pwd_ctx.verify(plain_password, hashed_password)
    except Exception:
        return False

# ===== JWT helpers =====
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    data debe incluir 'sub' con el ID de usuario (string). Ej: {"sub": "123"}.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Devuelve el payload decodificado (debe tener 'sub').
    Lanza JWTError si el token no es válido/expirado.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload
