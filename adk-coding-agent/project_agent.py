# DEPRECATED: This file is no longer used for owner website editing.
# Replaced by Cline-based workspace editing (src/lib/project-workspace/clineRunner.ts).
# Kept for reference only until Cline is fully verified.
"""
Project Website Coding Agent - for owner-facing website editing.
Supports two modes:
- static mode: edits generated HTML/CSS files (index.html, styles.css)
- gitlab mode: edits a cloned GitLab repo with full search/read/write tools.
Includes deterministic verification to prevent hallucinated summaries.
"""
import os
import json
import hashlib
import re
import subprocess
from typing import Callable, Optional, Dict, Any, List
from pathlib import Path


# Blocked directories/files - never read or write
BLOCKED_DIRS = {'node_modules', '.next', '.git', 'dist', 'build', '.tmp', '__pycache__', '.venv', 'venv'}
BLOCKED_FILES = {'.env', '.env.local', '.env.production', 'private.key', 'id_rsa', 'id_ed25519'}
BLOCKED_EXTENSIONS = {'.pyc', '.pyo', '.so', '.dll', '.dylib', '.exe', '.bin'}

# Files considered "safe" for rendered website content
SAFE_EXTENSIONS = {
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.tsx', '.jsx', '.ts', '.js', '.json',
    '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
    '.md', '.txt'
}

STATIC_MODE_SYSTEM = """You are a website editing agent for a business owner. You edit only the generated website files in this project workspace. The owner never sees code. Your job is to accurately implement the owner's request by editing index.html and styles.css.

Important rules:
- Preserve real business facts (phone, address, certifications, reviews, guarantees, prices, years in business)
- Do not invent phone numbers, addresses, certifications, reviews, guarantees, prices, or years in business
- Prefer small, targeted edits
- If the request is visual/styling, edit styles.css
- If the request is content/section/layout, edit index.html (and styles.css if needed)
- Never edit files outside the project workspace
- Never run shell commands
- After editing, validate the changes

Available tools:
- read_file(path) — read a file (index.html, styles.css, site.json)
- write_file(path, content) — write UTF-8 file
- apply_patch(patch) — apply a unified diff patch to fix specific parts
- validate_files() — validate HTML/CSS files are valid and safe
- finish(summary, ownerMessage) — stop and return owner-friendly summary

At each step, respond with JSON:
{
  "thought": "brief reasoning about what to do",
  "action": {
    "tool": "tool_name",
    "args": { ... }
  }
}

When calling finish, include:
{
  "thought": "I completed the requested changes",
  "action": {
    "tool": "finish",
    "args": {
      "summary": "What was done",
      "ownerMessage": "Plain-language description of what changed (owner never sees code)",
      "changedFiles": ["styles.css"]
    }
  }
}
"""

GITLAB_MODE_SYSTEM = """You are a project website coding agent for a business-owner website editor. You are editing a cloned website repository for one customer project. The owner never sees code. Your job is to modify the website files inside the provided workspace so the visual preview reflects the owner's request.

You MUST use tools to inspect and modify the workspace. Do not claim a change was made unless you actually changed files and verification passed.

Required workflow:
1. search_files to understand the project structure.
2. search_code for likely render/content/style locations.
3. read_file relevant files.
4. apply_patch or write_file.
5. validate_files.
6. verify_edit_applied.
7. finish with an owner-friendly summary based only on actual changes.

Rules:
- Always search before editing.
- Always read before editing.
- For section/content requests, find the main rendered page/content source and edit it.
- For background/color/style requests, find CSS/theme files and edit the actual style source.
- For vague design requests, make small safe improvements.
- Preserve real business facts.
- Do not invent phone numbers, addresses, reviews, certifications, prices, guarantees, or years in business.
- Never expose code, file names, patches, or tool logs to the owner.
- Never edit .env, .git, node_modules, .next, dist, build, private keys, or files outside the workspace.
- If you cannot locate the rendered page file, keep searching instead of guessing.
- If no file changed, return failure.

Available tools:
- search_files(pattern) — list files matching pattern using ripgrep, skipping blocked dirs
- search_code(query, file_glob?) — search for text inside files, return path + line + match
- read_file(path) — read file content (safe paths only, blocked files rejected)
- apply_patch(patch) — apply a unified diff patch (rejects patches to blocked files)
- write_file(path, content) — write content to a file (safe paths only)
- validate_files() — validate changed files exist and no blocked files touched
- verify_edit_applied(message, beforeSnapshot, afterSnapshot) — prove actual changes
- finish(summary, ownerMessage) — stop and return owner-friendly summary

At each step, respond with JSON:
{
  "thought": "brief reasoning about what to do",
  "action": {
    "tool": "tool_name",
    "args": { ... }
  }
}
"""


