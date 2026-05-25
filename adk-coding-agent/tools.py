"""
Tools for the ADK-style coding agent.
Provides safe filesystem and shell access within the repo root.
"""
import os
import subprocess
import shutil
from pathlib import Path
from typing import Any

REPO_ROOT = Path(os.getenv("REPO_ROOT", "..")).resolve()

# Blocked directories and files
BLOCKED_DIRS = {
    ".env", ".env.*", ".git", "node_modules", ".next",
    ".tmp", "dist", "build", "private_keys", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".mypy_cache"
}

BLOCKED_PATTERNS = {".env", ".pem", ".key", ".secret", ".credentials"}

ALLOWED_COMMANDS = {
    "npm run build": ("npm", "run", "build"),
    "npm test": ("npm", "test"),
    "npm run lint": ("npm", "run", "lint"),
    "npx tsc --noEmit": ("npx", "tsc", "--noEmit"),
    "git diff": ("git", "diff"),
    "git status": ("git", "status"),
    "git diff --stat": ("git", "diff", "--stat"),
}


def safe_path(path: str) -> Path:
    """
    Resolve a path relative to REPO_ROOT and verify it stays inside.
    Raises ValueError if path is blocked or escapes repo root.
    """
    if not path:
        raise ValueError("Empty path provided")

    # Block absolute paths
    if Path(path).is_absolute():
        raise ValueError(f"Absolute paths not allowed: {path}")

    # Resolve relative to repo root
    full_path = (REPO_ROOT / path).resolve()

    # Check it didn't escape
    try:
        full_path.relative_to(REPO_ROOT)
    except ValueError:
        raise ValueError(f"Path escapes repo root: {path}")

    # Check blocked names
    parts = full_path.parts
    for part in parts:
        if part in BLOCKED_DIRS:
            raise ValueError(f"Blocked directory: {part}")
        for pattern in BLOCKED_PATTERNS:
            if pattern in part:
                raise ValueError(f"Blocked file pattern: {pattern}")

    return full_path


def _is_binary(path: Path) -> bool:
    """Check if file appears to be binary."""
    try:
        with open(path, "rb") as f:
            chunk = f.read(1024)
            return b"\x00" in chunk
    except Exception:
        return True


