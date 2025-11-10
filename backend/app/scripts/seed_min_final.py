# app/scripts/seed_realista.py
from __future__ import annotations
from datetime import datetime, date, time, timedelta
import random
from typing import Iterable

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app import models


# ===================== Config global =====================
ADMIN_EMAIL = "admin@demo.com"
ADMIN_PASS  = "admin"

# 12 dueños/emprendedores (uno por cada item)
OWNERS = [
    # (email, pass, nombre_emprendimiento, rubro, descripcion_corta)
    ("pelu1@demo.com",  "emprendedor", "Barbería Centro",     "Peluquería",       "Cortes y barba sin vueltas."),
    ("nails@demo.com",  "emprendedor", "Uñas & Spa",          "Manicuría",        "Esmaltado y spa de manos."),
    ("fit@demo.com",    "emprendedor", "Estudio Fitness",     "Gimnasio",         "Clases reducidas y planes."),
    ("foto@demo.com",   "emprendedor", "Foto Flash",          "Fotografía",       "Sesiones rápidas y eventos."),
    ("vet@demo.com",    "emprendedor", "Vet Norte",           "Veterinaria",      "Cuidado integral de mascotas."),
    ("dental@demo.com", "emprendedor", "Odonto Smile",        "Odontología",      "Turnos puntuales, sin espera."),
    ("spa@demo.com",    "emprendedor", "Spa Relajar",         "Spa/Estética",     "Masajes y faciales express."),
    ("bike@demo.com",   "emprendedor", "BikeFix Taller",      "Bicicletería",     "Service rápido y seguro."),
    ("tec@demo.com",    "emprendedor", "TecnoHelp",           "Servicio Técnico", "Reparaciones en el día."),
    ("chef@demo.com",   "emprendedor", "Chef a Domicilio",    "Gastronomía",      "Menús semanales a medida."),
    ("music@demo.com",  "emprendedor", "Estudio Sonar",       "Música",           "Grabación y mezcla rápida."),
    ("art@demo.com",    "emprendedor", "Taller Creativo",     "Arte/Diseño",      "Clases y encargos pequeños."),
]

RUBROS = sorted({r for *_, r, _ in OWNERS})

# Servicios por rubro (nombre, dur_min, precio_ARS)
SERVICIOS_RUBRO = {
    "Peluquería": [
        ("Corte clásico", 30, 9000),
        ("Corte + barba", 45, 14000),
        ("Color corto",   60, 22000),
        ("Peinado",       30, 8000),
    ],
    "Manicuría": [
        ("Esmaltado semipermanente", 45, 12000),
        ("Kapping",                   60, 18000),
        ("Spa de manos",              30, 9000),
    ],
    "Gimnasio": [
        ("Clase funcional", 60, 6000),
        ("Personalizado",   45, 9000),
        ("Evaluación",      30, 5000),
    ],
    "Fotografía": [
        ("Sesión express", 30, 15000),
        ("Sesión estudio", 60, 30000),
        ("Eventos",        90, 50000),
    ],
    "Veterinaria": [
        ("Consulta general", 30, 12000),
        ("Vacunación",       20, 9000),
        ("Control anual",    30, 11000),
    ],
    "Odontología": [
        ("Control",          20, 10000),
        ("Limpieza",         40, 20000),
        ("Blanqueamiento",   60, 45000),
    ],
    "Spa/Estética": [
        ("Masaje descontracturante", 45, 18000),
        ("Limpieza facial",          40, 17000),
        ("Reflexología",             30, 15000),
    ],
    "Bicicletería": [
        ("Service básico",  45, 15000),
        ("Ajuste general",  30, 11000),
        ("Cambio cables",   40, 13000),
    ],
    "Servicio Técnico": [
        ("Diagnóstico",     30, 8000),
        ("Reparación leve", 60, 22000),
        ("Mantenimiento",   45, 16000),
    ],
    "Gastronomía": [
        ("Menú semanal",    30, 12000),
        ("Evento chico",    90, 60000),
        ("Clase cocina",    60, 20000),
    ],
    "Música": [
        ("Grabación 1 hora", 60, 25000),
        ("Mezcla track",     45, 20000),
        ("Master simple",    30, 18000),
    ],
    "Arte/Diseño": [
        ("Ilustración chica", 45, 18000),
        ("Logo express",      60, 30000),
        ("Clase dibujo",      60, 12000),
    ],
}

# Bloques horarios (L a S): 9–13 y 16–20; Sáb 9–14
BLOQUES = [
    *[(d, time(9, 0),  time(13, 0)) for d in (1,2,3,4,5)],
    *[(d, time(16, 0), time(20, 0)) for d in (1,2,3,4,5)],
    (6, time(9, 0), time(14, 0)),
]

CLIENTES = [f"Cliente {x}" for x in list("ABCDEFGHIJKLMNOPQRSTUVXYZ")] + \
           [f"Usuario {i}" for i in range(1, 31)]  # 30 más

TARGET_INGRESOS_MES = 1_000_000     # objetivo aprox. por emprendimiento
TOL = 0.15                          # ±15% (rubros baratos vs caros)


