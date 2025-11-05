# backend/app/scripts/seed_demo_codigo.py
from __future__ import annotations
import os, random, hashlib
from datetime import datetime, timedelta, date, time
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models

# Base puede estar en deps o database
try:
    from app.deps import Base
except Exception:
    try:
        from app.database import Base
    except Exception:
        Base = getattr(models, "Base", None)
        if Base is None:
            raise RuntimeError("No encontré Base; probá 'from app.database import Base' o 'from app.deps import Base'.")

DB_URL = os.getenv("DATABASE_URL", "sqlite:///./turnate.db")

# === Config fija pedida ===
CODIGO_FIJO = "SGVUNLB4"
NOMBRE_EMP  = "Peluquería canina profesional"

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def set_password(u, plain: str):
    for col in ("hashed_password","password_hash","password","clave"):
        if hasattr(u, col):
            setattr(u, col, sha256(plain))

def ensure_user(db: Session, email: str, password: str, rol: str, nombre="Usuario", apellido="Demo"):
    u = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if u:
        if hasattr(u, "rol"): u.rol = rol
        set_password(u, password)
        if hasattr(u, "is_active"): u.is_active = True
        db.add(u); db.commit(); db.refresh(u)
        print(f"✓ Usuario existente normalizado: {email} [{rol}]")
        return u
    u = models.Usuario(
        email=email,
        nombre=nombre,
        apellido=apellido,
        rol=rol,
        is_active=True if hasattr(models.Usuario,"is_active") else None,
    )
    set_password(u, password)
    if hasattr(u, "created_at"):
        try: u.created_at = datetime.utcnow()
        except: pass
    db.add(u); db.commit(); db.refresh(u)
    print(f"✓ Usuario creado: {email} [{rol}]")
    return u

def ensure_emprendedor(db: Session, usuario_id: int, nombre: str, codigo_fijo: str):
    emp = db.query(models.Emprendedor).filter(models.Emprendedor.usuario_id == usuario_id).first()
    if emp:
        if hasattr(emp, "nombre"): emp.nombre = nombre
        if hasattr(emp, "codigo_cliente"):
            emp.codigo_cliente = codigo_fijo
        db.add(emp); db.commit(); db.refresh(emp)
        print(f"✓ Emprendedor existente normalizado: {emp.nombre} (código {getattr(emp,'codigo_cliente','—')})")
        return emp
    emp = models.Emprendedor(usuario_id=usuario_id, nombre=nombre)
    if hasattr(models.Emprendedor, "codigo_cliente"):
        emp.codigo_cliente = codigo_fijo
    db.add(emp); db.commit(); db.refresh(emp)
    print(f"✓ Emprendedor creado: {emp.nombre} (código {getattr(emp,'codigo_cliente','—')})")
    return emp

def ensure_servicio(db: Session, emp_id: int, nombre: str, precio: int):
    s = db.query(models.Servicio).filter(
        models.Servicio.emprendedor_id == emp_id,
        models.Servicio.nombre == nombre
    ).first()
    if s:
        if hasattr(s,"precio"): s.precio = precio
        db.add(s); db.commit(); db.refresh(s)
        return s
    kwargs = dict(nombre=nombre, emprendedor_id=emp_id)
    if hasattr(models.Servicio,"precio"): kwargs["precio"]=precio
    s = models.Servicio(**kwargs)
    db.add(s); db.commit(); db.refresh(s)
    return s

def crear_turnos_mes(db: Session, servicios: list[models.Servicio], clientes: list[models.Usuario]):
    hoy = date.today()
    first = date(hoy.year, hoy.month, 1)
    last_day = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

    estados = ["confirmado","confirmado","confirmado","cancelado"]  # ~25% cancelados
    total = 0
    count = 0
    dia = first

    while dia <= last_day:
        if dia.weekday() < 6:  # lunes-sábado
            for bloque in [(9,13),(16,20)]:
                h = bloque[0]
                while h < bloque[1]:
                    svc = random.choice(servicios)
                    cli = random.choice(clientes)
                    inicio = datetime.combine(dia, time(h, 0))
                    fin = inicio + timedelta(minutes=60)
                    estado = random.choice(estados)

                    t = models.Turno()

                    # Relaciones (solo si existen)
                    if hasattr(t, "servicio_id") and getattr(svc,"id",None) is not None:
                        t.servicio_id = svc.id
                    if hasattr(t, "cliente_id") and getattr(cli,"id",None) is not None:
                        t.cliente_id = cli.id
                    if hasattr(t, "cliente_nombre"):
                        t.cliente_nombre = f"{getattr(cli,'nombre','Cliente')} {getattr(cli,'apellido','Demo')}".strip()

                    # Fechas datetime reales
                    if hasattr(t, "inicio"): t.inicio = inicio
                    if hasattr(t, "fin"): t.fin = fin

                    # Estado
                    if hasattr(t, "estado"): t.estado = estado

                    # Precio aplicado si existe
                    precio = getattr(svc, "precio", 0) or 0
                    if hasattr(t, "precio_aplicado"):
                        t.precio_aplicado = precio

                    db.add(t)
                    if estado == "confirmado":
                        total += precio
                    count += 1
                    h += 1
        dia += timedelta(days=1)

    db.commit()
    print(f"✓ Turnos creados: {count} — Total aprox: ${total:,.0f}".replace(",", "."))

def run():
    engine = create_engine(DB_URL, future=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        # Admin
        admin = ensure_user(db, "admin@demo.com", "admin", "admin", "Admin", "Demo")

        # Emprendedor + emprendimiento con código fijo
        emp_user = ensure_user(db, "emprendedor@gmail.com", "emprendedor", "emprendedor", "Emprendedor", "Demo")
        emp = ensure_emprendedor(db, emp_user.id, NOMBRE_EMP, CODIGO_FIJO)

        # Servicios
        s1 = ensure_servicio(db, emp.id, "Baño", 12000)
        s2 = ensure_servicio(db, emp.id, "Corte", 15000)
        s3 = ensure_servicio(db, emp.id, "Baño + Corte", 23000)
        servicios = [s1, s2, s3]

        # 20 clientes
        clientes = []
        for i in range(1, 21):
            c = ensure_user(db, f"cliente{i}@demo.com", "cliente", "cliente", f"Cliente{i}", "Demo")
            clientes.append(c)

        # Turnos del mes actual
        crear_turnos_mes(db, servicios, clientes)

        print("✅ Seed demo con código fijo listo.")
        print("   Admin: admin@demo.com / admin")
        print("   Emprendedor: emprendedor@gmail.com / emprendedor")
        print(f"   Código público: {CODIGO_FIJO} — {NOMBRE_EMP}")

if __name__ == "__main__":
    run()
