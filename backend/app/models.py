# app/models.py
from __future__ import annotations
from datetime import datetime, time as dt_time
from typing import Optional, List

from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Integer,
    ForeignKey,
    Float,
    Time,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    apellido: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    dni: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), default="cliente", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    emprendedor: Mapped[Optional["Emprendedor"]] = relationship(
        "Emprendedor", back_populates="usuario", uselist=False, cascade="all, delete-orphan"
    )
    turnos_creados: Mapped[List["Turno"]] = relationship(
        "Turno", back_populates="creado_por",
        primaryjoin="Usuario.id==Turno.creado_por_user_id",
        cascade="all, delete-orphan", passive_deletes=True,
    )


class Emprendedor(Base):
    __tablename__ = "emprendedores"
    __table_args__ = (
        UniqueConstraint("usuario_id", name="uq_emprendedores_usuario"),
        UniqueConstraint("codigo_cliente", name="uq_emprendedores_codigo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, unique=True)

    # básicos
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    codigo_cliente: Mapped[Optional[str]] = mapped_column(String(16), unique=True, index=True, nullable=True)

    # 🔹 campos extra que querés guardar desde EmprendedorForm
    cuit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    direccion: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    rubro: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    redes: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    web: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    email_contacto: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # admite DataURL base64

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    usuario: Mapped["Usuario"] = relationship("Usuario", back_populates="emprendedor")
    servicios: Mapped[List["Servicio"]] = relationship("Servicio", back_populates="emprendedor",
        cascade="all, delete-orphan", passive_deletes=True)
    horarios: Mapped[List["Horario"]] = relationship("Horario", back_populates="emprendedor",
        cascade="all, delete-orphan", passive_deletes=True)
    turnos: Mapped[List["Turno"]] = relationship("Turno", back_populates="emprendedor",
        cascade="all, delete-orphan", passive_deletes=True)


class Servicio(Base):
    __tablename__ = "servicios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    emprendedor_id: Mapped[int] = mapped_column(ForeignKey("emprendedores.id", ondelete="CASCADE"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    duracion_min: Mapped[int] = mapped_column(Integer, nullable=False)
    precio: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    emprendedor: Mapped["Emprendedor"] = relationship("Emprendedor", back_populates="servicios")
    turnos: Mapped[List["Turno"]] = relationship("Turno", back_populates="servicio",
        cascade="all, delete-orphan", passive_deletes=True)


class Horario(Base):
    __tablename__ = "horarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    emprendedor_id: Mapped[int] = mapped_column(ForeignKey("emprendedores.id", ondelete="CASCADE"), nullable=False)
    dia_semana: Mapped[int] = mapped_column(Integer, nullable=False)  # 0..6
    inicio: Mapped[dt_time] = mapped_column(Time, nullable=False)
    fin: Mapped[dt_time] = mapped_column(Time, nullable=False)

    emprendedor: Mapped["Emprendedor"] = relationship("Emprendedor", back_populates="horarios")


class Turno(Base):
    __tablename__ = "turnos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    emprendedor_id: Mapped[int] = mapped_column(ForeignKey("emprendedores.id", ondelete="CASCADE"), nullable=False)
    servicio_id: Mapped[Optional[int]] = mapped_column(ForeignKey("servicios.id", ondelete="SET NULL"), nullable=True)
    inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    fin: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    cliente_nombre: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    cliente_contacto: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    nota: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="reservado", nullable=False)
    creado_por_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    emprendedor: Mapped["Emprendedor"] = relationship("Emprendedor", back_populates="turnos")
    servicio: Mapped[Optional["Servicio"]] = relationship("Servicio", back_populates="turnos")
    creado_por = relationship("Usuario", back_populates="turnos_creados")
