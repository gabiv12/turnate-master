from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..models import Turno, Emprendedor, Servicio, Usuario
from ..schemas import TurnoCreate, TurnoOut
from ..deps import get_db, get_current_user

router = APIRouter(prefix="/turnos", tags=["turnos"])

def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", ""))
    except Exception:
        return None

def _hay_choque(db: Session, emp_id: int, inicio: datetime, fin: datetime) -> bool:
    q = db.query(Turno).filter(
        Turno.emprendedor_id == emp_id,
        Turno.estado == "reservado",
        Turno.inicio < fin,
        Turno.fin > inicio,
    )
    return db.query(q.exists()).scalar()

@router.get("/mis", response_model=list[TurnoOut])
def mis_turnos(
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    e = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
    if not e:
        return []
    d1 = _parse_dt(desde)
    d2 = _parse_dt(hasta)
    q = db.query(Turno).filter(Turno.emprendedor_id == e.id)
    if d1: q = q.filter(Turno.inicio >= d1)
    if d2: q = q.filter(Turno.inicio <= d2)
    return q.order_by(Turno.inicio.asc()).all()

@router.get("", response_model=list[TurnoOut])
def listar(
    emprendedor_id: int | None = Query(default=None),
    desde: str | None = Query(default=None),
    hasta: str | None = Query(default=None),
    mine: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    if mine:
        e = db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first()
        if not e:
            return []
        emprendedor_id = e.id
    if not emprendedor_id:
        raise HTTPException(status_code=400, detail="Falta emprendedor_id")
    d1 = _parse_dt(desde)
    d2 = _parse_dt(hasta)
    q = db.query(Turno).filter(Turno.emprendedor_id == emprendedor_id)
    if d1: q = q.filter(Turno.inicio >= d1)
    if d2: q = q.filter(Turno.inicio <= d2)
    return q.order_by(Turno.inicio.asc()).all()

@router.get("/por-emprendedor/{emp_id}", response_model=list[TurnoOut])
def por_emprendedor(emp_id: int, desde: str | None = None, hasta: str | None = None,
                    db: Session = Depends(get_db)):
    d1 = _parse_dt(desde); d2 = _parse_dt(hasta)
    q = db.query(Turno).filter(Turno.emprendedor_id == emp_id)
    if d1: q = q.filter(Turno.inicio >= d1)
    if d2: q = q.filter(Turno.inicio <= d2)
    return q.order_by(Turno.inicio.asc()).all()

@router.post("", response_model=TurnoOut, status_code=201)
def crear(payload: TurnoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    e = db.query(Emprendedor).filter(Emprendedor.id == payload.emprendedor_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Emprendedor inexistente")
    # regla: dueño o público (si quisieras, acá exigirías que user sea dueño)
    s = db.query(Servicio).filter(Servicio.id == payload.servicio_id, Servicio.emprendedor_id == e.id, Servicio.activo == True).first()
    if not s:
        raise HTTPException(status_code=400, detail="Servicio inválido")
    inicio = payload.inicio
    fin = inicio + timedelta(minutes=int(s.duracion_min or 30))

    # 1 sola reserva activa por cliente/servicio/emprendedor
    ya = db.query(Turno).filter(
        Turno.emprendedor_id == e.id,
        Turno.servicio_id == s.id,
        Turno.cliente_contacto == payload.cliente_contacto.strip(),
        Turno.estado == "reservado"
    ).first()
    if ya:
        raise HTTPException(status_code=409, detail="Ya tenés una reserva activa para este servicio")

    if _hay_choque(db, e.id, inicio, fin):
        raise HTTPException(status_code=409, detail="Horario no disponible")

    t = Turno(
        emprendedor_id=e.id,
        servicio_id=s.id,
        inicio=inicio,
        fin=fin,
        cliente_nombre=payload.cliente_nombre.strip(),
        cliente_contacto=payload.cliente_contacto.strip(),
        notas=(payload.notas or "").strip() or None,
        estado="reservado",
    )
    db.add(t); db.commit(); db.refresh(t)
    return t
