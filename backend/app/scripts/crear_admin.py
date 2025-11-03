import os
from datetime import datetime, timedelta, time
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import Base, SessionLocal

DB_PATH = "dev.db"

# ======== borrar base de datos si no está abierta ========
if os.path.exists(DB_PATH):
    try:
        os.remove(DB_PATH)
        print("🗑️  Base de datos anterior eliminada.")
    except PermissionError:
        print("⚠️ No se pudo borrar dev.db (probablemente el backend esté en ejecución). Cerralo y reintentá.")
        exit(1)

# ======== crear nueva base ========
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
SessionLocal.configure(bind=engine)
db = SessionLocal()

def sha256(txt: str):
    return hashlib.sha256(txt.encode()).hexdigest()

# ======== crear usuarios ========
admin = models.Usuario(
    email="admin@demo.com",
    nombre="Admin",
    apellido="General",
    rol="admin",
    is_active=True,
)
if hasattr(admin, "hashed_password"):
    admin.hashed_password = sha256("admin")
else:
    admin.password = sha256("admin")

empr = models.Usuario(
    email="emprendedor@demo.com",
    nombre="Emprendedor",
    apellido="Demo",
    rol="emprendedor",
    is_active=True,
)
if hasattr(empr, "hashed_password"):
    empr.hashed_password = sha256("emprendedor")
else:
    empr.password = sha256("emprendedor")

db.add_all([admin, empr])
db.commit()
db.refresh(empr)

# ======== crear emprendedor asociado ========
emp = models.Emprendedor(
    usuario_id=empr.id,
    nombre="Demo Barbería",
    descripcion="Cortes y coloración profesional",
    codigo_cliente="DEMOBAR",
)
db.add(emp)
db.commit()
db.refresh(emp)

# ======== servicios ========
servicios = [
    models.Servicio(emprendedor_id=emp.id, nombre="Corte", duracion_min=30, precio=10000),
    models.Servicio(emprendedor_id=emp.id, nombre="Color", duracion_min=60, precio=20000),
    models.Servicio(emprendedor_id=emp.id, nombre="Peinado", duracion_min=45, precio=8000),
]
db.add_all(servicios)
db.commit()

# ======== horarios ========
for dia in range(1, 6):  # lunes a viernes
    h1 = models.Horario(emprendedor_id=emp.id, dia_semana=dia, inicio=time(9, 0), fin=time(13, 0))
    h2 = models.Horario(emprendedor_id=emp.id, dia_semana=dia, inicio=time(16, 0), fin=time(20, 0))
    db.add_all([h1, h2])
db.commit()

# ======== turnos ========
inicio = datetime(2025, 11, 1, 9, 0)
for i in range(15):
    servicio = servicios[i % len(servicios)]
    t = models.Turno(
        emprendedor_id=emp.id,
        servicio_id=servicio.id,
        inicio=inicio + timedelta(days=i),
        fin=inicio + timedelta(days=i, minutes=servicio.duracion_min),
        cliente_nombre=f"Cliente {i+1}",
        estado="reservado" if i % 5 != 0 else "cancelado",
    )
    db.add(t)
db.commit()

print("\n✅ SEED COMPLETO")
print("Admin:")
print("  Email: admin@demo.com")
print("  Contraseña: admin")
print("Emprendedor:")
print("  Email: emprendedor@demo.com")
print("  Contraseña: emprendedor")
print(f"Código público: {emp.codigo_cliente}")
print("Base: dev.db lista con datos de prueba.\n")

db.close()
