# app/routers/usuarios.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status, Header, UploadFile, File, Request
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session
from typing import Optional
import secrets, hashlib
from datetime import datetime

from app import models, schemas
from app.deps import get_db

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

# =============== Helpers ===============
def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

# Lista ampliada de posibles nombres de columna para contraseñas
_PWD_ATTRS = ("hashed_password", "password_hash", "password", "clave", "contrasena", "passhash")

def _detect_pwd_field(u) -> Optional[str]:
    for attr in _PWD_ATTRS:
        if hasattr(u, attr):
            return attr
    return None

def get_pwd_value_from_user(u):
    attr = _detect_pwd_field(u)
    return getattr(u, attr) if attr else None

def set_pwd_value_to_user(u, hashed_value: str) -> None:
    attr = _detect_pwd_field(u)
    if not attr:
        # No se encontró un campo real en el modelo -> fallo explícito
        raise HTTPException(
            status_code=500,
            detail="No se encontró un campo de contraseña en models.Usuario. "
                   "Agrega una columna como 'hashed_password' o 'password_hash'."
        )
    setattr(u, attr, hashed_value)

def verify_password(plain: str, stored: str | None) -> bool:
    """
    Acepta:
      - Igual en texto plano (dev)
      - sha256(plain)
      - bcrypt ($2a/$2b...) si passlib+bcrypt están disponibles
    """
    if not stored:
        return False
    if stored == plain:
        return True
    if stored == sha256(plain):
        return True
    if isinstance(stored, str) and stored.startswith("$2"):
        try:
            from passlib.hash import bcrypt as bc
            return bc.verify(plain, stored)
        except Exception:
            return False
    return False

def generar_codigo_cliente(longitud: int = 8) -> str:
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    # elección segura sin sesgo, evita caracteres ambiguos
    return "".join(secrets.choice(alfabeto) for _ in range(longitud))

def ensure_unico_codigo(db: Session) -> str:
    for _ in range(10):
        cand = generar_codigo_cliente(8)
        exists = db.query(models.Emprendedor)\
                   .filter(models.Emprendedor.codigo_cliente == cand)\
                   .first()
        if not exists:
            return cand
    return generar_codigo_cliente(10)

