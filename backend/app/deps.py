from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from .models import SessionLocal, Usuario
from .auth import decode_access_token

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Usuario:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token")
    token = authorization.split()[1]
    try:
        user_id = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no activo")
    return user
