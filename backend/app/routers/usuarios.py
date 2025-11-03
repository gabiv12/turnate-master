from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
import hashlib, secrets

from app import models, schemas
from app.deps import get_db, get_current_user

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

# ========= Helpers / password =========
def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

_PWD_ATTRS = ("hashed_password", "password_hash", "password", "clave")

def get_pwd_value_from_user(u):
    for attr in _PWD_ATTRS:
        if hasattr(u, attr):
            return getattr(u, attr)
    return None

def set_pwd_value_to_user(u, hashed_value: str) -> None:
    for attr in _PWD_ATTRS:
        if hasattr(u, attr):
            setattr(u, attr, hashed_value)

def verify_password(plain: str, stored: str | None) -> bool:
    if stored is None:
        return False
    return stored == plain or stored == sha256(plain)  # texto plano (dev) o sha256

def _gen_codigo(n: int = 8) -> str:
    ab = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(ab) for _ in range(n))

def _ensure_unico_codigo(db: Session) -> str:
    for _ in range(20):
        cand = _gen_codigo(8)
        if not db.query(models.Emprendedor).filter(models.Emprendedor.codigo_cliente == cand).first():
            return cand
    return _gen_codigo(10)

def apply_user_updates(u: models.Usuario, data: dict) -> None:
    m = {
        "email": data.get("email"),
        "nombre": data.get("nombre"),
        "apellido": data.get("apellido"),
        "dni": data.get("dni"),
    }
    for k, v in m.items():
        if v is not None and hasattr(u, k):
            setattr(u, k, v)

# ========= Schemas in =========
class UsuarioUpdateIn(BaseModel):
    email: Optional[EmailStr] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None

    @field_validator("nombre", "apellido", "dni", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class LoginOut(BaseModel):
    token: Optional[str] = None
    user: schemas.UsuarioOut

# ========= Registro / Login / Me =========
@router.post("/registro", response_model=schemas.UsuarioOut, status_code=201)
def registro(payload: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    existe = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
    if existe:
        raise HTTPException(status_code=409, detail="Email ya registrado")

    u = models.Usuario(
        email=payload.email,
        nombre=payload.nombre,
        apellido=payload.apellido,
        dni=payload.dni,
        rol="cliente",
        is_active=True,
        created_at=datetime.utcnow() if hasattr(models.Usuario, "created_at") else None,
    )
    set_pwd_value_to_user(u, sha256(payload.password))
    db.add(u); db.commit(); db.refresh(u)
    return schemas.UsuarioOut.model_validate(u)

@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
    if not u or not verify_password(payload.password, get_pwd_value_from_user(u)):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    # CLAVE: token dev que identifica al usuario
    token = f"dev-{u.id}"
    return LoginOut(token=token, user=schemas.UsuarioOut.model_validate(u))

@router.get("/me", response_model=schemas.UsuarioOut)
def me(user: models.Usuario = Depends(get_current_user)):
    return schemas.UsuarioOut.model_validate(user)

# ========= Update perfil (por id y /me) =========
@router.put("/{usuario_id}", response_model=schemas.UsuarioOut)
@router.patch("/{usuario_id}", response_model=schemas.UsuarioOut)
def update_usuario_by_id(
    usuario_id: int,
    payload: UsuarioUpdateIn,
    user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.id != usuario_id and (getattr(user, "rol", "cliente") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")

    u = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.email and payload.email != getattr(u, "email", None):
        existe = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
        if existe and existe.id != u.id:
            raise HTTPException(status_code=409, detail="Email ya está en uso")

    apply_user_updates(u, payload.model_dump(exclude_unset=True))
    db.add(u); db.commit(); db.refresh(u)
    return schemas.UsuarioOut.model_validate(u)

@router.put("/me", response_model=schemas.UsuarioOut)
@router.patch("/me", response_model=schemas.UsuarioOut)
def update_me(
    payload: UsuarioUpdateIn,
    user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.email and payload.email != getattr(user, "email", None):
        existe = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
        if existe and existe.id != user.id:
            raise HTTPException(status_code=409, detail="Email ya está en uso")

    apply_user_updates(user, payload.model_dump(exclude_unset=True))
    db.add(user); db.commit(); db.refresh(user)
    return schemas.UsuarioOut.model_validate(user)

# ========= Password =========
@router.put("/me/password", status_code=200)
def change_password(
    payload: PasswordChangeIn,
    user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, get_pwd_value_from_user(user)):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="La nueva contraseña debe tener al menos 8 caracteres")
    set_pwd_value_to_user(user, sha256(payload.new_password))
    db.add(user); db.commit()
    return {"ok": True}

# ========= Avatar (stub) =========
@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = file.filename or "avatar.png"
    fake_url = f"https://cdn.local/avatars/{user.id}/{filename}"
    if hasattr(user, "avatar_url"):
        user.avatar_url = fake_url
        db.add(user); db.commit(); db.refresh(user)
    return {"avatar_url": fake_url}

# ========= Activar emprendedor =========
@router.put("/{usuario_id}/activar_emprendedor", response_model=schemas.ActivacionEmprendedorOut)
def activar_emprendedor(
    usuario_id: int,
    user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.id != usuario_id and (getattr(user, "rol", "cliente") or "").lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == usuario_id).first()
    if not emp:
        nombre_base = (getattr(usuario, "nombre", None) or "Mi Negocio").strip() or "Mi Negocio"
        emp = models.Emprendedor(
            usuario_id=usuario.id,
            nombre=nombre_base,
            descripcion=None,
            codigo_cliente=_ensure_unico_codigo(db),
        )
        db.add(emp); db.flush()
    else:
        if not emp.codigo_cliente:
            emp.codigo_cliente = _ensure_unico_codigo(db)

    if (getattr(usuario, "rol", "cliente") or "").lower() == "cliente":
        usuario.rol = "emprendedor"

    db.commit(); db.refresh(emp)
    out = schemas.EmprendedorOut.model_validate(emp)
    return schemas.ActivacionEmprendedorOut(token=None, emprendedor=out)
