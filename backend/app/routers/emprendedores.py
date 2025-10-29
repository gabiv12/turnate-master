# app/routers/emprendedores.py
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user
from app.schemas import EmprendedorOut, EmprendedorUpdate
from app.config import UPLOADS_DIR

router = APIRouter(prefix="/emprendedores", tags=["emprendedores"])

def _ensure_emp_for_user(db: Session, user: models.Usuario) -> models.Emprendedor:
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.user_id == user.id).first()
    if not emp and hasattr(models.Emprendedor, "usuario_id"):
        emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == user.id).first()

    if not emp:
        # Crear básico si no existe (compat con tu flujo)
        emp = models.Emprendedor(
            user_id=getattr(user, "id"),  # si tu modelo usa usuario_id, el flush lo mapea
            nombre=user.username,
        )
        # mapear también usuario_id si existe la columna
        if hasattr(models.Emprendedor, "usuario_id"):
            emp.usuario_id = user.id
        db.add(emp)
        db.commit()
        db.refresh(emp)
    return emp

def _to_out(emp: models.Emprendedor) -> EmprendedorOut:
    # rellenar alias de compat
    data = EmprendedorOut.model_validate(emp)
    if data.usuario_id is None:
        data.usuario_id = data.user_id
    return data

@router.get("/mi", response_model=EmprendedorOut)
def get_mi(
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _ensure_emp_for_user(db, user)
    return _to_out(emp)

@router.put("/mi", response_model=EmprendedorOut)
def put_mi(
    payload: EmprendedorUpdate,
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _ensure_emp_for_user(db, user)

    for field in ["nombre", "telefono_contacto", "direccion", "rubro", "descripcion", "redes", "logo_url"]:
        val = getattr(payload, field, None)
        if val is not None:
            setattr(emp, field, val.strip() if isinstance(val, str) else val)

    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _to_out(emp)

@router.post("/mi/logo", response_model=EmprendedorOut)
async def upload_logo_mi(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.Usuario = Depends(get_current_user),
):
    emp = _ensure_emp_for_user(db, user)

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower() or ".png"
    fname = f"{uuid4().hex}{ext}"
    dest = UPLOADS_DIR / fname

    content = await file.read()
    dest.write_bytes(content)

    # url servida por StaticFiles en /uploads
    emp.logo_url = f"/uploads/{fname}"
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return _to_out(emp)
