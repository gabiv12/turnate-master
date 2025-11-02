from datetime import datetime
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, ForeignKey, UniqueConstraint, Enum as SAEnum
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ===== DB / Base =====
SQLITE_URL = "sqlite:///./dev.db"  # dev
engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ===== Enums =====
class Rol(str, Enum):
    cliente = "cliente"
    emprendedor = "emprendedor"
    admin = "admin"

# ===== Models =====
class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    nombre = Column(String(100))
    apellido = Column(String(100))
    dni = Column(String(30))
    password_hash = Column(String(255), nullable=False)
    rol = Column(SAEnum(Rol), nullable=False, default=Rol.cliente)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    emprendedor = relationship("Emprendedor", back_populates="usuario", uselist=False)

class Emprendedor(Base):
    __tablename__ = "emprendedores"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True, nullable=False)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(String(500))
    codigo_cliente = Column(String(16), unique=True, index=True)  # código público para reservas
    telefono = Column(String(50))
    direccion = Column(String(200))
    email_contacto = Column(String(120))
    rubro = Column(String(100))
    web = Column(String(200))
    redes = Column(String(200))
    cuit = Column(String(30))
    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    usuario = relationship("Usuario", back_populates="emprendedor")
    servicios = relationship("Servicio", back_populates="emprendedor")
    horarios = relationship("Horario", back_populates="emprendedor")
    turnos = relationship("Turno", back_populates="emprendedor")

class Servicio(Base):
    __tablename__ = "servicios"
    id = Column(Integer, primary_key=True, index=True)
    emprendedor_id = Column(Integer, ForeignKey("emprendedores.id"), nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    duracion_min = Column(Integer, nullable=False, default=30)
    activo = Column(Boolean, default=True, nullable=False)

    emprendedor = relationship("Emprendedor", back_populates="servicios")

class Horario(Base):
    __tablename__ = "horarios"
    id = Column(Integer, primary_key=True, index=True)
    emprendedor_id = Column(Integer, ForeignKey("emprendedores.id"), nullable=False, index=True)
    dia_semana = Column(Integer, nullable=False)  # 0=Dom..6=Sab
    hora_desde = Column(String(5), nullable=False)  # "08:00"
    hora_hasta = Column(String(5), nullable=False)  # "12:00"
    intervalo_min = Column(Integer, nullable=False, default=30)
    activo = Column(Boolean, default=True, nullable=False)

    emprendedor = relationship("Emprendedor", back_populates="horarios")

class Turno(Base):
    __tablename__ = "turnos"
    id = Column(Integer, primary_key=True, index=True)
    emprendedor_id = Column(Integer, ForeignKey("emprendedores.id"), nullable=False, index=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=False, index=True)
    inicio = Column(DateTime, nullable=False)  # naive local
    fin = Column(DateTime, nullable=False)     # calculado al crear
    cliente_nombre = Column(String(120), nullable=False)
    cliente_contacto = Column(String(120), nullable=False)
    notas = Column(String(500))
    estado = Column(String(30), nullable=False, default="reservado")  # reservado/cancelado/etc
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    emprendedor = relationship("Emprendedor", back_populates="turnos")
    # (relación a Servicio opcional si la usás)
