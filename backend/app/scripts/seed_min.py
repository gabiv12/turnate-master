from __future__ import annotations
from datetime import datetime, date, time, timedelta
import hashlib
import random

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Usuario, Emprendedor, Servicio, Horario, Turno

# ====== Datos del seed ======
EMP_NOMBRE          = "Peluquería Juan"
EMP_DESC            = "Servicios de peluquería y barbería"
EMP_EMAIL           = "emprendedor@gmail.com"
EMP_PASS            = "emprendedor_2025"
EMP_CODIGO_PREF     = "8GPWJXVG"          # si está ocupado, genera otro

CLI_NOMBRE          = "María"
CLI_APELLIDO        = "López"
CLI_EMAIL           = "cliente@gmail.com"
CLI_PASS            = "cliente_2025"

SERVICIOS_DEMO = [
    ("Corte clásico",                 30,  8000),
    ("Corte + Barba",                 45, 12000),
    ("Barba perfilada",               20,  5000),
]

# Horarios comerciales (0=Dom..6=Sáb) usando objetos time (SQLite exige time)
BLOQUES_HORARIOS = [
    *[(d, time(9,0),  time(13,0)) for d in (1,2,3,4,5)],   # Lun..Vie 09-13
    *[(d, time(16,0), time(20,0)) for d in (1,2,3,4,5)],   # Lun..Vie 16-20
    (6, time(9,0), time(14,0)),                            # Sáb 09-14
]


# ===== util =====
def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _gen_code(n=8) -> str:
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alfabeto) for _ in range(n))

def pick_available_code(db: Session, prefered: str) -> str:
    code = prefered or _gen_code(8)
    exists = db.scalar(
        select(func.count()).select_from(Emprendedor).where(Emprendedor.codigo_cliente == code)
    )
    if not exists:
        return code
    # intenta 10 candidatos
    for _ in range(10):
        cand = _gen_code(8)
        exists = db.scalar(
            select(func.count()).select_from(Emprendedor).where(Emprendedor.codigo_cliente == cand)
        )
        if not exists:
            return cand
    return "EMP" + _gen_code(5)


# ===== ensure / upserts =====
def ensure_user(db: Session, *, email, password, nombre, apellido="", rol="cliente") -> int:
    u = db.scalar(select(Usuario).where(Usuario.email == email))
    if u:
        # refresco mínimo; ajustá a tu modelo
        if hasattr(u, "hashed_password"):
            u.hashed_password = sha256(password)
        elif hasattr(u, "password"):
            u.password = password
        if hasattr(u, "rol"):
            u.rol = rol
        if hasattr(u, "is_active"):
            u.is_active = True
        if hasattr(u, "nombre"):
            u.nombre = nombre
        if hasattr(u, "apellido"):
            u.apellido = apellido
        db.add(u); db.commit(); db.refresh(u)
        return u.id

    u = Usuario(email=email)
    # set opcionales según tu modelo
    if hasattr(u, "hashed_password"):
        u.hashed_password = sha256(password)
    elif hasattr(u, "password"):
        u.password = password
    if hasattr(u, "rol"):
        u.rol = rol
    if hasattr(u, "is_active"):
        u.is_active = True
    if hasattr(u, "nombre"):
        u.nombre = nombre
    if hasattr(u, "apellido"):
        u.apellido = apellido
    if hasattr(u, "created_at"):
        u.created_at = datetime.utcnow()
    db.add(u); db.commit(); db.refresh(u)
    return u.id


def ensure_emprendedor(db: Session, *, usuario_id: int) -> tuple[int, str]:
    e = db.scalar(select(Emprendedor).where(Emprendedor.usuario_id == usuario_id))
    codigo = pick_available_code(db, EMP_CODIGO_PREF)
    if e:
        if hasattr(e, "nombre"):        e.nombre = EMP_NOMBRE
        if hasattr(e, "descripcion"):   e.descripcion = EMP_DESC
        if hasattr(e, "codigo_cliente") and not getattr(e, "codigo_cliente", None):
            e.codigo_cliente = codigo
        db.add(e); db.commit(); db.refresh(e)
        return e.id, getattr(e, "codigo_cliente", codigo)

    e = Emprendedor(usuario_id=usuario_id)
    if hasattr(e, "nombre"):        e.nombre = EMP_NOMBRE
    if hasattr(e, "descripcion"):   e.descripcion = EMP_DESC
    if hasattr(e, "codigo_cliente"): e.codigo_cliente = codigo
    if hasattr(e, "created_at"):    e.created_at = datetime.utcnow()
    db.add(e); db.commit(); db.refresh(e)
    return e.id, getattr(e, "codigo_cliente", codigo)


