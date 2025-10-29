# app/schemas.py
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# =========================
# USUARIOS
# =========================
class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: Optional[EmailStr] = None
    nombre: Optional[str] = ""

class UsuarioUpdate(BaseModel):
    nombre: str = Field(min_length=1)

class PasswordChangeIn(BaseModel):
    actual: str = Field(min_length=1)
    nueva: str = Field(min_length=6)


# =========================
# EMPRENDEDORES
# =========================
class EmprendedorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    # compat viejo front:
    usuario_id: Optional[int] = None

    nombre: Optional[str] = ""
    telefono_contacto: Optional[str] = ""
    direccion: Optional[str] = ""
    rubro: Optional[str] = ""
    descripcion: Optional[str] = ""
    codigo_cliente: Optional[str] = ""
    redes: Optional[str] = ""
    logo_url: Optional[str] = ""
    created_at: Optional[datetime] = None

class EmprendedorUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono_contacto: Optional[str] = None
    direccion: Optional[str] = None
    rubro: Optional[str] = None
    descripcion: Optional[str] = None
    redes: Optional[str] = None
    logo_url: Optional[str] = None


# =========================
# SERVICIOS
# =========================
class ServicioBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    nombre: str = Field(min_length=1)
    duracion_min: int = Field(ge=5, le=600)
    precio: int = Field(ge=0)

class ServicioCreate(ServicioBase):
    pass

class ServicioUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    nombre: Optional[str] = None
    duracion_min: Optional[int] = Field(default=None, ge=5, le=600)
    precio: Optional[int] = Field(default=None, ge=0)

class ServicioOut(ServicioBase):
    id: int


# =========================
# HORARIOS  (compat en imports)
# =========================
class HorarioBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    dia_semana: int = Field(ge=0, le=6)  # 0=lunes ... 6=domingo
    hora_desde: str  # "HH:MM"
    hora_hasta: str  # "HH:MM"
    intervalo_min: int = Field(ge=5, le=600)
    activo: bool = True

class HorarioCreate(HorarioBase):
    pass

class HorarioUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    dia_semana: Optional[int] = Field(default=None, ge=0, le=6)
    hora_desde: Optional[str] = None
    hora_hasta: Optional[str] = None
    intervalo_min: Optional[int] = Field(default=None, ge=5, le=600)
    activo: Optional[bool] = None

class HorarioOut(HorarioBase):
    id: int
    emprendedor_id: int


# =========================
# TURNOS  (lo que falta para app/routers/turnos.py)
# =========================
class TurnoOut(BaseModel):
    """
    Respuesta de un turno para listados / detalle.
    Incluye nombres compatibles que usa tu front:
    - inicio / fin (datetime ISO)
    - desde / hasta (aliases opcionales por compat)
    - estado, precio, cliente_nombre / cliente_contacto
    - servicio_id, emprendedor_id, servicio_nombre (si el query los trae)
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    inicio: Optional[datetime] = None
    fin: Optional[datetime] = None

    # aliases de compatibilidad (algunos front usan desde/hasta)
    desde: Optional[datetime] = None
    hasta: Optional[datetime] = None

    estado: Optional[str] = "confirmado"
    precio: Optional[int] = 0

    cliente_nombre: Optional[str] = ""
    cliente_contacto: Optional[str] = ""

    servicio_id: Optional[int] = None
    emprendedor_id: Optional[int] = None

    # opcional si en el query haces join
    servicio_nombre: Optional[str] = None

class TurnoCompatCreate(BaseModel):
    """
    Payload de creación con compatibilidad flexible.
    Tu back suele necesitar: servicio_id + inicio (datetime).
    Campos de cliente y precio son opcionales.
    """
    model_config = ConfigDict(from_attributes=True)

    servicio_id: int = Field(ge=1)
    inicio: datetime

    # opcionales / compat
    fin: Optional[datetime] = None
    precio: Optional[int] = Field(default=0, ge=0)
    cliente_nombre: Optional[str] = ""
    cliente_contacto: Optional[str] = ""

class TurnoUpdate(BaseModel):
    """
    Actualización parcial del turno.
    """
    model_config = ConfigDict(from_attributes=True)

    estado: Optional[str] = None
    precio: Optional[int] = Field(default=None, ge=0)
    inicio: Optional[datetime] = None
    fin: Optional[datetime] = None
    cliente_nombre: Optional[str] = None
    cliente_contacto: Optional[str] = None
