# app/scripts/seed_full_demo.py
from __future__ import annotations
from datetime import datetime, date, time, timedelta
import random

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models

# ========= Config =========
ADMIN_EMAIL = "admin@demo.com"
ADMIN_PASS  = "admin"

EMP_EMAIL   = "emprendedor@demo.com"
EMP_PASS    = "emprendedor"
EMP_NOMBRE  = "Barbería Demo"
EMP_DESC    = "Servicios de peluquería y barbería"
EMP_CODE    = "DEMOBAR"  # si está usado, se genera otro

# Servicios (nombre, duración_min, precio_ARS)
SERVICIOS = [
    ("Corte Clásico",              30,   9000),
    ("Corte + Barba",              45,  14000),
    ("Barba perfilada",            25,   7000),
    ("Color corto",                60,  22000),
    ("Color completo",             90,  35000),
    ("Reflejos / Balayage",       120,  52000),
    ("Peinado",                    30,   8000),
    ("Lavar + Brushing",           40,  11000),
    ("Nutrición capilar",          45,  15000),
    ("Shock de Keratina",          70,  28000),
    ("Alisado progresivo",        150,  70000),
    ("Tratamiento reparatorio",    60,  20000),
]

# Horarios (0=Dom..6=Sáb)
BLOQUES = [
    *[(d, time(9, 0),  time(13, 0)) for d in (1,2,3,4,5)],
    *[(d, time(16, 0), time(20, 0)) for d in (1,2,3,4,5)],
    (6, time(9, 0), time(14, 0)),
]

# Nombres de clientes (50)
CLIENTES = [
    "Cliente A","Cliente B","Cliente C","Cliente D","Cliente E","Cliente F","Cliente G","Cliente H","Cliente I","Cliente J",
    "Cliente K","Cliente L","Cliente M","Cliente N","Cliente O","Cliente P","Cliente Q","Cliente R","Cliente S","Cliente T",
    "Cliente U","Cliente V","Cliente W","Cliente X","Cliente Y","Cliente Z","Cliente AA","Cliente AB","Cliente AC","Cliente AD",
    "Cliente AE","Cliente AF","Cliente AG","Cliente AH","Cliente AI","Cliente AJ","Cliente AK","Cliente AL","Cliente AM","Cliente AN",
    "Cliente AO","Cliente AP","Cliente AQ","Cliente AR","Cliente AS","Cliente AT","Cliente AU","Cliente AV","Cliente AW","Cliente AX",
]

TARGET_INGRESOS = 1_500_000  # objetivo mensual ~1.5M
TOL = 0.03  # ±3%


# ========= Helpers =========
def sha256(s: str) -> str:
    import hashlib
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

_PWD_ATTRS = ("hashed_password", "password_hash", "password", "clave")

def set_pwd(u, plain: str):
    h = sha256(plain)
    for attr in _PWD_ATTRS:
        if hasattr(u, attr):
            setattr(u, attr, h)

