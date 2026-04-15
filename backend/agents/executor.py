"""
Agent 4: Code Executor
Starts FastAPI (port 8001) + React (port 3001).
Auto-injects Node.js PATH on Windows so subprocess can always find npm.
"""
import os
import re
import sys
import time
import signal
import shutil
import subprocess
import urllib.request
import urllib.error

OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "output", "generated_app")
)

_running_procs: dict = {}

BACKEND_PORT   = 8001
FRONTEND_PORT  = 3001
HEALTH_TIMEOUT = 60
POLL_INTERVAL  = 1


# ── Fix Windows PATH immediately when module is imported ──────────────────────
def _fix_windows_path():
    """
    On Windows, inject all known Node.js install locations into os.environ["PATH"]
    so that every subprocess spawned by Python can find npm/node.
    This fixes the case where Python was launched from PowerShell which had a
    broken PATH, even when CMD shows npm correctly.
    """
    if sys.platform != "win32":
        return

    candidates = [
        r"C:\Program Files\nodejs",
        r"C:\Program Files (x86)\nodejs",
        os.path.expandvars(r"%APPDATA%\npm"),
        os.path.expandvars(r"%ProgramFiles%\nodejs"),
        os.path.expandvars(r"%ProgramFiles(x86)%\nodejs"),
        # nvm for Windows
        os.path.expandvars(r"%APPDATA%\nvm"),
        os.path.expandvars(r"%NVM_HOME%"),
        os.path.expandvars(r"%NVM_SYMLINK%"),
    ]

    current_path = os.environ.get("PATH", "")
    additions = []
    for c in candidates:
        if c and os.path.isdir(c) and c not in current_path:
            additions.append(c)

    if additions:
        os.environ["PATH"] = os.pathsep.join(additions) + os.pathsep + current_path


_fix_windows_path()


def _get_npm_cmd() -> str | None:
    """Return 'npm.cmd' path on Windows, 'npm' on Unix. None if not found."""
    if sys.platform == "win32":
        # Try shutil.which first (uses updated PATH)
        found = shutil.which("npm.cmd") or shutil.which("npm")
        if found:
            return found
        # Manual search in known locations
        for folder in [
            r"C:\Program Files\nodejs",
            r"C:\Program Files (x86)\nodejs",
            os.path.expandvars(r"%APPDATA%\nvm\v24.14.1"),
            os.path.expandvars(r"%APPDATA%\nvm\v22.0.0"),
            os.path.expandvars(r"%APPDATA%\nvm\v20.0.0"),
        ]:
            candidate = os.path.join(folder, "npm.cmd")
            if os.path.isfile(candidate):
                return candidate
        return None
    else:
        return shutil.which("npm")


def _get_node_cmd() -> str | None:
    if sys.platform == "win32":
        found = shutil.which("node")
        if found:
            return found
        for folder in [r"C:\Program Files\nodejs", r"C:\Program Files (x86)\nodejs"]:
            candidate = os.path.join(folder, "node.exe")
            if os.path.isfile(candidate):
                return candidate
        return None
    return shutil.which("node")


# ── Public API ────────────────────────────────────────────────────────────────

def stop_all():
    for name, proc in list(_running_procs.items()):
        try:
            if proc.poll() is None:
                if sys.platform == "win32":
                    proc.terminate()
                else:
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    except Exception:
                        proc.terminate()
        except Exception:
            pass
    _running_procs.clear()


def run(react_code: str, python_code: str) -> tuple:
    """
    Returns:
        (True,  "",      { backend_url, frontend_url })  on success
        (False, "error", {})                              on failure
    """
    stop_all()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Write Python backend
    py_path = os.path.join(OUTPUT_DIR, "app.py")
    with open(py_path, "w", encoding="utf-8") as f:
        f.write(python_code)

    # Auto-install Python packages
    ok, err = _install_python_packages(python_code)
    if not ok:
        return False, f"pip install failed:\n{err}", {}

    # Check if we have React code worth running
    if not react_code or not react_code.strip() or not _is_react(react_code):
        return _run_backend_only(py_path)

    # Check npm
    npm_cmd = _get_npm_cmd()
    if not npm_cmd:
        # Fallback: run backend only, tell user
        ok2, err2, result = _run_backend_only(py_path)
        if ok2:
            result["npm_missing"] = True
            return True, "", result
        return False, (
            "npm/Node.js not found even after PATH fix.\n"
            "Please restart VS Code after installing Node.js from https://nodejs.org"
        ), {}

    return _run_fullstack(react_code, py_path, npm_cmd)


# ── Mode helpers ──────────────────────────────────────────────────────────────

