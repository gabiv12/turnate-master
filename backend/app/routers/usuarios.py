# app/routers/usuarios.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional
import hashlib, secrets

from app import models, schemas
from app.deps import get_db  # ⬅️ Mantenemos tu get_db tal cual

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

# ---------- helpers ----------
def sha256(s: str) -> str:
    import hashlib
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

# ahora incluye 'hashed_password'
_PWD_ATTRS = ("hashed_password", "password_hash", "password", "clave")

def get_pwd_value_from_user(u):
    """Devuelve el valor de contraseña almacenada en el primer campo existente."""
    for attr in _PWD_ATTRS:
        if hasattr(u, attr):
            return getattr(u, attr)
    return None

def set_pwd_value_to_user(u, hashed_value: str) -> None:
    """Escribe el hash en todos los campos de password que existan en el modelo."""
    for attr in _PWD_ATTRS:
        if hasattr(u, attr):
            setattr(u, attr, hashed_value)

def verify_password(plain: str, stored: str | None) -> bool:
    if stored is None:
        return False
    return stored == plain or stored == sha256(plain)

def generar_codigo_cliente(longitud: int = 8) -> str:
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(longitud))

def ensure_unico_codigo(db: Session) -> str:
    for _ in range(10):
        cand = generar_codigo_cliente(8)
        if not db.query(models.Emprendedor).filter(models.Emprendedor.codigo_cliente == cand).first():
            return cand
    return generar_codigo_cliente(10)

# ---------- Schemas login ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class LoginOut(BaseModel):
    token: Optional[str] = None
    user: schemas.UsuarioOut

# ---------- Registro ----------
@router.post("/registro", response_model=schemas.UsuarioOut, status_code=201)
def registro(payload: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    # email único
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
    )

    # guardamos password en el/los campo(s) que existan
    set_pwd_value_to_user(u, sha256(payload.password))

    db.add(u)
    db.commit()
    db.refresh(u)
    return schemas.UsuarioOut.model_validate(u)

# ---------- Login ----------
@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
    if not u:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    stored = get_pwd_value_from_user(u)
    if not verify_password(payload.password, stored):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    # Token simple (dev). Si usás JWT real, generalo acá y devuélvelo en 'token'
    token = "dev-" + sha256(u.email)[:24]
    return LoginOut(token=token, user=schemas.UsuarioOut.model_validate(u))

# ---------- Me ----------
@router.get("/me", response_model=schemas.UsuarioOut)
def me(authorization: Optional[str] = Header(default=None),
       db: Session = Depends(get_db)) -> schemas.UsuarioOut:
    # DEV: si no hay JWT, devolvemos el último usuario activo para simplificar
    if not authorization:
        raise HTTPException(status_code=401, detail="Falta Authorization")
    tok = authorization.replace("Bearer ", "").strip()
    if not tok.startswith("dev-"):
        raise HTTPException(status_code=401, detail="Token inválido")

    u = db.query(models.Usuario).order_by(models.Usuario.id.desc()).first()
    if not u:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    return schemas.UsuarioOut.model_validate(u)

# ---------- Activar emprendedor ----------
# ✅ Solución definitiva: valida Authorization EXACTO igual que /me (acepta dev-*)
@router.put("/{usuario_id}/activar_emprendedor", response_model=schemas.ActivacionEmprendedorOut)
def activar_emprendedor(
    usuario_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    # === misma validación que /usuarios/me ===
    if not authorization:
        raise HTTPException(status_code=401, detail="Falta Authorization")
    tok = authorization.replace("Bearer ", "").strip()
    if not tok.startswith("dev-"):
        raise HTTPException(status_code=401, detail="Token inválido")

    # Usuario "actual" (modo dev: último usuario)
    current = db.query(models.Usuario).order_by(models.Usuario.id.desc()).first()
    if not current:
        raise HTTPException(status_code=401, detail="Sesión inválida")

    # Autorización: el mismo usuario o admin
    if current.id != usuario_id and getattr(current, "rol", "cliente") not in ("admin",):
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
            codigo_cliente=ensure_unico_codigo(db),
        )
        db.add(emp); db.flush()
    else:
        if not emp.codigo_cliente:
            emp.codigo_cliente = ensure_unico_codigo(db)

    if getattr(usuario, "rol", "cliente") == "cliente":
        usuario.rol = "emprendedor"

    db.commit(); db.refresh(emp)
    out = schemas.EmprendedorOut.model_validate({
        "id": emp.id,
        "nombre": emp.nombre,
        "descripcion": emp.descripcion,
        "codigo_cliente": emp.codigo_cliente,
        "owner_user_id": emp.usuario_id,
        "created_at": emp.created_at,
        # extra opcionales si existen
        "cuit": getattr(emp, "cuit", None),
        "telefono": getattr(emp, "telefono", None),
        "direccion": getattr(emp, "direccion", None),
        "rubro": getattr(emp, "rubro", None),
        "redes": getattr(emp, "redes", None),
        "web": getattr(emp, "web", None),
        "email_contacto": getattr(emp, "email_contacto", None),
        "logo_url": getattr(emp, "logo_url", None),
    })
    return schemas.ActivacionEmprendedorOut(token=None, emprendedor=out)