# ===================== Helpers comunes =====================
def sha256(s: str) -> str:
    import hashlib
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def set_pwd(u: models.Usuario, plain: str):
    # Mismo enfoque simple que tu seed previo
    h = sha256(plain)
    if hasattr(u, "hashed_password"):
        u.hashed_password = h
    elif hasattr(u, "password_hash"):
        u.password_hash = h

def month_bounds(y: int, m: int) -> tuple[date, date]:
    start = date(y, m, 1)
    if m == 12:
        end = date(y, 12, 31)
    else:
        end = date(y, m + 1, 1) - timedelta(days=1)
    return start, end

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
    u.rol = "admin"; u.is_active = True
    set_pwd(u, ADMIN_PASS)
    db.add(u); db.commit(); db.refresh(u)
    return u

def codigo_unico(db: Session, preferido: str | None = None) -> str:
    abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    if preferido:
        used = db.scalar(select(func.count()).select_from(models.Emprendedor)
                         .where(models.Emprendedor.codigo_cliente == preferido))
        if not used:
            return preferido
    for _ in range(64):
        cand = "".join(random.choice(abc) for _ in range(7))
        used = db.scalar(select(func.count()).select_from(models.Emprendedor)
                         .where(models.Emprendedor.codigo_cliente == cand))
        if not used:
            return cand
    return "EMP" + "".join(random.choice("23456789") for _ in range(5))

def ensure_owner_and_emp(
    db: Session,
    email: str, pwd: str,
    nombre_emp: str, rubro: str, desc_corta: str
) -> tuple[models.Usuario, models.Emprendedor]:
    # Usuario dueño
    u = db.scalar(select(models.Usuario).where(models.Usuario.email == email))
    if not u:
        u = models.Usuario(
            email=email, nombre="Dueño", apellido="Demo",
            rol="emprendedor", is_active=True, created_at=datetime.utcnow()
        )
    u.rol = "emprendedor"; u.is_active = True; set_pwd(u, pwd)
    db.add(u); db.commit(); db.refresh(u)

    # Emprendedor
    e = db.scalar(select(models.Emprendedor).where(models.Emprendedor.usuario_id == u.id))
    if not e:
        e = models.Emprendedor(
            usuario_id=u.id,
            nombre=nombre_emp,
            descripcion=desc_corta,
            rubro=rubro,
            codigo_cliente=codigo_unico(db, None),
            created_at=datetime.utcnow(),
        )
    else:
        e.nombre = e.nombre or nombre_emp
        e.descripcion = e.descripcion or desc_corta
        e.rubro = e.rubro or rubro
        e.codigo_cliente = e.codigo_cliente or codigo_unico(db, None)
    db.add(e); db.commit(); db.refresh(e)

    return u, e

def upsert_servicios(db: Session, emp_id: int, rubro: str) -> list[models.Servicio]:
    defs = SERVICIOS_RUBRO.get(rubro, [])
    existentes = {
        s.nombre.lower(): s for s in db.scalars(
            select(models.Servicio).where(models.Servicio.emprendedor_id == emp_id)
        ).all()
    }
    out = []
    for nombre, dur, precio in defs[:6]:  # limitar 3–6 servicios por rubro
        key = nombre.lower()
        if key in existentes:
            s = existentes[key]
            s.duracion_min = int(dur)
            s.precio = float(precio)
            s.activo = True
        else:
            s = models.Servicio(
                emprendedor_id=emp_id,
                nombre=nombre,
                duracion_min=int(dur),
                precio=float(precio),
                activo=True,
            )
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

def dur(svc: models.Servicio) -> int:
    return int(getattr(svc, "duracion_min", 30) or 30)

def precio(svc: models.Servicio) -> int:
    return int(getattr(svc, "precio", 0) or 0)

