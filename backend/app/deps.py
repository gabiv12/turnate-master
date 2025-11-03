from __future__ import annotations
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Callable, List, Optional

from app.database import SessionLocal
from app import models

# ===== DB =====
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ===== Auth DEV: "dev-<user_id>" =====
def _parse_dev_token(authorization: Optional[str]) -> int:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta Authorization")
    tok = authorization.split(" ", 1)[1].strip()
    if not tok.startswith("dev-"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido (esperado dev-*)")
    try:
        uid = int(tok.split("dev-", 1)[1])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token dev inválido")
    return uid

def get_current_user(authorization: Optional[str] = Header(default=None),
                     db: Session = Depends(get_db)) -> models.Usuario:
    uid = _parse_dev_token(authorization)
    u = db.query(models.Usuario).filter(models.Usuario.id == uid, models.Usuario.is_active == True).first()  # noqa: E712
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")
    return u

def require_roles(roles: List[str]) -> Callable[..., models.Usuario]:
    roles_norm = {r.lower() for r in roles}
    def _dep(user: models.Usuario = Depends(get_current_user)) -> models.Usuario:
        rol = (getattr(user, "rol", "") or "").lower()
        if rol not in roles_norm:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autorizado")
        return user
    return _dep
