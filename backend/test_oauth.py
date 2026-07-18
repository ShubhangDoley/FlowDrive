"""
OAuth smoke tests — runs against the live server on localhost:8000.
Tests everything except the actual browser login (which requires user interaction).

Run with:  conda run -n dev python test_oauth.py
"""

import sys
import httpx

BASE = "http://localhost:8000"
client = httpx.Client(base_url=BASE, follow_redirects=False)

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
errors = 0


def check(label, condition, detail=""):
    global errors
    if condition:
        print(f"  {PASS} {label}")
    else:
        print(f"  {FAIL} {label}" + (f" — {detail}" if detail else ""))
        errors += 1


print("\n══ FlowDrive OAuth Tests ══\n")

# ── 1. Health ──────────────────────────────────────────────────────────────────
print("1. Server health")
r = client.get("/health")
check("Status 200", r.status_code == 200, r.text)
body = r.json()
check("Database connected", body.get("database") == "connected", str(body))

# ── 2. /me without session ────────────────────────────────────────────────────
print("\n2. GET /api/v1/auth/me (unauthenticated)")
r = client.get("/api/v1/auth/me")
check("Returns 401", r.status_code == 401, f"got {r.status_code}")
check("Error detail present", "detail" in r.json(), r.text)

# ── 3. POST /logout without session ───────────────────────────────────────────
print("\n3. POST /api/v1/auth/logout (no session)")
r = client.post("/api/v1/auth/logout")
check("Returns 200", r.status_code == 200, f"got {r.status_code}")

# ── 4. GET /google/login → redirect to Google ─────────────────────────────────
print("\n4. GET /api/v1/auth/google/login")
r = client.get("/api/v1/auth/google/login")
check("Returns redirect (302/307)", r.status_code in (302, 307), f"got {r.status_code}")
loc = r.headers.get("location", "")
check("Location points to accounts.google.com", "accounts.google.com" in loc, loc[:80])
check("Contains client_id param", "client_id=" in loc, loc[:80])
check("Requests offline access", "access_type=offline" in loc or "offline" in loc, "")
check("Contains drive.file scope", "drive.file" in loc, "")
check("Contains state param (CSRF)", "state=" in loc, "")

# ── 5. File endpoints → 401 without session ────────────────────────────────────
print("\n5. File endpoints (unauthenticated → 401)")
r = client.get("/api/v1/files")
check("GET /files → 401", r.status_code == 401, f"got {r.status_code}")

r = client.delete("/api/v1/files/nonexistent-id")
check("DELETE /files/{id} → 401", r.status_code == 401, f"got {r.status_code}")

# ── 6. Docs available in dev mode ─────────────────────────────────────────────
print("\n6. API docs")
r = client.get("/docs")
check("Swagger UI accessible (/docs)", r.status_code == 200, f"got {r.status_code}")

# ── 7. CORS headers ────────────────────────────────────────────────────────────
print("\n7. CORS (preflight from frontend origin)")
r = client.options(
    "/api/v1/auth/me",
    headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    },
)
# CORS will either allow it (200) or pass through (depends on middleware order)
check(
    "CORS origin header present",
    "access-control-allow-origin" in r.headers,
    str(dict(r.headers)),
)

# ── Summary ────────────────────────────────────────────────────────────────────
print(f"\n{'═'*40}")
if errors == 0:
    print(f"\033[92m  All tests passed!\033[0m")
    print(f"\n  → Open http://localhost:8000/api/v1/auth/google/login in your browser")
    print(f"    to complete the full OAuth flow.\n")
else:
    print(f"\033[91m  {errors} test(s) failed.\033[0m\n")

client.close()
sys.exit(0 if errors == 0 else 1)
