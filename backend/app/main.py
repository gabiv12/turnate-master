import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .models import Base, engine
from .routers import usuarios, emprendedores, turnos, publico
# (si ya tenés servicios/horarios/admin también los podés incluir)

logger = logging.getLogger("turnera.app")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | turnera.app | %(message)s")

app = FastAPI(title="Turnate API", version="1.0")

# CORS (ajustá orígenes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    logger.info("SQLite dev engine para create_all: sqlite:///./dev.db")
    Base.metadata.create_all(bind=engine)
    logger.info("Tablas listas (SQLite desarrollo).")

# Routers
app.include_router(usuarios.router)
app.include_router(emprendedores.router)
app.include_router(turnos.router)
app.include_router(publico.router)