def ensure_admin(db: Session) -> models.Usuario:
    u = db.scalar(select(models.Usuario).where(models.Usuario.email == ADMIN_EMAIL))
    if not u:
        u = models.Usuario(
            email=ADMIN_EMAIL,
            nombre="Admin",
            apellido="Demo",
            rol="admin",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        set_pwd(u, ADMIN_PASS)
        db.add(u); db.commit(); db.refresh(u)
    else:
        u.rol = "admin"              # <-- fuerza rol admin
        u.is_active = True
        set_pwd(u, ADMIN_PASS)
        db.add(u); db.commit(); db.refresh(u)
    return u

def ensure_owner(db: Session) -> models.Usuario:
    u = db.scalar(select(models.Usuario).where(models.Usuario.email == EMP_EMAIL))
    if not u:
        u = models.Usuario(
            email=EMP_EMAIL,
            nombre="Demo",
            apellido="Emprendedor",
            rol="emprendedor",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        set_pwd(u, EMP_PASS)
        db.add(u); db.commit(); db.refresh(u)
    else:
        u.rol = "emprendedor"
        u.is_active = True
        set_pwd(u, EMP_PASS)
        db.add(u); db.commit(); db.refresh(u)
    return u

def ensure_codigo_unico(db: Session, preferido: str) -> str:
    if preferido:
        c = db.scalar(select(func.count()).select_from(models.Emprendedor)
                      .where(models.Emprendedor.codigo_cliente == preferido))
        if not c:
            return preferido
    abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(30):
        cand = "".join(random.choice(abc) for _ in range(7))
        c = db.scalar(select(func.count()).select_from(models.Emprendedor)
                      .where(models.Emprendedor.codigo_cliente == cand))
        if not c:
            return cand
    return "EMP" + "".join(random.choice("23456789") for _ in range(5))

def ensure_emprendedor(db: Session, owner: models.Usuario) -> models.Emprendedor:
    emp = db.scalar(select(models.Emprendedor).where(models.Emprendedor.usuario_id == owner.id))
    if not emp:
        emp = models.Emprendedor(
            usuario_id=owner.id,
            nombre=EMP_NOMBRE,
            descripcion=EMP_DESC,
            codigo_cliente=ensure_codigo_unico(db, EMP_CODE),
            created_at=datetime.utcnow(),
        )
        db.add(emp); db.commit(); db.refresh(emp)
    else:
        if not getattr(emp, "nombre", None):
            emp.nombre = EMP_NOMBRE
        if not getattr(emp, "codigo_cliente", None):
            emp.codigo_cliente = ensure_codigo_unico(db, EMP_CODE)
        db.add(emp); db.commit(); db.refresh(emp)
    return emp

def upsert_servicios(db: Session, emp_id: int) -> list[models.Servicio]:
    out = []
    existentes = {
        s.nombre.lower(): s for s in db.scalars(
            select(models.Servicio).where(models.Servicio.emprendedor_id == emp_id)
        ).all()
    }
    for nombre, dur, precio in SERVICIOS:
        key = nombre.lower()
        if key in existentes:
            s = existentes[key]
            if hasattr(s, "duracion_min"): s.duracion_min = dur
            elif hasattr(s, "duracion_minutos"): s.duracion_minutos = dur
            if hasattr(s, "precio"): s.precio = float(precio)
            if hasattr(s, "activo"): s.activo = True
            db.add(s); db.commit(); db.refresh(s)
            out.append(s)
        else:
            s = models.Servicio(emprendedor_id=emp_id, nombre=nombre)
            if hasattr(s, "duracion_min"): s.duracion_min = dur
            elif hasattr(s, "duracion_minutos"): s.duracion_minutos = dur
            if hasattr(s, "precio"): s.precio = float(precio)
            if hasattr(s, "activo"): s.activo = True
            db.add(s); db.commit(); db.refresh(s)
            out.append(s)
    return out

def ensure_horarios(db: Session, emp_id: int):
    for dia, ini, fin in BLOQUES:
        exists = db.scalar(
            select(func.count()).select_from(models.Horario).where(
                and_(
                    models.Horario.emprendedor_id == emp_id,
                    models.Horario.dia_semana == dia,
                    models.Horario.inicio == ini,
                    models.Horario.fin == fin,
                )
            )
        )
        if not exists:
            h = models.Horario(
                emprendedor_id=emp_id,
                dia_semana=dia,
                inicio=ini,
                fin=fin,
            )
            db.add(h); db.commit()

def precio_de(svc: models.Servicio) -> int:
    return int(getattr(svc, "precio", 0) or 0)

def duracion_de(svc: models.Servicio) -> int:
    if hasattr(svc, "duracion_min") and svc.duracion_min:
        return int(svc.duracion_min)
    if hasattr(svc, "duracion_minutos") and svc.duracion_minutos:
        return int(svc.duracion_minutos)
    return 30

def month_range(d0: date):
    first = date(d0.year, d0.month, 1)
    if d0.month == 12:
        last = date(d0.year, 12, 31)
    else:
        last = date(d0.year, d0.month + 1, 1) - timedelta(days=1)
    return first, last

def clear_turnos_mes(db: Session, emp_id: int, first: date, last: date):
    ini = datetime(first.year, first.month, first.day, 0, 0, 0)
    fin = datetime(last.year, last.month, last.day, 23, 59, 59)
    for t in db.scalars(
        select(models.Turno).where(
            and_(models.Turno.emprendedor_id == emp_id,
                 models.Turno.inicio >= ini,
                 models.Turno.inicio <= fin)
        )
    ).all():
        db.delete(t)
    db.commit()

def crear_turno(db: Session, emp_id: int, svc: models.Servicio, inicio: datetime, estado="confirmado"):
    fin = inicio + timedelta(minutes=duracion_de(svc))
    t = models.Turno(
        emprendedor_id=emp_id,
        servicio_id=svc.id,
        inicio=inicio,
        fin=fin,
        estado=estado if hasattr(models.Turno, "estado") else None,
    )
    if hasattr(t, "cliente_nombre"):
        t.cliente_nombre = random.choice(CLIENTES)
    if hasattr(t, "cliente_contacto"):
        t.cliente_contacto = "-"
    db.add(t)

def generar_mes(db: Session, emp: models.Emprendedor, servicios: list[models.Servicio]):
    today = date.today()
    first, last = month_range(today)

    clear_turnos_mes(db, emp.id, first, last)

    ingresos = 0
    cancelados = 0
    confirmados = 0

    random.seed(123)

    current = first
    while current <= last:
        if current.weekday() in [0,1,2,3,4,5]:  # L-S
            # 4–7 turnos confirmados por día (distribución realista)
            slots = random.randint(4, 7)
            hora, minuto = 9, 0
            for _ in range(slots):
                svc = random.choices(
                    servicios,
                    weights=[8,7,5,5,4,3,4,5,5,4,2,3],  # más probables: cortes/peinados/color corto
                    k=1
                )[0]
                inicio = datetime(current.year, current.month, current.day, hora, minuto)
                crear_turno(db, emp.id, svc, inicio, estado="confirmado")
                ingresos += precio_de(svc)
                confirmados += 1

                salto = random.choice([45, 60, 75, 90])
                total = hora * 60 + minuto + salto
                hora, minuto = divmod(total, 60)
                if hora >= 20:
                    break

            # 20–30% días con 1 cancelado a las 17:00
            if random.random() < random.uniform(0.2, 0.3):
                svc = random.choice(servicios)
                inicio = datetime(current.year, current.month, current.day, 17, 0)
                crear_turno(db, emp.id, svc, inicio, estado="cancelado")
                cancelados += 1
        current += timedelta(days=1)

    db.commit()

    # Ajuste fino para acercarse al objetivo (agrega en los últimos días hábiles)
    objetivo_min = int(TARGET_INGRESOS * (1 - TOL))
    objetivo_max = int(TARGET_INGRESOS * (1 + TOL))

    servicios_orden = sorted(servicios, key=precio_de, reverse=True)
    d = last
    while ingresos < objetivo_min and d >= first:
        if d.weekday() in [0,1,2,3,4,5]:
            hora, minuto = 16, 0
            for svc in servicios_orden:
                inicio = datetime(d.year, d.month, d.day, hora, minuto)
                crear_turno(db, emp.id, svc, inicio, estado="confirmado")
                p = precio_de(svc)
                ingresos += p
                confirmados += 1
                total = hora * 60 + minuto + 60
                hora, minuto = divmod(total, 60)
                if ingresos >= objetivo_min or hora >= 20:
                    break
        d -= timedelta(days=1)
    db.commit()

    return ingresos, confirmados, cancelados

# ========= Run =========
def main():
    db = SessionLocal()
    try:
        admin = ensure_admin(db)                 # admin con rol correcto
        owner = ensure_owner(db)                 # dueño emprendedor
        emp = ensure_emprendedor(db, owner)      # perfil + código público
        ensure_horarios(db, emp.id)
        servicios = upsert_servicios(db, emp.id)

        ingresos, ok_cnt, canc_cnt = generar_mes(db, emp, servicios)

        print("=======================================")
        print(" SEED FULL DEMO listo")
        print("  Admin:")
        print(f"    Email: {ADMIN_EMAIL}  Pass: {ADMIN_PASS}  (rol=admin)")
        print("  Emprendedor:")
        print(f"    Email: {EMP_EMAIL}  Pass: {EMP_PASS}  (rol=emprendedor)")
        print(f"    Código público: {emp.codigo_cliente}")
        print("  Mes actual:")
        print(f"    Turnos confirmados: {ok_cnt}")
        print(f"    Turnos cancelados : {canc_cnt}")
        print(f"    Ingresos aprox    : ARS {ingresos:,}".replace(",", "."))
        print(f"    Objetivo          : ARS {TARGET_INGRESOS:,} ±{int(TOL*100)}%".replace(",", "."))
        print("  Abrí como emprendedor → Estadísticas (se llenan todos los gráficos).")
        print("  Abrí como admin      → Reportes (KPI + tortas + tabla).")
        print("=======================================")
    finally:
        db.close()

if __name__ == "__main__":
    main()
