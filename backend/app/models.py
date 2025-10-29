# app/models.py
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Time, Text, ForeignKey, Numeric, JSON, Index
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from app.database import Base

# =========
# USUARIO
# =========
class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    nombre: Mapped[str | None] = mapped_column(String(100), nullable=True)
    apellido: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dni: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rol: Mapped[str] = mapped_column(String(32), default="cliente", nullable=False)

    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relación 1:1 con Emprendedor
    emprendedor: Mapped["Emprendedor"] = relationship(
        "Emprendedor", back_populates="usuario", uselist=False
    )


# =============
# EMPRENDEDOR
# =============
class Emprendedor(Base):
    __tablename__ = "emprendedores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)

    nombre: Mapped[str] = mapped_column(String(180), nullable=False)  # NOT NULL como pediste
    telefono_contacto: Mapped[str | None] = mapped_column(String(60), nullable=True)
    direccion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rubro: Mapped[str | None] = mapped_column(String(120), nullable=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Código público único (siempre mayúscula en endpoints)
    codigo_cliente: Mapped[str] = mapped_column(String(16), unique=True, index=True, nullable=False)

    # Redes sociales opcionales (array/objeto JSON)
    redes: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)

    # Logo (URL o path)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="emprendedor")
    servicios: Mapped[list["Servicio"]] = relationship("Servicio", back_populates="emprendedor", cascade="all, delete-orphan")
    horarios: Mapped[list["Horario"]] = relationship("Horario", back_populates="emprendedor", cascade="all, delete-orphan")
    turnos: Mapped[list["Turno"]] = relationship("Turno", back_populates="emprendedor", cascade="all, delete-orphan")

Index("ix_emprendedores_codigo_cliente", Emprendedor.codigo_cliente, unique=True)


# ==========
# SERVICIO
# ==========
class Servicio(Base):
    __tablename__ = "servicios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    emprendedor_id: Mapped[int] = mapped_column(ForeignKey("emprendedores.id", ondelete="CASCADE"), nullable=False)

    nombre: Mapped[str] = mapped_column(String(180), nullable=False)
    precio: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    duracion_min: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    emprendedor: Mapped["Emprendedor"] = relationship("Emprendedor", back_populates="servicios")
    turnos: Mapped[list["Turno"]] = relationship("Turno", back_populates="servicio")


# =========
# HORARIO
# =========
class Horario(Base):
    __tablename__ = "horarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    emprendedor_id: Mapped[int] = mapped_column(ForeignKey("emprendedores.id", ondelete="CASCADE"), nullable=False)

    # 0=Dom, 1=Lun, ..., 6=Sab
    dia_semana: Mapped[int] = mapped_column(Integer, nullable=False)
    hora_desde: Mapped[datetime | Time] = mapped_column(Time, nullable=False)
    hora_hasta: Mapped[datetime | Time] = mapped_column(Time, nullable=False)

    intervalo_min: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    emprendedor: Mapped["Emprendedor"] = relationship("Emprendedor", back_populates="horarios")


# ======
# TURNO
# ======
class Turno(Base):
    __tablename__ = "turnos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    emprendedor_id: Mapped[int] = mapped_column(ForeignKey("emprendedores.id", ondelete="CASCADE"), nullable=False)
    servicio_id: Mapped[int] = mapped_column(ForeignKey("servicios.id", ondelete="RESTRICT"), nullable=False)

    inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    fin: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    # Cliente (opcionalmente referenciable más adelante si querés)
    usuario_cliente_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    cliente_nombre: Mapped[str | None] = mapped_column(String(180), nullable=True)

    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(String(24), default="confirmado", nullable=False)

    creado_en: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    emprendedor: Mapped["Emprendedor"] = relationship("Emprendedor", back_populates="turnos")
    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="turnos")
