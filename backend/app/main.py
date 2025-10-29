# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, UPLOADS_DIR
from app.database import Base, engine, SessionLocal
from app import models

# Routers (si alguno no existe en tu repo, lo agregamos en mensajes siguientes)
from app.auth import router as auth_router
from app.routers.usuarios import router as usuarios_router
from app.routers.emprendedores import router as emprendedores_router
from app.routers.servicios import router as servicios_router
from app.routers.horarios import router as horarios_router
from app.routers.turnos import router as turnos_router
from app.routers.publico import router as publico_router  # (nuevo en este mensaje)

app = FastAPI(title="Turnate API", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static (para servir logos/avatares)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Crear tablas (respeta tu DB existente, no borra nada)
Base.metadata.create_all(bind=engine)

# Health
@app.get("/health")
def health():
    return {"ok": True}

# Routers
app.include_router(auth_router)
app.include_router(usuarios_router)
app.include_router(emprendedores_router)
app.include_router(servicios_router)
app.include_router(horarios_router)
app.include_router(turnos_router)
app.include_router(publico_router)
