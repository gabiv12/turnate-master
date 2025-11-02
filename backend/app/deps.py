# app/deps.py
from __future__ import annotations

from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Usuario
from .auth import decode_access_token


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_by_dev_token(db: Session) -> Usuario | None:
    """
    Modo DEV: si el token empieza con 'dev-', devolvemos el último usuario activo.
    Esto replica la lógica que ya usás en /usuarios/me para los dev-tokens.
    """
    return (
        db.query(Usuario)
        .filter(Usuario.is_active == True)  # noqa: E712
        .order_by(Usuario.id.desc())
        .first()
    )


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Solución definitiva y compatible:
    - Si el token es 'dev-*' => modo desarrollo (igual que /usuarios/me).
    - Si no, intentamos JWT real con decode_access_token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token")

    token = authorization.split()[1].strip()

    # === MODO DESARROLLO: acepta 'dev-*' (lo mismo que /usuarios/me) ===
    if token.startswith("dev-"):
        user = _get_user_by_dev_token(db)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")
        return user

    # === JWT REAL ===
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = (
        db.query(Usuario)
        .filter(Usuario.id == user_id, Usuario.is_active == True)  # noqa: E712
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user
