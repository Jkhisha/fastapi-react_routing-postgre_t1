from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
import psycopg2.extras

app = FastAPI()

# Allow your React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DB CONNECTION ----------
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="userdb",
            user="postgres",
            password="joytu"  # Replace with your actual password
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

# ---------- MODELS ----------
class LoginRequest(BaseModel):
    name: str

# ---------- ROUTES ----------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/login")
def login(req: LoginRequest):
    """
    Simple login: if name exists in users table, "log in".
    Returns user id, name, and permid array.
    """
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="DB connection failed")

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, name, permid FROM users WHERE name = %s", (req.name,))
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="User not found")

    # Example row: {"id": 1, "name": "Akash", "permid": [1,2,3,4]}
    return row

@app.get("/search")
def search(
    min_age: Optional[int] = Query(None, description="Minimum age filter"),
    current_id: int = Query(..., description="Logged-in user's ID for permission")
):
    """
    Returns users older than min_age (if provided), but only within current user's permid list.
    URL-driven: e.g. /search?current_id=1&min_age=30
    """
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=500, detail="DB connection failed")

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Get permission list for current user
    cur.execute("SELECT permid FROM users WHERE id = %s", (current_id,))
    perm_row = cur.fetchone()
    if not perm_row:
        cur.close()
        conn.close()
        raise HTTPException(status_code=401, detail="User not found")

    permitted_ids: List[int] = perm_row["permid"] or []

    # Build query
    # Only show rows within permitted IDs
    if min_age is None:
        query = "SELECT id, name, age, sex FROM users WHERE id = ANY(%s) ORDER BY id"
        params = (permitted_ids,)
    else:
        query = "SELECT id, name, age, sex FROM users WHERE age > %s AND id = ANY(%s) ORDER BY id"
        params = (min_age, permitted_ids)

    cur.execute(query, params)
    results = cur.fetchall()
    cur.close()
    conn.close()
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
