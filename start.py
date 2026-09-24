"""Start Loot Ledger with one command.

    python start.py            build the page if needed, serve everything on
                               http://localhost:8501 and open the browser
    python start.py --dev      API with auto-reload on :8000 plus the Vite dev
                               server on :5173, for working on the code

Options:
    --host 0.0.0.0             listen beyond this machine (e.g. over Tailscale);
                               set LOOT_LEDGER_PASSWORD before doing this
    --port 8501                port for the normal mode
    --no-browser               do not open a browser tab
    --rebuild                  rebuild the page even if it looks current

The normal mode is a single process: FastAPI serves the JSON API under /api
and the built React page from frontend/dist. The page is rebuilt only when a
file under frontend/ is newer than the last build, so an ordinary start costs
no build time at all.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE / "frontend"
DIST = FRONTEND / "dist"
# Inputs that change what the build produces. node_modules and dist itself
# are excluded; so is anything outside frontend/.
BUILD_INPUTS = ["src", "public", "index.html", "package.json", "package-lock.json",
                "vite.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json"]


def _npm() -> str:
    npm = shutil.which("npm")
    if not npm:
        sys.exit("Node.js is needed to build the page: install it from https://nodejs.org "
                 "and run this again.")
    return npm


def _newest_input() -> float:
    newest = 0.0
    for name in BUILD_INPUTS:
        path = FRONTEND / name
        if path.is_file():
            newest = max(newest, path.stat().st_mtime)
        elif path.is_dir():
            for f in path.rglob("*"):
                if f.is_file():
                    newest = max(newest, f.stat().st_mtime)
    return newest


def _needs_build() -> bool:
    built = DIST / "index.html"
    return not built.exists() or built.stat().st_mtime < _newest_input()


def _ensure_node_modules(npm: str) -> None:
    lock = FRONTEND / "package-lock.json"
    modules = FRONTEND / "node_modules"
    stamp = modules / ".package-lock.json"
    if not modules.exists() or (lock.exists() and stamp.exists()
                                and stamp.stat().st_mtime < lock.stat().st_mtime):
        print("Installing frontend packages…", flush=True)
        subprocess.run([npm, "ci" if lock.exists() else "install"], cwd=FRONTEND, check=True)


def build(force: bool = False) -> None:
    if not force and not _needs_build():
        return
    npm = _npm()
    _ensure_node_modules(npm)
    print("Building the page…", flush=True)
    subprocess.run([npm, "run", "build"], cwd=FRONTEND, check=True)


def _open_when_ready(url: str) -> None:
    """Poll the health check instead of guessing how long startup takes."""
    deadline = time.time() + 25
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/health", timeout=1) as res:
                if res.status == 200:
                    break
        except Exception:
            time.sleep(0.15)
    webbrowser.open(url)


def serve(host: str, port: int, open_browser: bool) -> None:
    import uvicorn

    shown = "localhost" if host in ("127.0.0.1", "0.0.0.0") else host
    url = f"http://{shown}:{port}"
    print(f"Loot Ledger is running at {url}  (Ctrl+C to stop)", flush=True)
    if open_browser:
        threading.Thread(target=_open_when_ready, args=(url,), daemon=True).start()
    uvicorn.run("api.main:app", host=host, port=port, log_level="warning")


def dev(host: str) -> None:
    npm = _npm()
    _ensure_node_modules(npm)
    api = subprocess.Popen([sys.executable, "-m", "uvicorn", "api.main:app", "--reload",
                            "--host", host, "--port", "8000"], cwd=HERE)
    web = subprocess.Popen([npm, "run", "dev", "--", "--host", host], cwd=FRONTEND)
    print("API on http://127.0.0.1:8000 · page on http://localhost:5173  (Ctrl+C to stop)",
          flush=True)
    try:
        while api.poll() is None and web.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for proc in (web, api):
            if proc.poll() is None:
                proc.terminate()


def main() -> None:
    parser = argparse.ArgumentParser(description="Start Loot Ledger.")
    parser.add_argument("--dev", action="store_true", help="run the API and Vite dev servers")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8501)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()

    os.chdir(HERE)
    if args.dev:
        dev(args.host)
        return
    build(force=args.rebuild)
    serve(args.host, args.port, open_browser=not args.no_browser)


if __name__ == "__main__":
    main()
