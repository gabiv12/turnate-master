# app/routers/usuarios.py
from datetime import datetime
import re, secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.deps import get_db, get_current_user
from app.models import Usuario, Emprendedor
from app.auth import create_access_token, get_password_hash, verify_password
from app.schemas import (
    UsuarioCreate, UsuarioUpdateMe, UsuarioOut,
    EmprendedorOut, ActivacionEmprendedorOut, AuthResponse
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

_username_regex = re.compile(r"[^a-z0-9_]+")

def _normalize_username(base: str) -> str:
    base = base.strip().lower()
    base = _username_regex.sub("", base)
    return base or "user"

def _suggest_username_from_email(email: str) -> str:
    return _normalize_username(email.split("@")[0])

def _ensure_unique_username(db: Session, base: str) -> str:
    cand = base
    for i in range(1, 200):
        exists = db.query(Usuario).filter(Usuario.username == cand).first()
        if not exists:
            return cand
        cand = f"{base}{i}"
    return f"{base}{secrets.token_hex(2)}"

def _set_password(u: Usuario, raw: str):
    u.password_hash = get_password_hash(raw)

def _ensure_unique_codigo(db: Session) -> str:
    for _ in range(20):
        code = secrets.token_hex(3)[:6].upper()
        if not db.query(Emprendedor).filter(Emprendedor.codigo == code).first():
            return code
    return f"EMP{int(datetime.utcnow().timestamp())}"

def _user_to_out(u: Usuario) -> UsuarioOut:
    return UsuarioOut.model_validate(u)

@router.post("/registro", response_model=AuthResponse)
def registrar(payload: UsuarioCreate, db: Session = Depends(get_db)):
    if db.query(Usuario).filter(Usuario.email == payload.email).first():
        raise HTTPException(400, "El email ya está registrado.")

    u = Usuario(
        email=payload.email,
        nombre=payload.nombre or "Usuario",
        is_active=True,
        rol="user",
    )
    u.username = _ensure_unique_username(db, _suggest_username_from_email(payload.email))
    _set_password(u, payload.password)

    db.add(u)
    db.commit()
    db.refresh(u)

    token = create_access_token({"sub": str(u.id), "rol": u.rol, "email": u.email})
    return AuthResponse(user_schema=_user_to_out(u), token=token)

@router.post("/login", response_model=AuthResponse)
async def login(request: Request, db: Session = Depends(get_db)):
    # Soporta JSON o FORM y acepta email / username / usuario + password / clave
    data = {}
    try:
        data = await request.json()
    except Exception:
        pass
    if not isinstance(data, dict) or not data:
        try:
            form = await request.form()
            data = dict(form)
        except Exception:
            data = {}

    ident = data.get("email") or data.get("username") or data.get("usuario")
    password = data.get("password") or data.get("clave")
    if not ident or not password:
        raise HTTPException(400, "Enviá email/username y password.")

    if "@" in ident:
        q = db.query(Usuario).filter(Usuario.email == ident)
    else:
        q = db.query(Usuario).filter(Usuario.username == ident)
    u = q.first()
    if not u or not verify_password(password, u.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas.")

    token = create_access_token({"sub": str(u.id), "rol": u.rol, "email": u.email})
    return AuthResponse(user_schema=_user_to_out(u), token=token)

@router.get("/me", response_model=UsuarioOut)
def me(user=Depends(get_current_user)):
    return _user_to_out(user)

@router.put("/me", response_model=UsuarioOut)
def update_me(payload: UsuarioUpdateMe, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if payload.email and payload.email != user.email:
        if db.query(Usuario).filter(Usuario.email == payload.email).first():
            raise HTTPException(400, "El email ya está en uso.")
        user.email = payload.email
        # autocompleta username si estuviera vacío (por compatibilidad)
        if not user.username:
            base = _suggest_username_from_email(user.email)
            user.username = _ensure_unique_username(db, base)
    if payload.nombre:
        user.nombre = payload.nombre
    db.commit(); db.refresh(user)
    return _user_to_out(user)

@router.get("/me/emprendedor", response_model=EmprendedorOut)
def me_emprendedor(db: Session = Depends(get_db), user=Depends(get_current_user)):
    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not emp:
        raise HTTPException(404, "No tenés emprendedor activo todavía.")
    return EmprendedorOut.model_validate(emp)

@router.put("/{usuario_id}/activar_emprendedor", response_model=ActivacionEmprendedorOut)
def activar_emprendedor(usuario_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if usuario_id != user.id and user.rol != "admin":
        raise HTTPException(403, "No autorizado.")

    target = db.query(Usuario).get(usuario_id)
    if not target:
        raise HTTPException(404, "Usuario no encontrado.")

    emp = db.query(Emprendedor).filter(Emprendedor.usuario_id == usuario_id).first()
    if not emp:
        emp = Emprendedor(
            usuario_id=usuario_id,
            nombre=target.nombre or "Emprendimiento",
            activo=True,
            codigo=_ensure_unique_codigo(db),
        )
        db.add(emp)
        db.commit()
        db.refresh(emp)
    elif not emp.codigo:
        emp.codigo = _ensure_unique_codigo(db)
        db.commit(); db.refresh(emp)

    token = create_access_token({"sub": str(target.id), "rol": target.rol, "email": target.email})
    return ActivacionEmprendedorOut(
        ok=True,
        emprendedor_id=emp.id,
        codigo=emp.codigo,
        user_schema=_user_to_out(target),
        token=token,
    )
