# app/auth.py
import os
import bcrypt
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
JWT_EXP_MIN = int(os.getenv("JWT_EXP_MIN", "120"))

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

# ✅ Alias para compatibilidad con código viejo
def get_password_hash(plain: str) -> str:
    return hash_password(plain)

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: int) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXP_MIN)).timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_access_token(token: str) -> int:
    data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    return int(data["sub"])