def require_dev_auth(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Falta Authorization")
    s = authorization.strip()
    # Acepta "Bearer <tok>", "bearer <tok>", o directamente el token
    if s.lower().startswith("bearer "):
        tok = s.split(None, 1)[1].strip()
    else:
        tok = s
    if not tok.startswith("dev-"):
        raise HTTPException(status_code=401, detail="Token inválido")
    return tok


def _email_fingerprint(email: str) -> str:
    return sha256(email or "")[:24]

def _safe_email_for_output(email: Optional[str]) -> str:
    """
    DEV: si el dominio no tiene '.', agregamos '.local' para pasar EmailStr de schemas.
    No persiste nada en DB, sólo para serializar la respuesta.
    """
    s = (email or "").strip()
    if "@" not in s:
        return s or "user@local.local"
    local, _, domain = s.partition("@")
    if "." not in domain:
        return f"{local}@{domain}.local"
    return s

def get_current_user(db: Session, authorization: Optional[str]):
    tok = require_dev_auth(authorization)
    suffix = tok[4:]  # después de 'dev-'
    if not suffix:
        raise HTTPException(status_code=401, detail="Sesión inválida")

    for u in db.query(models.Usuario).all():
        if _email_fingerprint(getattr(u, "email", "") or "") == suffix:
            return u
    raise HTTPException(status_code=401, detail="Sesión inválida")

def apply_user_updates(u: models.Usuario, data: dict) -> None:
    for k in ("email", "nombre", "apellido", "dni"):
        v = data.get(k, None)
        if v is not None and hasattr(u, k):
            setattr(u, k, v)

def looks_like_email(s: str) -> bool:
    if not s or not isinstance(s, str): return False
    s = s.strip()
    return "@" in s and " " not in s

async def extract_email_password(request: Request) -> tuple[str, str]:
    """
    Acepta application/json o form (urlencoded/multipart).
    Fields tolerados: email/usuario/username/user y password/clave/pass.
    """
    ct = (request.headers.get("content-type") or "").lower()
    data = {}
    if "application/json" in ct:
        try:
            data = await request.json()
        except Exception:
            data = {}
    else:
        try:
            form = await request.form()
            data = dict(form)
        except Exception:
            data = {}

    email = (data.get("email")
             or data.get("usuario")
             or data.get("username")
             or data.get("user")
             or "").strip().lower()

    password = (data.get("password")
                or data.get("clave")
                or data.get("pass")
                or "").strip()

    if not email or not password:
        raise HTTPException(status_code=422, detail="Se requieren 'email' y 'password'")
    if not looks_like_email(email):
        # Permitimos admin@admin en dev
        pass
    return email, password

# =============== Schemas (in/out mínimos) ===============
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

# =============== Registro / Login / Me ===============
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

    # 🔐 Guarda el hash en un campo REAL del modelo, o falla explícito si no existe
    set_pwd_value_to_user(u, sha256(payload.password))

    db.add(u)
    db.commit()
    db.refresh(u)

    u_out = {**u.__dict__}
    u_out["email"] = _safe_email_for_output(u_out.get("email"))
    return schemas.UsuarioOut.model_validate(u_out)

@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    """
    DEV-friendly login:
    - Acepta password en texto plano, sha256 o bcrypt (si passlib disponible).
    - Devuelve ambas formas compatibles para el front: { token, user, user_schema }.
    """
    email, password = await extract_email_password(request)

    u = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if not u or not verify_password(password, get_pwd_value_from_user(u)):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = "dev-" + _email_fingerprint(u.email or "")

    u_out = {**u.__dict__}
    u_out["email"] = _safe_email_for_output(u_out.get("email"))
    user_schema = schemas.UsuarioOut.model_validate(u_out)

    # 🔄 Devolvemos claves duplicadas para máxima compatibilidad con front viejos
    return {
        "token": token,
        "user": user_schema,         # por si el front usa 'user'
        "user_schema": user_schema,  # por si el front espera 'user_schema'
    }

@router.get("/me", response_model=schemas.UsuarioOut)
def me(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    u = get_current_user(db, authorization)
    u_out = {**u.__dict__}
    u_out["email"] = _safe_email_for_output(u_out.get("email"))
    return schemas.UsuarioOut.model_validate(u_out)

# =============== Update perfil (ID) ===============
@router.put("/{usuario_id}", response_model=schemas.UsuarioOut)
@router.patch("/{usuario_id}", response_model=schemas.UsuarioOut)
def update_usuario_by_id(
    usuario_id: int,
    payload: UsuarioUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    current = get_current_user(db, authorization)
    if current.id != usuario_id and getattr(current, "rol", "cliente") not in ("admin",):
        raise HTTPException(status_code=403, detail="No autorizado")

    u = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if payload.email and payload.email != getattr(u, "email", None):
        existe = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
        if existe and existe.id != u.id:
            raise HTTPException(status_code=409, detail="Email ya está en uso")

    apply_user_updates(u, payload.model_dump(exclude_unset=True))
    db.add(u)
    db.commit()
    db.refresh(u)

    u_out = {**u.__dict__}
    u_out["email"] = _safe_email_for_output(u_out.get("email"))
    return schemas.UsuarioOut.model_validate(u_out)

# =============== Update perfil (/me) ===============
@router.put("/me", response_model=schemas.UsuarioOut)
@router.patch("/me", response_model=schemas.UsuarioOut)
def update_me(
    payload: UsuarioUpdateIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    u = get_current_user(db, authorization)
    if payload.email and payload.email != getattr(u, "email", None):
        existe = db.query(models.Usuario).filter(models.Usuario.email == payload.email).first()
        if existe and existe.id != u.id:
            raise HTTPException(status_code=409, detail="Email ya está en uso")

    apply_user_updates(u, payload.model_dump(exclude_unset=True))
    db.add(u)
    db.commit()
    db.refresh(u)

    u_out = {**u.__dict__}
    u_out["email"] = _safe_email_for_output(u_out.get("email"))
    return schemas.UsuarioOut.model_validate(u_out)

# =============== Password ===============
class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str

@router.put("/me/password", status_code=200)
def change_password(
    payload: PasswordChangeIn,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    u = get_current_user(db, authorization)
    if not verify_password(payload.current_password, get_pwd_value_from_user(u)):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="La nueva contraseña debe tener al menos 8 caracteres")
    set_pwd_value_to_user(u, sha256(payload.new_password))
    db.add(u)
    db.commit()
    return {"ok": True}

# =============== Avatar (mock) ===============
@router.post("/me/avatar")
def upload_avatar(
    authorization: Optional[str] = Header(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    u = get_current_user(db, authorization)
    filename = file.filename or "avatar.png"
    fake_url = f"https://cdn.local/avatars/{u.id}/{filename}"
    if hasattr(u, "avatar_url"):
        u.avatar_url = fake_url
        db.add(u)
        db.commit()
        db.refresh(u)
    return {"avatar_url": fake_url}

# =============== Activar emprendedor ===============
@router.put("/{usuario_id}/activar_emprendedor", response_model=schemas.ActivacionEmprendedorOut)
def activar_emprendedor(
    usuario_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    current = get_current_user(db, authorization)
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
        db.add(emp)
        db.flush()
    else:
        if not emp.codigo_cliente:
            emp.codigo_cliente = ensure_unico_codigo(db)

    if getattr(usuario, "rol", "cliente") == "cliente":
        usuario.rol = "emprendedor"

    db.commit()
    db.refresh(emp)
    out = schemas.EmprendedorOut.model_validate({
        "id": emp.id,
        "nombre": emp.nombre,
        "descripcion": emp.descripcion,
        "codigo_cliente": emp.codigo_cliente,
        "owner_user_id": emp.usuario_id,
        "created_at": getattr(emp, "created_at", None),
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
