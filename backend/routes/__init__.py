"""Route modules extracted from the monolithic server.py.

Each module exposes a `create_*_router(...)` factory returning an
APIRouter that server.py mounts under /api, plus (optionally) an
`init_*` coroutine invoked from the app startup event to seed data
and register background jobs.
"""