def upsert_servicios(db: Session, emp_id: int) -> list[Servicio]:
    out = []
    existing = {
        s.nombre.lower(): s
        for s in db.scalars(select(Servicio).where(Servicio.emprendedor_id == emp_id)).all()
    }
    for nombre, dur, precio in SERVICIOS_DEMO:
        s = existing.get(nombre.lower())
        if not s:
            s = Servicio(emprendedor_id=emp_id, nombre=nombre)
            db.add(s); db.flush()
        # asignaciones seguras
        if hasattr(s, "duracion_min"):
            s.duracion_min = dur
        elif hasattr(s, "duracion_minutos"):
            s.duracion_minutos = dur
        if hasattr(s, "precio"):
            s.precio = float(precio)
        if hasattr(s, "activo"):
            s.activo = True
        db.add(s); db.commit(); db.refresh(s)
        out.append(s)
    return out


def ensure_horarios(db: Session, emp_id: int):
    # Inserta si no existe la misma combinación (dia_semana, inicio, fin)
    for dia, ini, fin in BLOQUES_HORARIOS:
        exists = db.scalar(
            select(func.count()).select_from(Horario).where(
                and_(
                    Horario.emprendedor_id == emp_id,
                    Horario.dia_semana == dia,
                    Horario.inicio == ini,
                    Horario.fin == fin,
                )
            )
        )
        if exists:
            continue
        h = Horario(
            emprendedor_id=emp_id,
            dia_semana=dia,
            inicio=ini,   # objetos time()
            fin=fin,      # objetos time()
        )
        # si tu modelo además tiene intervalo_min/activo, setealo acá:
        if hasattr(h, "intervalo_min"): h.intervalo_min = 30
        if hasattr(h, "activo"):        h.activo = True
        db.add(h)
    db.commit()


# ===== creación de turnos con campos opcionales =====
def create_turno(db: Session, emp_id: int, servicio: Servicio, inicio: datetime, cliente: str,
                 estado: str = "confirmado", nota: str = ""):
    # calcular fin según duración del servicio
    dur = 30
    if hasattr(servicio, "duracion_min") and getattr(servicio, "duracion_min", None):
        dur = int(servicio.duracion_min)
    elif hasattr(servicio, "duracion_minutos") and getattr(servicio, "duracion_minutos", None):
        dur = int(servicio.duracion_minutos)
    fin = inicio + timedelta(minutes=dur)

    # Construcción SOLO con campos base garantizados
    t = Turno(
        emprendedor_id=emp_id,
        servicio_id=servicio.id,
        inicio=inicio,
        fin=fin,
    )

    # Set opcionales según exista en tu modelo
    if hasattr(t, "estado"):
        t.estado = estado
    # distintos nombres que he visto en tus dumps
    if hasattr(t, "cliente_nombre"):
        t.cliente_nombre = cliente
    if hasattr(t, "cliente_contacto"):
        t.cliente_contacto = ""  # opcional
    if hasattr(t, "notas"):
        t.notas = nota
    if hasattr(t, "nota"):
        t.nota = nota
    if hasattr(t, "precio_aplicado") and hasattr(servicio, "precio"):
        try:
            t.precio_aplicado = float(getattr(servicio, "precio", 0) or 0)
        except Exception:
            t.precio_aplicado = 0

    if hasattr(t, "created_at"):
        t.created_at = datetime.utcnow()

    db.add(t)
    # no commit acá; lo hace el caller


# ===== main =====
def main():
    db = SessionLocal()
    try:
        # 1) Usuario EMPRENDEDOR
        uid_emp = ensure_user(
            db,
            email=EMP_EMAIL, password=EMP_PASS,
            nombre="Juan", apellido="Pérez", rol="emprendedor"
        )

        # 2) Emprendedor + código público
        emp_id, codigo = ensure_emprendedor(db, usuario_id=uid_emp)
        print(f"[OK] Emprendedor id={emp_id} · código={codigo}")

        # 3) Servicios
        servicios = upsert_servicios(db, emp_id)
        print(f"[OK] Servicios cargados: {len(servicios)}")

        # 4) Horarios (objetos time)
        ensure_horarios(db, emp_id)
        print("[OK] Horarios comerciales listos")

        # 5) Usuario CLIENTE
        uid_cli = ensure_user(
            db,
            email=CLI_EMAIL, password=CLI_PASS,
            nombre=CLI_NOMBRE, apellido=CLI_APELLIDO, rol="cliente"
        )
        print(f"[OK] Cliente id={uid_cli} · email={CLI_EMAIL}")

        # 6) Turnos de ejemplo (2 próximos días)
        today = date.today()
        muestras = [
            (today + timedelta(days=1), time(16, 0)),
            (today + timedelta(days=2), time(11, 30)),
        ]
        for fch, hhmm in muestras:
            s = random.choice(servicios)
            ini = datetime.combine(fch, hhmm)
            create_turno(db, emp_id, s, ini, cliente="Cliente Demo", estado="confirmado")

        db.commit()
        print("[OK] Turnos demo creados (futuros).")

        print("\nCredenciales:")
        print(f"  Emprendedor  -> {EMP_EMAIL} / {EMP_PASS}")
        print(f"  Cliente      -> {CLI_EMAIL} / {CLI_PASS}")
        print("\nCódigo público para /reservar/:", codigo)

    finally:
        db.close()


if __name__ == "__main__":
    main()