def is_safe_file(path: Path) -> bool:
    """Check if a file path is safe to read/write (no blocked dirs/files/extensions)."""
    parts = set(p.lower() for p in path.parts)
    if parts & BLOCKED_DIRS:
        return False
    name = path.name.lower()
    if name in BLOCKED_FILES:
        return False
    if any(name.endswith(ext) for ext in BLOCKED_EXTENSIONS):
        return False
    return True


def is_safe_write_path(path: Path) -> bool:
    """Only allow writes to known safe file types in the workspace."""
    if not is_safe_file(path):
        return False
    ext = path.suffix.lower()
    return ext in SAFE_EXTENSIONS or ext == ''


OWNER_ACTION_SCHEMA = {
    "type": "object",
    "required": ["thought", "action"],
    "properties": {
        "thought": {"type": "string"},
        "action": {
            "type": "object",
            "required": ["tool", "args"],
            "properties": {
                "tool": {
                    "type": "string",
                    "enum": [
                        "search_files", "search_code", "read_file", "write_file",
                        "apply_patch", "validate_files", "verify_edit_applied", "finish"
                    ]
                },
                "args": {"type": "object"}
            }
        }
    }
}


def compute_hash(content: str) -> str:
    """Compute SHA256 hash of content."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]


def verify_edit_applied(
    message: str,
    before_files: Dict[str, str],
    after_files: Dict[str, str]
) -> dict:
    """
    Deterministic verification that an edit was actually applied.
    Returns {ok, reason, evidence} based on comparing before/after file trees.
    Works for both static mode (index.html/css) and gitlab mode (any safe files).
    """
    lower_msg = message.lower()
    evidence = []
    changed_files = []

    for filename, before_content in before_files.items():
        after_content = after_files.get(filename, "")
        if before_content != after_content:
            changed_files.append(filename)
            size_before = len(before_content)
            size_after = len(after_content)
            evidence.append(f"{filename} changed ({size_before} -> {size_after})")

    # Also detect new files
    for filename, after_content in after_files.items():
        if filename not in before_files and after_content:
            changed_files.append(filename)
            evidence.append(f"{filename} added (new file)")

    if not changed_files:
        return {
            "ok": False,
            "reason": "No files were changed.",
            "evidence": []
        }

    # Section/content keywords
    section_keywords = ['section', 'add', 'another', 'new', 'area', 'block', 'paragraph', 'sentence', 'content', 'homes', 'projects', 'portfolio', 'gallery', 'team']
    is_section_request = any(kw in lower_msg for kw in section_keywords)

    if is_section_request:
        html_changed = any(f for f in changed_files if f.endswith(('.html', '.htm', '.tsx', '.jsx')))
        if not html_changed:
            return {
                "ok": False,
                "reason": "You asked to add content, but no HTML/TSX/JSX files changed.",
                "evidence": evidence
            }

        for filename in changed_files:
            if filename.endswith(('.html', '.htm', '.tsx', '.jsx')):
                before = before_files.get(filename, "")
                after = after_files.get(filename, "")
                if len(after) <= len(before) and filename in before_files:
                    continue

                def get_visible_text(txt: str) -> str:
                    return re.sub(r'<[^>]+>', ' ', txt)

                before_text = get_visible_text(before)
                after_text = get_visible_text(after)

                if after_text.startswith(before_text):
                    new_text = after_text[len(before_text):].strip()
                else:
                    new_text = after_text[len(before_text):].strip()

                if len(new_text) >= 20:
                    evidence.append(f"added {len(new_text)} chars of visible text")
                    topic_found = []
                    for kw in ['home', 'homes', 'property', 'properties', 'project', 'projects', 'portfolio', 'gallery', 'team']:
                        if kw in lower_msg and kw in new_text.lower():
                            topic_found.append(kw)
                    if topic_found:
                        evidence.append(f"topic words present: {topic_found}")
                    return {"ok": True, "reason": "Content added and verified.", "evidence": evidence}

        return {
            "ok": False,
            "reason": "You asked to add content, but no visible text was added to HTML files.",
            "evidence": evidence
        }

    # Style/color request
    style_keywords = ['background', 'color', 'colour', 'font', 'style', 'green', 'yellow', 'blue', 'red', 'orange', 'purple']
    is_style_request = any(kw in lower_msg for kw in style_keywords)

    if is_style_request:
        css_changed = any(f for f in changed_files if f.endswith(('.css', '.scss', '.sass', '.less')))
        if not css_changed:
            html_changed = any(f for f in changed_files if f.endswith(('.html', '.htm', '.tsx', '.jsx')))
            if not html_changed:
                return {
                    "ok": False,
                    "reason": "You asked to change style, but no CSS or HTML files changed.",
                    "evidence": evidence
                }
            evidence.append("style changed inline in HTML")

        requested_colors = [c for c in ['green', 'yellow', 'blue', 'red', 'orange', 'purple', 'pink', 'brown', 'black', 'white'] if c in lower_msg]
        if requested_colors:
            color_found = False
            for filename in changed_files:
                content = after_files.get(filename, "")
                for color in requested_colors:
                    if color in content.lower():
                        color_found = True
                        evidence.append(f"color '{color}' found in {filename}")
                        break
                if color_found:
                    break
            if not color_found:
                return {
                    "ok": False,
                    "reason": f"You asked for {requested_colors[0]} but it was not found in changed files.",
                    "evidence": evidence
                }

    return {
        "ok": True,
        "reason": "Edit verified: files changed appropriately.",
        "evidence": evidence
    }


def summarize_actual_changes(
    message: str,
    before_files: Dict[str, str],
    after_files: Dict[str, str]
) -> str:
    """
    Generate owner-friendly summary based on actual file differences.
    Works for both static mode and gitlab mode.
    """
    lower_msg = message.lower()
    changed_files = []
    css_changed = False
    html_changed = False

    for filename, before_content in before_files.items():
        after_content = after_files.get(filename, "")
        if before_content != after_content:
            changed_files.append(filename)
            if filename.endswith(('.css', '.scss', '.sass', '.less')):
                css_changed = True
            if filename.endswith(('.html', '.htm', '.tsx', '.jsx', '.ts', '.js')):
                html_changed = True

    for filename, after_content in after_files.items():
        if filename not in before_files and after_content:
            changed_files.append(filename)
            if filename.endswith(('.css', '.scss', '.sass', '.less')):
                css_changed = True
            if filename.endswith(('.html', '.htm', '.tsx', '.jsx', '.ts', '.js')):
                html_changed = True

    if not changed_files:
        return "No changes were made."

    topic_keywords = {
        'homes': 'completed homes', 'projects': 'projects', 'portfolio': 'portfolio',
        'gallery': 'gallery', 'services': 'services', 'about': 'about',
        'hero': 'hero section', 'testimonials': 'testimonials', 'faq': 'FAQ',
        'contact': 'contact section', 'booking': 'booking', 'team': 'team',
        'features': 'features', 'pricing': 'pricing', 'section': 'section',
    }
    found_topics = [topic_keywords[t] for t in topic_keywords if t in lower_msg]

    changes = []

    if html_changed:
        if found_topics:
            if len(found_topics) == 1:
                changes.append(f"Added a {found_topics[0]} section.")
            else:
                changes.append(f"Added {', '.join(found_topics[:3])} sections.")
        else:
            changes.append("Updated the page content.")

    if css_changed:
        style_keywords = ['background', 'color', 'green', 'blue', 'red', 'yellow', 'font', 'spacing']
        if any(w in lower_msg for w in style_keywords):
            changes.append("Updated the styling.")
        else:
            changes.append("Made style adjustments.")

    if len(changes) == 2:
        return f"{changes[0]} {changes[1]}"
    elif len(changes) == 1:
        return changes[0]
    else:
        return "Your website has been updated."


class ProjectWebsiteAgent:
    """
    Owner-facing website editing agent.
    Supports two modes:
    - static mode: edits generated HTML/CSS files (index.html, styles.css)
    - gitlab mode: edits a cloned GitLab repo with full search/read/write tools.
    Includes deterministic verification before claiming success.
    """
    def __init__(
        self,
        workspace_path: str,
        llm_client=None,
        max_iterations: int = 15,
        mode: str = "static"
    ):
        from llm_client import MiniMaxProxyClient
        self.workspace_path = Path(workspace_path).resolve()
        self.llm = llm_client or MiniMaxProxyClient()
        self.max_iterations = max_iterations
        self.mode = mode  # "static" or "gitlab"

        self._before_files: Dict[str, str] = {}
        self._after_files: Dict[str, str] = {}
        self._changed_files: List[str] = []

        self._system_prompt = GITLAB_MODE_SYSTEM if mode == "gitlab" else STATIC_MODE_SYSTEM

        if mode == "gitlab":
            self._tool_map = {
                "search_files": self._tool_search_files,
                "search_code": self._tool_search_code,
                "read_file": self._tool_read_file,
                "write_file": self._tool_write_file,
                "apply_patch": self._tool_apply_patch,
                "validate_files": self._tool_validate_files,
                "verify_edit_applied": self._tool_verify_edit_applied,
                "finish": self._tool_finish,
            }
        else:
            self._tool_map = {
                "read_file": self._tool_read_file_static,
                "write_file": self._tool_write_file_static,
                "apply_patch": self._tool_apply_patch_static,
                "validate_files": self._tool_validate_files_static,
                "finish": self._tool_finish,
            }

    def _validate_path(self, filename: str) -> Optional[Path]:
        """Ensure file path stays within workspace."""
        filename = filename.lstrip('/')
        requested = (self.workspace_path / filename).resolve()
        if not str(requested).startswith(str(self.workspace_path)):
            return None
        return requested

    def _classify_request(self, message: str) -> dict:
        """Classify the owner's request to determine step labels."""
        lower = message.lower()

        is_color_background = any(w in lower for w in ['background', 'color', 'colour', 'green', 'blue', 'red', 'yellow', 'orange', 'purple'])
        is_section = any(w in lower for w in ['section', 'hero', 'services', 'about', 'contact', 'faq', 'testimonials', 'homes', 'projects', 'portfolio'])
        is_contact = any(w in lower for w in ['phone', 'contact', 'email', 'address', 'hours'])
        is_text = any(w in lower for w in ['text', 'headline', 'title', 'paragraph', 'content'])

        apply_label = "Applying your requested change"
        if is_color_background:
            apply_label = "Updating the design colors"
        elif is_section:
            apply_label = "Updating the page section"
        elif is_contact:
            apply_label = "Updating the contact details"
        elif is_text:
            apply_label = "Updating the text content"

        return {"apply_label": apply_label}

    def _emit_step(self, on_event, step_id: str, label: str, status: str):
        """Emit a step event."""
        if on_event:
            on_event({
                "type": "step",
                "id": step_id,
                "label": label,
                "status": status
            })

    # ============================================================
    # GITLAB MODE TOOLS
    # ============================================================

    def _tool_search_files(self, args: dict) -> dict:
        """List files matching a glob pattern, skipping blocked dirs."""
        pattern = args.get("pattern", "*")
        try:
            result = subprocess.run(
                ["rg", "--files", "--hidden", "--glob", pattern],
                cwd=str(self.workspace_path),
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode not in (0, 1):
                return {"ok": False, "error": result.stderr or "search_files failed"}

            files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
            safe_files = [f for f in files if is_safe_file(Path(f))]
            return {"ok": True, "files": safe_files[:500]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_search_code(self, args: dict) -> dict:
        """Search for text pattern inside files."""
        query = args.get("query", "")
        file_glob = args.get("file_glob", "")
        if not query:
            return {"ok": False, "error": "query is required"}

        try:
            cmd = ["rg", "-n", "--hidden", "--", query]
            if file_glob:
                cmd.insert(1, file_glob)

            result = subprocess.run(
                cmd,
                cwd=str(self.workspace_path),
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode not in (0, 1):
                return {"ok": False, "error": result.stderr or "search_code failed"}

            output = result.stdout[:20000]
            lines = []
            for line in output.split('\n'):
                if not line.strip():
                    continue
                parts = line.split(':', 2)
                if len(parts) >= 3:
                    lines.append({
                        "path": parts[0],
                        "line": int(parts[1]) if parts[1].isdigit() else 0,
                        "content": parts[2][:200]
                    })
            return {"ok": True, "matches": lines[:100]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_read_file(self, args: dict) -> dict:
        """Read a file within the workspace (gitlab mode)."""
        path_str = args.get("path", "")
        path = self._validate_path(path_str)
        if not path:
            return {"ok": False, "error": "Path outside workspace"}
        if not is_safe_file(path):
            return {"ok": False, "error": f"Blocked file: {path.name}"}

        try:
            content = path.read_text(encoding='utf-8', errors='replace')
            return {"ok": True, "content": content[:80000], "path": path_str}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_write_file(self, args: dict) -> dict:
        """Write a file within the workspace (gitlab mode)."""
        path_str = args.get("path", "")
        content = args.get("content", "")
        path = self._validate_path(path_str)
        if not path:
            return {"ok": False, "error": "Path outside workspace"}
        if not is_safe_write_path(path):
            return {"ok": False, "error": f"Cannot write to blocked or unsafe file: {path.name}"}

        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
            if path_str not in self._after_files:
                self._after_files[path_str] = content
            return {"ok": True, "path": path_str}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_apply_patch(self, args: dict) -> dict:
        """Apply a unified diff patch."""
        patch = args.get("patch", "")
        if not patch:
            return {"ok": False, "error": "No patch provided"}

        lines = patch.split('\n')
        target_file = None
        for line in lines:
            if line.startswith('--- ') or line.startswith('+++ '):
                parts = line.split('/')
                if len(parts) >= 2:
                    fn = parts[-1] if parts[-1] != '/dev/null' else parts[-2]
                    if fn and fn not in ('a', 'b', '+++', '---'):
                        target_file = fn
                break

        if not target_file:
            return {"ok": False, "error": "Could not parse patch target"}

        path = self._validate_path(target_file)
        if not path:
            return {"ok": False, "error": "Patch target outside workspace"}
        if not is_safe_write_path(path):
            return {"ok": False, "error": f"Cannot patch blocked file: {path.name}"}

        try:
            result = subprocess.run(
                ['git', 'apply', '--whitespace=fix'],
                input=patch,
                cwd=str(self.workspace_path),
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                self._changed_files.append(target_file)
                return {"ok": True, "changedFiles": [target_file]}
            else:
                return {"ok": False, "error": result.stderr or "Patch failed"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_validate_files(self, args: dict) -> dict:
        """Validate that changed files are safe and no blocked files were touched."""
        errors = []
        if not self._changed_files:
            self._detect_changed_files()

        for fn in self._changed_files:
            path = self._validate_path(fn)
            if not path:
                errors.append(f"Changed file outside workspace: {fn}")
                continue
            if not is_safe_file(path):
                errors.append(f"Changed blocked file: {fn}")

        if errors:
            return {"ok": False, "errors": errors}
        return {"ok": True, "validated": self._changed_files}

    def _tool_verify_edit_applied(self, args: dict) -> dict:
        """Verify that the actual files changed as expected."""
        message = args.get("message", "")
        after_files = {}
        for fn in self._changed_files:
            path = self._validate_path(fn)
            if path and path.exists():
                try:
                    after_files[fn] = path.read_text(encoding='utf-8', errors='replace')
                except:
                    pass

        result = verify_edit_applied(message, self._before_files, after_files)
        return result

    def _tool_finish(self, args: dict) -> dict:
        """Finish and return owner message."""
        return {
            "ok": True,
            "summary": args.get("summary", ""),
            "ownerMessage": args.get("ownerMessage", "Changes applied."),
            "changedFiles": list(self._changed_files)
        }

    # ============================================================
    # STATIC MODE TOOLS
    # ============================================================

    def _tool_read_file_static(self, args: dict) -> dict:
        """Read a file within the workspace (static mode)."""
        path = self._validate_path(args.get("path", ""))
        if not path:
            return {"ok": False, "error": "Path outside workspace"}
        try:
            content = path.read_text(encoding='utf-8')
            return {"ok": True, "content": content[:50000]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_write_file_static(self, args: dict) -> dict:
        """Write a file within the workspace (static mode)."""
        path = self._validate_path(args.get("path", ""))
        if not path:
            return {"ok": False, "error": "Path outside workspace"}
        content = args.get("content", "")
        try:
            path.write_text(content, encoding='utf-8')
            return {"ok": True, "path": str(path)}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_apply_patch_static(self, args: dict) -> dict:
        """Apply a unified diff patch (static mode)."""
        patch = args.get("patch", "")
        if not patch:
            return {"ok": False, "error": "No patch provided"}

        lines = patch.split('\n')
        target_file = None
        for line in lines:
            if line.startswith('--- ') or line.startswith('+++ '):
                parts = line.split('/')
                if len(parts) >= 2:
                    target_file = parts[-1] if parts[-1] != '/dev/null' else parts[-2]
                break

        if not target_file:
            return {"ok": False, "error": "Could not parse patch target"}

        path = self._validate_path(target_file)
        if not path:
            return {"ok": False, "error": "Patch target outside workspace"}

        try:
            result = subprocess.run(
                ['git', 'apply', '--verbose'],
                input=patch,
                cwd=str(self.workspace_path),
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                return {"ok": True, "changedFiles": [target_file]}
            else:
                return {"ok": False, "error": result.stderr or "Patch failed"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def _tool_validate_files_static(self, args: dict) -> dict:
        """Validate HTML/CSS files are valid and safe (static mode)."""
        errors = []

        html_path = self.workspace_path / 'index.html'
        if html_path.exists():
            content = html_path.read_text(encoding='utf-8', errors='replace')
            if '<script' in content.lower() and 'eval(' in content.lower():
                errors.append("Suspicious script content detected")
            if 'TODO' in content or 'lorem ipsum' in content.lower():
                errors.append("Contains placeholder content")
        else:
            errors.append("index.html missing")

        css_path = self.workspace_path / 'styles.css'
        if not css_path.exists():
            errors.append("styles.css missing")

        if errors:
            return {"ok": False, "errors": errors}

        return {"ok": True, "validated": ["index.html", "styles.css"]}

    # ============================================================
    # SHARED
    # ============================================================

    def _detect_changed_files(self):
        """Auto-detect which files have changed since before state."""
        self._changed_files = []
        for fn, before_content in self._before_files.items():
            path = self._validate_path(fn)
            if path and path.exists():
                try:
                    after_content = path.read_text(encoding='utf-8', errors='replace')
                    if before_content != after_content:
                        self._changed_files.append(fn)
                except:
                    pass

    def _capture_before_state(self):
        """Capture the before state of relevant files."""
        self._before_files = {}
        if self.mode == "gitlab":
            try:
                for item in self.workspace_path.rglob('*'):
                    if item.is_file() and is_safe_file(item):
                        rel = str(item.relative_to(self.workspace_path))
                        try:
                            self._before_files[rel] = item.read_text(encoding='utf-8', errors='replace')
                        except:
                            pass
            except Exception as e:
                pass
        else:
            for fn in ['index.html', 'styles.css', 'site.json']:
                path = self.workspace_path / fn
                if path.exists():
                    try:
                        self._before_files[fn] = path.read_text(encoding='utf-8', errors='replace')
                    except:
                        pass

    def run(self, message: str, on_event: Callable[[dict], None] = None) -> dict:
        """
        Run the agent loop for the given owner message.
        Emits step events for owner-friendly progress display.
        Performs deterministic verification before claiming success.
        """
        messages = []
        self._current_thought = ""
        self._changed_files = []

        classification = self._classify_request(message)

        def emit(event_type: str, **kwargs):
            if on_event:
                on_event({"type": event_type, **kwargs})

        self._capture_before_state()

        self._emit_step(on_event, "understand", "Understanding your request", "active")
        messages.append({
            "role": "user",
            "content": f"Owner request: {message}\n\nRespond with your first action to edit the website."
        })
        self._emit_step(on_event, "understand", "Understanding your request", "completed")

        self._emit_step(on_event, "open_draft", "Opening your website draft", "active")
        if self.workspace_path.exists():
            self._emit_step(on_event, "open_draft", "Opening your website draft", "completed")
        else:
            self._emit_step(on_event, "open_draft", "Opening your website draft", "failed")
            return {"ok": False, "ownerMessage": "Could not open your website draft."}

        self._emit_step(on_event, "inspect_design", "Checking the current website", "active")
        self._emit_step(on_event, "inspect_design", "Checking the current website", "completed")

        self._emit_step(on_event, "apply_change", classification["apply_label"], "active")

        for iteration in range(self.max_iterations):
            try:
                response = self._call_llm(messages)
                data = response if isinstance(response, dict) else {}
            except Exception as e:
                emit("status", message=f"LLM error: {e}")
                return {
                    "ok": False,
                    "error": str(e),
                    "ownerMessage": "I had trouble understanding that request. Please try again."
                }

            thought = data.get("thought", "")
            action = data.get("action", {})
            tool_name = action.get("tool", "")
            tool_args = action.get("args", {})

            self._current_thought = thought

            if tool_name == "finish":
                self._emit_step(on_event, "apply_change", classification["apply_label"], "completed")

                self._capture_after_state()

                verification = verify_edit_applied(message, self._before_files, self._after_files)

                if not verification["ok"]:
                    self._emit_step(on_event, "validate", "Checking the preview", "failed")
                    return {
                        "ok": False,
                        "ownerMessage": "I couldn't safely apply that change. Please try rephrasing your request.",
                        "error": verification["reason"]
                    }

                self._emit_step(on_event, "validate", "Checking the preview", "active")
                self._emit_step(on_event, "validate", "Checking the preview", "completed")

                self._emit_step(on_event, "finish", "Preview updated", "active")
                verified_summary = summarize_actual_changes(
                    message,
                    self._before_files,
                    self._after_files
                )
                self._emit_step(on_event, "finish", "Preview updated", "completed")

                return {
                    "ok": True,
                    "ownerMessage": verified_summary,
                    "summary": verification["reason"],
                    "changedFiles": list(self._changed_files),
                    "verification": verification
                }

            tool_func = self._tool_map.get(tool_name)
            if not tool_func:
                result = {"ok": False, "error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result = tool_func(tool_args)
                except Exception as e:
                    result = {"ok": False, "error": str(e)}

            if tool_name == "write_file":
                fn = tool_args.get("path", "")
                if fn:
                    self._changed_files.append(fn)
                    path = self._validate_path(fn)
                    if path and path.exists():
                        try:
                            self._after_files[fn] = path.read_text(encoding='utf-8', errors='replace')
                        except:
                            pass

            result_str = json.dumps(result, default=str)[:2000]
            messages.append({
                "role": "assistant",
                "content": f"Thought: {thought}\nAction: {tool_name}({json.dumps(tool_args)})\n\nResult: {result_str}"
            })

            if not result.get("ok") and tool_name in ("write_file", "apply_patch"):
                self._emit_step(on_event, "apply_change", classification["apply_label"], "failed")
                self._emit_step(on_event, "validate", "Checking the preview", "failed")
                return {
                    "ok": False,
                    "error": result.get("error", "unknown error"),
                    "ownerMessage": "I couldn't safely apply that change. Please try rephrasing your request."
                }

        self._emit_step(on_event, "apply_change", classification["apply_label"], "failed")
        return {
            "ok": False,
            "ownerMessage": "I ran out of steps to complete your request. Please try a more specific change."
        }

    def _capture_after_state(self):
        """Capture the after state of changed files."""
        self._after_files = {}
        self._detect_changed_files()
        for fn in self._changed_files:
            path = self._validate_path(fn)
            if path and path.exists():
                try:
                    self._after_files[fn] = path.read_text(encoding='utf-8', errors='replace')
                except:
                    pass

    def _call_llm(self, messages: list) -> dict:
        """Call LLM and return parsed response."""
        from llm_client import MiniMaxProxyClient
        conversation = "\n".join(
            f"{'Assistant' if m['role']=='assistant' else 'User'}: {m['content']}"
            for m in messages
        )
        prompt = f"{conversation}\n\n{self._current_thought}"

        return self.llm.generate_json_stream(
            system=self._system_prompt,
            prompt=prompt,
            schema=OWNER_ACTION_SCHEMA
        )