def generar_mes(
    db: Session,
    emp: models.Emprendedor,
    servicios: list[models.Servicio],
    y: int, m: int,
    objetivo_aprox=TARGET_INGRESOS_MES
) -> dict:
    first, last = month_bounds(y, m)

    # limpiar turnos del mes para este emp
    ini = datetime(first.year, first.month, first.day, 0, 0, 0)
    fin = datetime(last.year, last.month, last.day, 23, 59, 59)
    for t in db.scalars(
        select(models.Turno).where(
            and_(models.Turno.emprendedor_id == emp.id,
                 models.Turno.inicio >= ini,
                 models.Turno.inicio <= fin)
        )
    ).all():
        db.delete(t)
    db.commit()

    ingresos = 0
    confirmados = 0
    cancelados = 0

    # densidad por rubro (más barata → más turnos cortos; cara → menos)
    random.seed(hash(emp.codigo_cliente) % 10_000)
    pesos = [max(1, 10 - i) for i, _ in enumerate(servicios)]
    pesos[0] += 2  # hacer más probable el servicio 0

    current = first
    while current <= last:
        # L-S (0=Lu … 6=Do → usamos 0..5)
        if current.weekday() in [0,1,2,3,4,5]:
            # 3–8 turnos confirmados
            slots = random.randint(3, 8)
            hora, minuto = 9, 0
            for _ in range(slots):
                svc = random.choices(servicios, weights=pesos, k=1)[0]
                inicio = datetime(current.year, current.month, current.day, hora, minuto)
                fin_t = inicio + timedelta(minutes=dur(svc))
                # crear turno confirmado
                t = models.Turno(
                    emprendedor_id=emp.id,
                    servicio_id=svc.id,
                    inicio=inicio,
                    fin=fin_t,
                    estado="confirmado",
                    cliente_nombre=random.choice(CLIENTES),
                    cliente_contacto="-",
                    created_at=datetime.utcnow(),
                )
                db.add(t)
                ingresos += precio(svc)
                confirmados += 1

                # avanzar
                salto = random.choice([45, 60, 75, 90])
                total = hora * 60 + minuto + salto
                hora, minuto = divmod(total, 60)
                if hora >= 20:  # fuera de jornada
                    break

            # 15–25% de los días con 1 cancelado a media tarde
            if random.random() < random.uniform(0.15, 0.25):
                svc = random.choice(servicios)
                inicio = datetime(current.year, current.month, current.day, 17, 0)
                fin_t = inicio + timedelta(minutes=dur(svc))
                t = models.Turno(
                    emprendedor_id=emp.id,
                    servicio_id=svc.id,
                    inicio=inicio,
                    fin=fin_t,
                    estado="cancelado",
                    cliente_nombre=random.choice(CLIENTES),
                    cliente_contacto="-",
                    created_at=datetime.utcnow(),
                )
                db.add(t)
                cancelados += 1

        current += timedelta(days=1)

    db.commit()

    # ajuste fino hacia objetivo_min
    objetivo_min = int(objetivo_aprox * (1 - TOL))
    if ingresos < objetivo_min:
        servicios_desc = sorted(servicios, key=precio, reverse=True)
        d = last
        while ingresos < objetivo_min and d >= first:
            if d.weekday() in [0,1,2,3,4,5]:
                hora, minuto = 16, 0
                for svc in servicios_desc:
                    inicio = datetime(d.year, d.month, d.day, hora, minuto)
                    fin_t = inicio + timedelta(minutes=dur(svc))
                    t = models.Turno(
                        emprendedor_id=emp.id,
                        servicio_id=svc.id,
                        inicio=inicio,
                        fin=fin_t,
                        estado="confirmado",
                        cliente_nombre=random.choice(CLIENTES),
                        cliente_contacto="-",
                        created_at=datetime.utcnow(),
                    )
                    db.add(t)
                    ingresos += precio(svc)
                    confirmados += 1

                    total = hora * 60 + minuto + 60
                    hora, minuto = divmod(total, 60)
                    if ingresos >= objetivo_min or hora >= 20:
                        break
            d -= timedelta(days=1)
        db.commit()

    return {
        "ingresos": ingresos,
        "confirmados": confirmados,
        "cancelados": cancelados,
        "desde": first,
        "hasta": last,
    }


# ===================== Run principal =====================
def main():
    db = SessionLocal()
    try:
        admin = ensure_admin(db)
        print(f"[OK] Admin: {ADMIN_EMAIL} / {ADMIN_PASS}")

        resumen_global = []

        # Crear 12 emprendedores de 10 rubros con servicios/horarios
        empre_objs = []
        for email, pwd, nombre, rubro, desc in OWNERS:
            owner, emp = ensure_owner_and_emp(db, email, pwd, nombre, rubro, desc)
            ensure_horarios(db, emp.id)
            servicios = upsert_servicios(db, emp.id, rubro)
            empre_objs.append((emp, servicios))

        # Mes actual y dos anteriores
        today = date.today()
        mm = [(today.year, today.month)]
        # retroceder 1 y 2 meses
        y1, m1 = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        y2, m2 = (y1 - 1, 12) if m1 == 1 else (y1, m1 - 1)
        mm.extend([(y1, m1), (y2, m2)])

        for emp, servicios in empre_objs:
            tot_ing = 0; tot_ok = 0; tot_cancel = 0
            for y, m in mm:
                r = generar_mes(db, emp, servicios, y, m, objetivo_aprox=TARGET_INGRESOS_MES)
                tot_ing += r["ingresos"]; tot_ok += r["confirmados"]; tot_cancel += r["cancelados"]
            resumen_global.append((emp, tot_ing, tot_ok, tot_cancel))

        # Resumen
        print("=======================================")
        print(" SEED REALISTA listo")
        print("  Admin:")
        print(f"    Email: {ADMIN_EMAIL}  Pass: {ADMIN_PASS} (rol=admin)")
        print("  Emprendedores creados:")
        for emp, tot_ing, tot_ok, tot_cancel in resumen_global:
            print(f"   - {emp.nombre} [{emp.rubro}]  Código: {emp.codigo_cliente}")
            print(f"       Turnos OK: {tot_ok} · Cancelados: {tot_cancel} · Ingresos aprox: ARS {tot_ing:,}".replace(",", "."))
        print("  Meses poblados: actual y dos anteriores")
        print("  Tip: Probar /emprendedores/  y  /emprendedores/rubros  en el front.")
        print("=======================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
