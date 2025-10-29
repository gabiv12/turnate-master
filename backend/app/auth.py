# app/auth.py
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

# === Config JWT ===
SECRET_KEY = "CHANGE_ME_SECRET"  # usa env/config en prod
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hs

# === Password hashing ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False

def get_password_hash(p: str) -> str:
    return pwd_context.hash(p)

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = {"sub": subject}
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def _get_user_by_username(db: Session, username: str) -> Optional[models.Usuario]:
    return db.query(models.Usuario).filter(models.Usuario.username == username).first()

def _get_user_by_id(db: Session, user_id: int) -> Optional[models.Usuario]:
    return db.query(models.Usuario).filter(models.Usuario.id == user_id).first()

# === Router ===
router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    # username/password vía x-www-form-urlencoded
    user = _get_user_by_username(db, form_data.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    hashed = (
        getattr(user, "password_hash", None)
        or getattr(user, "hashed_password", None)
        or getattr(user, "password", None)
    )
    if not hashed or not verify_password(form_data.password, hashed):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")

    access_token = create_access_token(subject=str(user.id))
    return {"access_token": access_token, "token_type": "bearer"}

# === Dependencia para rutas protegidas ===
from fastapi import Header

def _get_auth_header(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Token inválido o faltante")
    return authorization.split(" ", 1)[1].strip()

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(_get_auth_header),
) -> models.Usuario:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=401, detail="Token inválido o expirado")
        # sub es el id del usuario
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = _get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user