def list_tree(path: str = ".", max_depth: int = 3) -> dict:
    """Return a file tree skipping blocked directories."""
    try:
        root = safe_path(path)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    skip = {"node_modules", ".next", ".git", ".tmp", "dist", "build", ".venv", "venv", "__pycache__"}

    def build_tree(current: Path, depth: int) -> dict:
        if depth > max_depth:
            return {"type": "truncated", "depth": depth}
        name = current.name
        if name in skip or name.startswith("."):
            return {"type": "skipped", "name": name}
        if current.is_dir():
            children = {}
            try:
                for item in sorted(current.iterdir()):
                    children[item.name] = build_tree(item, depth + 1)
            except PermissionError:
                return {"type": "error", "error": "Permission denied"}
            return {"type": "directory", "children": children}
        else:
            if _is_binary(current):
                return {"type": "file", "binary": True, "size": current.stat().st_size}
            return {"type": "file", "size": current.stat().st_size}

    try:
        tree = build_tree(root, 0)
        return {"ok": True, "path": str(root.relative_to(REPO_ROOT)), "tree": tree}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def search_files(pattern: str = "") -> dict:
    """Search for files matching pattern using ripgrep."""
    cmd = [
        "rg", "--files", "--hidden",
        "--glob", "!node_modules",
        "--glob", "!.next",
        "--glob", "!.git",
        "--glob", "!.tmp",
        "--glob", "!dist",
        "--glob", "!build",
    ]
    if pattern:
        cmd.extend(["--glob", pattern])

    try:
        result = subprocess.run(
            cmd,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=30
        )
        files = [f.strip() for f in result.stdout.split("\n") if f.strip()]
        # Convert to relative paths
        rel_files = []
        for f in files:
            try:
                p = Path(f).relative_to(REPO_ROOT)
                rel_files.append(str(p))
            except ValueError:
                rel_files.append(f)
        return {
            "ok": True,
            "pattern": pattern,
            "count": len(rel_files),
            "files": rel_files[:200]
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def search_code(query: str, file_glob: str = None) -> dict:
    """Search code using ripgrep with results."""
    cmd = [
        "rg", "-n", "--hidden",
        "--glob", "!node_modules",
        "--glob", "!.next",
        "--glob", "!.git",
        "--glob", "!.tmp",
        "--glob", "!dist",
        "--glob", "!build",
    ]
    if file_glob:
        cmd.extend(["--glob", file_glob])

    cmd.extend([query, str(REPO_ROOT)])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        stdout = result.stdout[:20000]
        return {
            "ok": True,
            "query": query,
            "fileGlob": file_glob,
            "exitCode": result.returncode,
            "stdout": stdout,
            "stderr": result.stderr[:2000] if result.stderr else ""
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def read_file(path: str) -> dict:
    """Read a UTF-8 file, capped at 30000 chars."""
    try:
        full_path = safe_path(path)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    if not full_path.exists():
        return {"ok": False, "error": f"File not found: {path}"}

    if _is_binary(full_path):
        return {"ok": False, "error": "Cannot read binary file"}

    try:
        content = full_path.read_text(encoding="utf-8")
        if len(content) > 30000:
            content = content[:30000] + "\n... [truncated]"
        return {
            "ok": True,
            "path": path,
            "content": content,
            "size": len(content)
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def write_file(path: str, content: str) -> dict:
    """Write UTF-8 text to a file."""
    try:
        full_path = safe_path(path)
    except ValueError as e:
        return {"ok": False, "error": str(e)}

    try:
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        return {"ok": True, "path": path, "written": len(content)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def apply_patch(patch: str) -> dict:
    """Apply a unified diff patch using git apply."""
    if not patch or not patch.strip():
        return {"ok": False, "error": "Empty patch"}

    # Extract touched paths from patch
    import re
    paths_in_patch = set()
    for match in re.findall(r'^\+\+\+ b/(.+)$', patch, re.MULTILINE):
        paths_in_patch.add(match.strip())

    # Validate all touched paths
    for p in paths_in_patch:
        try:
            safe_path(p)
        except ValueError as e:
            return {"ok": False, "error": f"Patch contains blocked path: {e}"}

    # Write patch to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.patch', delete=False) as f:
        f.write(patch)
        patch_path = f.name

    try:
        result = subprocess.run(
            ["git", "apply", "--whitespace=fix", patch_path],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=30
        )
        return {
            "ok": result.returncode == 0,
            "exitCode": result.returncode,
            "stdout": result.stdout[:5000],
            "stderr": result.stderr[:2000],
            "changedFiles": list(paths_in_patch)
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        try:
            os.unlink(patch_path)
        except Exception:
            pass


def run_command(command: str) -> dict:
    """Run an allowlisted shell command with timeout."""
    if command not in ALLOWED_COMMANDS:
        return {
            "ok": False,
            "error": f"Command not in allowlist: {command}",
            "command": command
        }

    args = ALLOWED_COMMANDS[command]

    try:
        result = subprocess.run(
            args,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=120
        )
        return {
            "ok": result.returncode == 0,
            "command": command,
            "exitCode": result.returncode,
            "stdout": result.stdout[:10000],
            "stderr": result.stderr[:5000]
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "command": command, "error": "Command timed out after 120s"}
    except Exception as e:
        return {"ok": False, "command": command, "error": str(e)}


def run_validation() -> dict:
    """Run npm run build and npm test."""
    results = {}

    for cmd_name, args in ALLOWED_COMMANDS.items():
        if cmd_name not in ("npm run build", "npm test"):
            continue
        try:
            result = subprocess.run(
                args,
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True,
                timeout=180
            )
            results[cmd_name] = {
                "ok": result.returncode == 0,
                "exitCode": result.returncode,
                "stdout": result.stdout[-8000:],
                "stderr": result.stderr[-3000:],
            }
        except subprocess.TimeoutExpired:
            results[cmd_name] = {"ok": False, "error": "Timed out after 180s"}
        except Exception as e:
            results[cmd_name] = {"ok": False, "error": str(e)}

    return {
        "ok": all(r.get("ok", False) for r in results.values()),
        "results": results
    }