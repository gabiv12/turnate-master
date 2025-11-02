from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..models import Emprendedor, Usuario
from ..schemas import EmprendedorCreate, EmprendedorUpdate, EmprendedorBase
from ..deps import get_db, get_current_user

router = APIRouter(prefix="/emprendedores", tags=["emprendedores"])

@router.get("/by-codigo/{codigo}", response_model=EmprendedorBase)
def by_codigo(codigo: str, db: Session = Depends(get_db)):
    e = db.query(Emprendedor).filter(Emprendedor.codigo_cliente == codigo).first()
    if not e:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    return e

@router.post("", response_model=EmprendedorBase, status_code=201)
def crear(payload: EmprendedorCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if db.query(Emprendedor).filter(Emprendedor.usuario_id == user.id).first():
        raise HTTPException(status_code=409, detail="Ya tenés un emprendimiento")
    e = Emprendedor(usuario_id=user.id, nombre=payload.nombre, descripcion=payload.descripcion, activo=True)
    db.add(e); db.commit(); db.refresh(e)
    return e

@router.get("/{emp_id}", response_model=EmprendedorBase)
def obtener(emp_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    e = db.query(Emprendedor).filter(Emprendedor.id == emp_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="No existe")
    if e.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    return e

@router.put("/{emp_id}", response_model=EmprendedorBase)
def actualizar(emp_id: int, payload: EmprendedorUpdate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    e = db.query(Emprendedor).filter(Emprendedor.id == emp_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="No existe")
    if e.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit(); db.refresh(e)
    return e

@router.post("/{emp_id}/generar-codigo")
def generar_codigo(emp_id: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    e = db.query(Emprendedor).filter(Emprendedor.id == emp_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="No existe")
    if e.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    import random, string
    code = "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    while db.query(Emprendedor).filter(Emprendedor.codigo_cliente == code).first():
        code = "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    e.codigo_cliente = code
    db.commit(); db.refresh(e)
    return {"codigo_cliente": e.codigo_cliente}