def _is_react(code: str) -> bool:
    signals = ["import React", "from 'react'", 'from "react"',
                "useState", "useEffect", "ReactDOM", "<div", "<App"]
    hits = sum(1 for s in signals if s in code)
    return hits >= 2


def _run_backend_only(py_path: str) -> tuple:
    ok, err, proc = _start_backend(os.path.dirname(py_path), py_path)
    if not ok:
        return False, err, {}
    _running_procs["backend"] = proc
    return True, "", {
        "backend_url":  f"http://localhost:{BACKEND_PORT}",
        "frontend_url": f"http://localhost:{BACKEND_PORT}",
        "mode": "backend_only",
    }


def _run_fullstack(react_code: str, py_path: str, npm_cmd: str) -> tuple:
    output_dir = os.path.dirname(py_path)

    # Write React scaffold
    react_path = os.path.join(output_dir, "App.jsx")
    pkg_path   = os.path.join(output_dir, "package.json")
    with open(react_path, "w", encoding="utf-8") as f:
        f.write(react_code)
    _write_react_scaffold(output_dir, react_path, pkg_path)

    # npm install
    ok, err = _npm_install(output_dir, npm_cmd)
    if not ok:
        return False, f"npm install failed:\n{err}", {}

    # Start FastAPI
    ok, err, bproc = _start_backend(output_dir, py_path)
    if not ok:
        return False, err, {}
    _running_procs["backend"] = bproc

    # Start React
    ok, err, fproc = _start_frontend(output_dir, npm_cmd)
    if not ok:
        stop_all()
        return False, err, {}
    _running_procs["frontend"] = fproc

    return True, "", {
        "backend_url":  f"http://localhost:{BACKEND_PORT}",
        "frontend_url": f"http://localhost:{FRONTEND_PORT}",
        "mode": "fullstack",
    }


# ── Python package installer ──────────────────────────────────────────────────

def _install_python_packages(python_code: str) -> tuple:
    PIP_MAP = {
        "fastapi":    "fastapi uvicorn[standard]",
        "uvicorn":    "uvicorn[standard]",
        "pydantic":   "pydantic",
        "sqlalchemy": "sqlalchemy",
        "aiofiles":   "aiofiles",
        "jose":       "python-jose[cryptography]",
        "passlib":    "passlib[bcrypt]",
        "PIL":        "Pillow",
        "cv2":        "opencv-python",
        "sklearn":    "scikit-learn",
        "dotenv":     "python-dotenv",
        "httpx":      "httpx",
        "requests":   "requests",
        "numpy":      "numpy",
        "pandas":     "pandas",
        "bs4":        "beautifulsoup4",
    }
    STDLIB = {
        "os","sys","re","json","time","datetime","math","random","uuid",
        "hashlib","base64","io","pathlib","typing","collections","itertools",
        "functools","asyncio","threading","subprocess","logging","copy",
        "string","enum","abc","dataclasses","contextlib","traceback",
        "urllib","http","email","html","xml","csv","sqlite3","signal",
        "shutil","tempfile","glob","fnmatch","inspect","importlib",
    }

    imports = re.findall(r"^\s*(?:import|from)\s+([\w]+)", python_code, re.MULTILINE)
    to_install = set()
    for mod in imports:
        if mod in STDLIB:
            continue
        pip_pkg = PIP_MAP.get(mod, mod)
        to_install.update(pip_pkg.split())

    if not to_install:
        return True, ""

    cmd = [sys.executable, "-m", "pip", "install", "--quiet"] + list(to_install)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return False, result.stderr
        return True, ""
    except Exception as e:
        return False, str(e)


# ── React scaffold writer ─────────────────────────────────────────────────────

def _write_react_scaffold(output_dir: str, react_path: str, pkg_path: str):
    import json as _json

    public_dir = os.path.join(output_dir, "public")
    src_dir    = os.path.join(output_dir, "src")
    os.makedirs(public_dir, exist_ok=True)
    os.makedirs(src_dir, exist_ok=True)

    shutil.copy(react_path, os.path.join(src_dir, "App.jsx"))

    index_html = os.path.join(public_dir, "index.html")
    if not os.path.exists(index_html):
        with open(index_html, "w") as f:
            f.write("""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Generated App</title></head>
<body><div id="root"></div></body>
</html>""")

    index_js = os.path.join(src_dir, "index.js")
    if not os.path.exists(index_js):
        with open(index_js, "w") as f:
            f.write("""import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
""")

    if not os.path.exists(pkg_path):
        pkg = {
            "name": "generated-app",
            "version": "1.0.0",
            "private": True,
            "dependencies": {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "react-scripts": "5.0.1"
            },
            "scripts": {
                "start": "react-scripts start",
                "build": "react-scripts build"
            },
            "browserslist": {
                "production": [">0.2%", "not dead"],
                "development": ["last 1 chrome version"]
            }
        }
        with open(pkg_path, "w") as f:
            _json.dump(pkg, f, indent=2)

    env_path = os.path.join(output_dir, ".env")
    with open(env_path, "w") as f:
        f.write(f"PORT={FRONTEND_PORT}\nBROWSER=none\nCI=false\n")


