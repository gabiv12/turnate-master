from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..models import Emprendedor, Servicio, Horario, Turno
from ..schemas import EmprendedorBase, ServicioOut, HorarioOut, AgendaOut, TurnoCreate, TurnoOut
from ..deps import get_db

router = APIRouter(prefix="/publico", tags=["publico"])

def _parse_dt(s: str | None) -> datetime | None:
    if not s: return None
    try: return datetime.fromisoformat(s.replace("Z", ""))
    except: return None

@router.get("/emprendedores/by-codigo/{codigo}", response_model=EmprendedorBase)
def get_by_code(codigo: str, db: Session = Depends(get_db)):
    e = db.query(Emprendedor).filter(Emprendedor.codigo_cliente == codigo).first()
    if not e: raise HTTPException(status_code=404, detail="Código no encontrado")
    return e

@router.get("/servicios/{emp_id}", response_model=list[ServicioOut])
def servicios(emp_id: int, db: Session = Depends(get_db)):
    return db.query(Servicio).filter(Servicio.emprendedor_id == emp_id, Servicio.activo == True).all()

@router.get("/horarios/{emp_id}", response_model=list[HorarioOut])
def horarios(emp_id: int, db: Session = Depends(get_db)):
    return db.query(Horario).filter(Horario.emprendedor_id == emp_id, Horario.activo == True).all()

@router.get("/turnos/{emp_id}", response_model=list[TurnoOut])
def turnos(emp_id: int, desde: str | None = None, hasta: str | None = None, db: Session = Depends(get_db)):
    d1 = _parse_dt(desde); d2 = _parse_dt(hasta)
    q = db.query(Turno).filter(Turno.emprendedor_id == emp_id, Turno.estado == "reservado")
    if d1: q = q.filter(Turno.inicio >= d1)
    if d2: q = q.filter(Turno.inicio <= d2)
    return q.order_by(Turno.inicio.asc()).all()

@router.get("/agenda", response_model=AgendaOut)
def agenda(emprendedor_id: int, desde: str, hasta: str, db: Session = Depends(get_db)):
    # (Opcional) acá podrías calcular los slots libres en base a horarios + turnos existentes
    # Para simplificar devolvemos lista vacía y tu front hace fallback con /horarios + /turnos
    return {"slots": []}

# (opcional) permitir crear sin login
@router.post("/turnos", response_model=TurnoOut, status_code=201)
def crear_publico(payload: TurnoCreate, db: Session = Depends(get_db)):
    e = db.query(Emprendedor).filter(Emprendedor.id == payload.emprendedor_id).first()
    if not e: raise HTTPException(status_code=404, detail="Emprendedor inexistente")
    s = db.query(Servicio).filter(Servicio.id == payload.servicio_id, Servicio.emprendedor_id == e.id, Servicio.activo == True).first()
    if not s: raise HTTPException(status_code=400, detail="Servicio inválido")
    inicio = payload.inicio
    fin = inicio + timedelta(minutes=int(s.duracion_min or 30))
    ya = db.query(Turno).filter(
        Turno.emprendedor_id == e.id,
        Turno.servicio_id == s.id,
        Turno.cliente_contacto == payload.cliente_contacto.strip(),
        Turno.estado == "reservado"
    ).first()
    if ya:
        raise HTTPException(status_code=409, detail="Ya tenés una reserva activa para este servicio")
    choque = db.query(Turno).filter(Turno.emprendedor_id == e.id, Turno.estado == "reservado",
                                    Turno.inicio < fin, Turno.fin > inicio).first()
    if choque:
        raise HTTPException(status_code=409, detail="Horario no disponible")
    t = Turno(
        emprendedor_id=e.id, servicio_id=s.id,
        inicio=inicio, fin=fin,
        cliente_nombre=payload.cliente_nombre.strip(),
        cliente_contacto=payload.cliente_contacto.strip(),
        notas=(payload.notas or "").strip() or None,
        estado="reservado",
    )
    db.add(t); db.commit(); db.refresh(t)
    return t
