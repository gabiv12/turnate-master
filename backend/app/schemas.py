# app/schemas.py
from __future__ import annotations
from typing import Optional, List, Literal
from datetime import datetime, time
import re
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# ========= USUARIOS =========
class UsuarioBase(ORMModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None
    rol: Optional[Literal["cliente", "emprendedor", "admin", "user"]] = "cliente"
    is_active: Optional[bool] = True

class UsuarioCreate(ORMModel):
    email: EmailStr
    password: str = Field(min_length=4)
    username: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None

class UsuarioLogin(ORMModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    identity: Optional[str] = None
    password: str

class UsuarioUpdateMe(ORMModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None
    new_password: Optional[str] = Field(default=None, min_length=4)

class UsuarioOut(UsuarioBase):
    id: int
    created_at: Optional[datetime] = None

class AuthResponse(ORMModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UsuarioOut

# ======== EMPRENDEDORES =========
class EmprendedorBase(ORMModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    codigo_cliente: Optional[str] = None
    # 🔹 extras persistidos
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    rubro: Optional[str] = None
    redes: Optional[str] = None
    web: Optional[str] = None
    email_contacto: Optional[str] = None
    logo_url: Optional[str] = None

class EmprendedorCreate(ORMModel):
    usuario_id: int
    nombre: str
    descripcion: Optional[str] = None
    # opcionalmente permitir crear con extras
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    rubro: Optional[str] = None
    redes: Optional[str] = None
    web: Optional[str] = None
    email_contacto: Optional[str] = None
    logo_url: Optional[str] = None

class EmprendedorUpdate(ORMModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    # extras editables
    cuit: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    rubro: Optional[str] = None
    redes: Optional[str] = None
    web: Optional[str] = None
    email_contacto: Optional[str] = None
    logo_url: Optional[str] = None

class EmprendedorOut(EmprendedorBase):
    id: int
    owner_user_id: Optional[int] = None
    created_at: Optional[datetime] = None

class ActivacionEmprendedorOut(ORMModel):
    token: Optional[str] = None
    emprendedor: EmprendedorOut

# ========= SERVICIOS =========
class ServicioBase(ORMModel):
    nombre: str
    duracion_min: int = Field(ge=5, le=1440)
    precio: Optional[float] = 0.0
    color: Optional[str] = None

class ServicioCreate(ServicioBase):
    emprendedor_id: Optional[int] = None

class ServicioUpdate(ORMModel):
    nombre: Optional[str] = None
    duracion_min: Optional[int] = Field(default=None, ge=5, le=1440)
    precio: Optional[float] = None
    color: Optional[str] = None

class ServicioOut(ServicioBase):
    id: int
    emprendedor_id: int

# ========= HORARIOS =========
class HorarioBase(ORMModel):
    dia_semana: int = Field(ge=0, le=6)
    inicio: time
    fin: time

class HorarioOut(HorarioBase):
    id: int
    emprendedor_id: int

class HorariosReplaceIn(ORMModel):
    items: List[HorarioBase]

# ========= TURNOS =========
class TurnoBase(ORMModel):
    inicio: datetime
    fin: datetime
    cliente_nombre: Optional[str] = None
    cliente_contacto: Optional[str] = None
    nota: Optional[str] = None

class TurnoCreate(TurnoBase):
    servicio_id: int
    emprendedor_id: int

class TurnoOut(TurnoBase):
    id: int
    servicio_id: int
    emprendedor_id: int
    creado_por_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    estado: Optional[Literal["reservado", "confirmado", "cancelado"]] = "reservado"