# ── npm install ───────────────────────────────────────────────────────────────

def _npm_install(output_dir: str, npm_cmd: str) -> tuple:
    node_modules = os.path.join(output_dir, "node_modules")
    if os.path.exists(node_modules):
        return True, ""

    env = _build_env()
    try:
        result = subprocess.run(
            [npm_cmd, "install", "--silent"],
            cwd=output_dir,
            capture_output=True,
            text=True,
            timeout=300,
            env=env,
        )
        if result.returncode != 0:
            return False, result.stderr or result.stdout
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "npm install timed out after 300s"
    except FileNotFoundError as e:
        return False, f"npm not found at {npm_cmd}: {e}"
    except Exception as e:
        return False, str(e)


# ── Start backend ─────────────────────────────────────────────────────────────

def _start_backend(output_dir: str, py_path: str) -> tuple:
    log_path = os.path.join(output_dir, "backend.log")
    log_file = open(log_path, "w")

    env = _build_env()

    try:
        kwargs = {}
        if sys.platform != "win32":
            kwargs["start_new_session"] = True
        else:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app:app",
             "--host", "0.0.0.0", "--port", str(BACKEND_PORT), "--reload"],
            cwd=output_dir,
            stdout=log_file,
            stderr=log_file,
            env=env,
            **kwargs,
        )
    except Exception as e:
        return False, f"Could not start backend: {e}", None

    ok, _ = _wait_for_url(f"http://localhost:{BACKEND_PORT}", HEALTH_TIMEOUT)
    if not ok:
        log_file.flush()
        try:
            with open(log_path) as lf:
                tail = lf.read()[-3000:]
        except Exception:
            tail = ""
        proc.terminate()
        return False, f"Backend did not start in {HEALTH_TIMEOUT}s.\nLog:\n{tail}", None

    return True, "", proc


# ── Start frontend ────────────────────────────────────────────────────────────

def _start_frontend(output_dir: str, npm_cmd: str) -> tuple:
    log_path = os.path.join(output_dir, "frontend.log")
    log_file = open(log_path, "w")

    env = _build_env()
    env["PORT"]    = str(FRONTEND_PORT)
    env["BROWSER"] = "none"
    env["CI"]      = "false"

    try:
        kwargs = {}
        if sys.platform != "win32":
            kwargs["start_new_session"] = True
        else:
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

        proc = subprocess.Popen(
            [npm_cmd, "start"],
            cwd=output_dir,
            stdout=log_file,
            stderr=log_file,
            env=env,
            **kwargs,
        )
    except Exception as e:
        return False, f"Could not start frontend: {e}", None

    ok, _ = _wait_for_url(f"http://localhost:{FRONTEND_PORT}", 120)
    if not ok:
        log_file.flush()
        try:
            with open(log_path) as lf:
                tail = lf.read()[-3000:]
        except Exception:
            tail = ""
        proc.terminate()
        return False, f"Frontend did not start in 120s.\nLog:\n{tail}", None

    return True, "", proc


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_env() -> dict:
    """
    Build a clean environment dict that always includes Node.js paths.
    This guarantees subprocesses can find npm/node even if Python was
    started from a terminal with a broken PATH (e.g. VS Code PowerShell).
    """
    env = os.environ.copy()

    if sys.platform == "win32":
        node_dirs = [
            r"C:\Program Files\nodejs",
            r"C:\Program Files (x86)\nodejs",
            os.path.expandvars(r"%APPDATA%\npm"),
            os.path.expandvars(r"%APPDATA%\nvm"),
        ]
        existing = env.get("PATH", "")
        extras = [d for d in node_dirs if d and os.path.isdir(d) and d not in existing]
        if extras:
            env["PATH"] = os.pathsep.join(extras) + os.pathsep + existing

    return env


def _wait_for_url(url: str, timeout: int) -> tuple:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True, ""
        except urllib.error.HTTPError:
            return True, ""
        except Exception:
            time.sleep(POLL_INTERVAL)
    return False, f"Timed out waiting for {url}"
