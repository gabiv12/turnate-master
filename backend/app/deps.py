# app/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import secrets, string
from datetime import datetime

from app.database import get_db
from app.security import decode_access_token
from app import models

# Tu login real es /auth/login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.Usuario:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    # Compatibilidad: tokens viejos (sub=username) y nuevos (sub=id)
    user = None
    try:
        uid = int(sub)
        user = db.get(models.Usuario, uid)
    except (TypeError, ValueError):
        user = db.query(models.Usuario).filter(models.Usuario.username == sub).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    return user

def _gen_codigo(n=8) -> str:
    ab = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(ab) for _ in range(n))

def get_current_emprendedor(
    user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.Emprendedor:
    """
    Devuelve el Emprendedor del usuario autenticado.
    Si no existe, lo CREA (ensure) con datos mínimos válidos.
    """
    Emp = models.Emprendedor
    emp = db.query(Emp).filter(Emp.user_id == user.id).first()
    if emp:
        return emp

    # Crear mínimo viable respetando restricciones (user_id, codigo_cliente, nombre, etc.)
    codigo = _gen_codigo()
    tries = 0
    while db.query(Emp).filter(Emp.codigo_cliente == codigo).first() and tries < 3:
        codigo = _gen_codigo(); tries += 1

    emp = Emp(
        user_id=user.id,
        nombre=getattr(user, "username", "Mi Emprendimiento"),
        codigo_cliente=codigo,
        created_at=datetime.utcnow() if hasattr(Emp, "created_at") else None,
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp
