# app/routers/usuarios.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.auth import get_current_user, verify_password, get_password_hash

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.get("/me")
def get_me(db: Session = Depends(get_db), user: models.Usuario = Depends(get_current_user)):
    # devolvés solo los campos públicos
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "nombre": getattr(user, "nombre", None),
        "apellido": getattr(user, "apellido", None),
        "dni": getattr(user, "dni", None),
        "avatar_url": getattr(user, "avatar_url", None),
    }

@router.put("/me")
def update_me(payload: dict, db: Session = Depends(get_db), user: models.Usuario = Depends(get_current_user)):
    # Campos permitidos
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()

    if not username or not email:
        raise HTTPException(status_code=422, detail="Usuario y email son obligatorios.")

    # Únicos si aplica en tu modelo
    exists_u = db.query(models.Usuario).filter(models.Usuario.username == username, models.Usuario.id != user.id).first()
    if exists_u:
        raise HTTPException(status_code=400, detail="Ese usuario ya está en uso.")
    exists_e = db.query(models.Usuario).filter(models.Usuario.email == email, models.Usuario.id != user.id).first()
    if exists_e:
        raise HTTPException(status_code=400, detail="Ese correo ya está en uso.")

    user.username  = username
    user.email     = email
    # ✅ ahora sí persiste estos campos
    user.nombre    = (payload.get("nombre") or None)
    user.apellido  = (payload.get("apellido") or None)
    user.dni       = (payload.get("dni") or None)

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "nombre": user.nombre,
        "apellido": user.apellido,
        "dni": user.dni,
        "avatar_url": getattr(user, "avatar_url", None),
    }

@router.put("/me/password")
def change_password(body: dict, db: Session = Depends(get_db), user: models.Usuario = Depends(get_current_user)):
    old_password = body.get("old_password")
    new_password = body.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=422, detail="Faltan datos de contraseña.")
    if len(new_password) < 8:
        raise HTTPException(status_code=422, detail="La nueva contraseña debe tener al menos 8 caracteres.")

    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")

    user.password_hash = get_password_hash(new_password)
    db.add(user)
    db.commit()
    return {"ok": True}
