from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict

# ===== Usuario =====
class UsuarioBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: EmailStr
    nombre: Optional[str] = None
    rol: str

class UsuarioCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    username: Optional[str] = None
    nombre: Optional[str] = None

class UsuarioLogin(BaseModel):
    identity: str  # username o email
    password: str

class UsuarioUpdateMe(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    dni: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioBase

# ===== Emprendedor =====
class EmprendedorBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    usuario_id: int
    nombre: str
    descripcion: Optional[str] = None
    codigo_cliente: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    email_contacto: Optional[str] = None
    rubro: Optional[str] = None
    web: Optional[str] = None
    redes: Optional[str] = None
    cuit: Optional[str] = None
    activo: bool

class EmprendedorCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class EmprendedorUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    email_contacto: Optional[str] = None
    rubro: Optional[str] = None
    web: Optional[str] = None
    redes: Optional[str] = None
    cuit: Optional[str] = None
    activo: Optional[bool] = None

class ActivacionEmprendedorOut(BaseModel):
    message: str
    emprendedor: EmprendedorBase

# ===== Servicio / Horario mínimos para público =====
class ServicioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str
    duracion_min: int
    activo: bool

class HorarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    dia_semana: int
    hora_desde: str
    hora_hasta: str
    intervalo_min: int
    activo: bool

# ===== Turnos =====
class TurnoCreate(BaseModel):
    emprendedor_id: int
    servicio_id: int
    inicio: datetime  # naive
    cliente_nombre: str
    cliente_contacto: str
    notas: Optional[str] = None

class TurnoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emprendedor_id: int
    servicio_id: int
    inicio: datetime
    fin: datetime
    cliente_nombre: str
    cliente_contacto: str
    notas: Optional[str] = None
    estado: str

# ===== Agenda pública =====
class AgendaOut(BaseModel):
    slots: List[datetime]
