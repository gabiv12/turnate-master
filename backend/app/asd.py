# scripts/patch_sqlite.py
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "dev.db")
DB_PATH = os.path.abspath(DB_PATH)

print("Usando DB:", DB_PATH)
con = sqlite3.connect(DB_PATH)
cur = con.cursor()

def has_column(table, col):
    cur.execute(f"PRAGMA table_info('{table}')")
    return any(r[1] == col for r in cur.fetchall())

def safe_exec(sql):
    try:
        cur.execute(sql)
        print("OK:", sql)
    except Exception as e:
        print("SKIP:", sql, "==>", e)

# 1) usuarios.rol
if not has_column("usuarios", "rol"):
    safe_exec("ALTER TABLE usuarios ADD COLUMN rol VARCHAR(32) NOT NULL DEFAULT 'user'")

# 2) emprendedores.codigo
if not has_column("emprendedores", "codigo"):
    safe_exec("ALTER TABLE emprendedores ADD COLUMN codigo VARCHAR(32)")
    safe_exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_emprendedores_codigo ON emprendedores(codigo)")

con.commit()
con.close()
print("Parche terminado.")
