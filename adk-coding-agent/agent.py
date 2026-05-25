"""
ADK-style coding agent with structured action loop.
Uses MiniMax proxy as LLM backend.
"""
import os
import json
from typing import Any, Callable, Optional
from llm_client import MiniMaxProxyClient
import tools


SYSTEM_INSTRUCTION = """You are a developer coding agent for a Next.js AI website editor project.

You can inspect files, search the repo, edit files, and run limited validation commands through tools.

Work safely:
- Prefer small focused changes
- Before editing, search and read relevant files
- After editing, run npm run build to verify
- Never access secrets, .env files, node_modules, .git, .next, .tmp, or paths outside the repo root
- Never run unapproved shell commands
- If validation fails, inspect the error and fix it once or twice

Available tools:
- search_code(query, file_glob?) — search with ripgrep
- search_files(pattern) — find files by pattern/glob
- read_file(path) — read UTF-8 file content
- write_file(path, content) — write UTF-8 file
- apply_patch(patch) — apply a unified diff patch
- run_command(cmd) — run an allowlisted command (npm run build, npm test, git diff, etc.)
- run_validation() — run npm run build AND npm test
- finish(summary) — stop the agent loop and return results

At each step, respond with JSON:
{
  "thought": "brief reasoning about what to do next",
  "action": {
    "tool": "tool_name",
    "args": { ... }
  }
}

When calling finish, include:
{
  "thought": "I have completed the task",
  "action": {
    "tool": "finish",
    "args": {
      "summary": "What was done and why",
      "changedFiles": ["file1", "file2"]
    }
  }
}
"""


ACTION_SCHEMA = {
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
                        "search_code", "search_files", "read_file",
                        "write_file", "apply_patch", "run_command",
                        "run_validation", "finish"
                    ]
                },
                "args": {"type": "object"}
            }
        }
    }
}


class CodingAgent:
    def __init__(
        self,
        llm_client: MiniMaxProxyClient = None,
        max_iterations: int = None
    ):
        self.llm = llm_client or MiniMaxProxyClient()
        self.max_iterations = int(os.getenv("MAX_TOOL_ITERATIONS", "8"))
        self._tool_map = {
            "search_code": self._tool_search_code,
            "search_files": self._tool_search_files,
            "read_file": self._tool_read_file,
            "write_file": self._tool_write_file,
            "apply_patch": self._tool_apply_patch,
            "run_command": self._tool_run_command,
            "run_validation": self._tool_run_validation,
            "finish": self._tool_finish,
        }

    def _call_llm(self, messages: list, on_token: Callable[[str], None] = None) -> dict:
        """Call LLM and return parsed response."""
        conversation = "\n".join(
            f"{'Assistant' if m['role']=='assistant' else 'User'}: {m['content']}"
            for m in messages
        )
        prompt = f"{conversation}\n\n{self._current_thought}"

        schema = ACTION_SCHEMA

        return self.llm.generate_json_stream(
            system=SYSTEM_INSTRUCTION,
            prompt=prompt,
            schema=schema,
            on_token=on_token
        )

    def run(self, task: str, on_event: Callable[[dict], None] = None) -> dict:
        """
        Run the agent loop for the given task.
        on_event is called with dicts like:
          {"type": "status", "message": "..."}
          {"type": "tool_call", "tool": "...", "args": {...}}
          {"type": "tool_result", "tool": "...", "summary": "..."}
          {"type": "done", "result": {...}}
        """
        messages = []
        steps = []
        changed_files = set()
        validation_result = None
        self._current_thought = ""
        finished = False

        def emit(event_type: str, **kwargs):
            if on_event:
                on_event({"type": event_type, **kwargs})

        # Start with user task
        messages.append({
            "role": "user",
            "content": f"Task: {task}\n\nRespond with your first action (thought + action)."
        })

        for iteration in range(self.max_iterations):
            emit("status", message=f"Step {iteration + 1}/{self.max_iterations}: thinking...")

            # Get LLM response
            try:
                response = self._call_llm(messages)
                # _call_llm returns the parsed response directly (already extracted from {data: ...} wrapper)
                data = response if isinstance(response, dict) else {}
            except Exception as e:
                emit("status", message=f"LLM error: {e}")
                return {
                    "ok": False,
                    "error": str(e),
                    "steps": steps,
                    "iteration": iteration
                }

            thought = data.get("thought", "")
            action = data.get("action", {})
            tool_name = action.get("tool", "")
            tool_args = action.get("args", {})

            self._current_thought = thought

            emit("status", message=f"Thought: {thought[:100]}")
            emit("tool_call", tool=tool_name, args=tool_args)

            if tool_name == "finish":
                summary = tool_args.get("summary", "")
                changed = tool_args.get("changedFiles", [])
                finished = True
                emit("tool_result", tool="finish", summary=summary)
                break

            # Execute tool
            tool_func = self._tool_map.get(tool_name)
            if not tool_func:
                result = {"ok": False, "error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result = tool_func(tool_args)
                except Exception as e:
                    result = {"ok": False, "error": str(e)}

            # Track changed files
            if tool_name == "write_file" and result.get("ok"):
                changed_files.add(tool_args.get("path", ""))
            elif tool_name == "apply_patch" and result.get("ok"):
                for f in result.get("changedFiles", []):
                    changed_files.add(f)

            # Track validation result
            if tool_name == "run_validation":
                validation_result = result

            # Format result for LLM context
            result_str = json.dumps(result, default=str)[:2000]
            messages.append({
                "role": "assistant",
                "content": f"Thought: {thought}\nAction: {tool_name}({json.dumps(tool_args)})\n\nResult: {result_str}"
            })

            steps.append({
                "iteration": iteration,
                "thought": thought,
                "action": {"tool": tool_name, "args": tool_args},
                "result": result
            })

            emit("tool_result", tool=tool_name, summary=str(result.get("ok", False)))

            # Check for tool errors that should stop the loop
            if not result.get("ok") and tool_name in ("write_file", "apply_patch"):
                error_msg = result.get("error", "unknown error")
                emit("status", message=f"Tool error (will continue): {error_msg}")

        if not finished:
            emit("status", message=f"Max iterations ({self.max_iterations}) reached without finish call")

        final_result = {
            "ok": finished,
            "summary": f"Completed {len(steps)} steps" if finished else f"Stopped after {len(steps)} steps (max iterations)",
            "changedFiles": list(changed_files),
            "validation": validation_result,
            "steps": steps
        }

        emit("done", result=final_result)
        return final_result

    # ---- Tool implementations ----

    def _tool_search_code(self, args: dict) -> dict:
        return tools.search_code(args.get("query", ""), args.get("file_glob"))

    def _tool_search_files(self, args: dict) -> dict:
        return tools.search_files(args.get("pattern", ""))

    def _tool_read_file(self, args: dict) -> dict:
        return tools.read_file(args.get("path", ""))

    def _tool_write_file(self, args: dict) -> dict:
        return tools.write_file(args.get("path", ""), args.get("content", ""))

    def _tool_apply_patch(self, args: dict) -> dict:
        return tools.apply_patch(args.get("patch", ""))

    def _tool_run_command(self, args: dict) -> dict:
        return tools.run_command(args.get("command", ""))

    def _tool_run_validation(self, args: dict) -> dict:
        return tools.run_validation()

    def _tool_finish(self, args: dict) -> dict:
        # Finish is handled specially in run() - this is just for completeness
        return {"ok": True, "summary": args.get("summary", ""), "changedFiles": args.get("changedFiles", [])}