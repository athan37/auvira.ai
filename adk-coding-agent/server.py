# Owner website editing uses ProjectWebsiteAgent via /project-website-agent/* endpoints.
# Dev-only repo editing uses CodingAgent via /agent/* (requires DEV_CODING_AGENT_ENABLED=true).
"""
FastAPI server for the ADK-style coding agent.
"""
import os
import json
import asyncio
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from agent import CodingAgent
from llm_client import MiniMaxProxyClient
from project_agent import ProjectWebsiteAgent


app = FastAPI(title="ADK Coding Agent")

# Environment checks
DEV_AGENT_ENABLED = os.getenv("DEV_CODING_AGENT_ENABLED", "false").lower() == "true"
PROJECT_WEBSITE_AGENT_ENABLED = os.getenv("PROJECT_WEBSITE_AGENT_ENABLED", "true").lower() == "true"
AGENT_URL = os.getenv("ADK_CODING_AGENT_URL", "http://localhost:8001")
REPO_ROOT = Path(os.getenv("REPO_ROOT", "..")).resolve()

# Verify REPO_ROOT exists
if not REPO_ROOT.exists():
    raise RuntimeError(f"REPO_ROOT does not exist: {REPO_ROOT}")


class RunRequest(BaseModel):
    task: str
    maxIterations: Optional[int] = None


class RunStreamRequest(BaseModel):
    task: str
    maxIterations: Optional[int] = None


class ProjectWebsiteEditRequest(BaseModel):
    projectId: str
    workspacePath: str
    message: str
    mode: Optional[str] = "static"


@app.get("/health")
async def health():
    return {
        "ok": True,
        "devAgentEnabled": DEV_AGENT_ENABLED,
        "projectWebsiteAgentEnabled": PROJECT_WEBSITE_AGENT_ENABLED,
    }


@app.post("/agent/run")
async def run_agent(request: RunRequest):
    """
    Run the coding agent synchronously and return final result.
    """
    if not DEV_AGENT_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Coding agent is disabled. Set DEV_CODING_AGENT_ENABLED=true to enable."
        )

    llm = MiniMaxProxyClient()
    agent = CodingAgent(llm_client=llm, max_iterations=request.maxIterations)

    result = agent.run(task=request.task)

    return JSONResponse(content={
        "ok": result.get("ok", False),
        "summary": result.get("summary", ""),
        "changedFiles": result.get("changedFiles", []),
        "validation": result.get("validation"),
        "stepsCount": len(result.get("steps", [])),
        "error": result.get("error")
    })


@app.post("/agent/run-stream")
async def run_agent_stream(request: RunStreamRequest):
    """
    Run the coding agent with SSE streaming of events.
    """
    if not DEV_AGENT_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Coding agent is disabled. Set DEV_CODING_AGENT_ENABLED=true to enable."
        )

    async def event_generator():
        llm = MiniMaxProxyClient()
        agent = CodingAgent(llm_client=llm, max_iterations=request.maxIterations)

        def on_event(event: dict):
            yield f"data: {json.dumps(event)}\n\n"

        result = agent.run(task=request.task, on_event=on_event)

        # Final result
        yield f"data: {json.dumps({'type': 'done', 'result': result})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/")
async def root():
    return {
        "service": "ADK Coding Agent",
        "devAgentEnabled": DEV_AGENT_ENABLED,
        "projectWebsiteAgentEnabled": PROJECT_WEBSITE_AGENT_ENABLED,
        "repoRoot": str(REPO_ROOT),
        "endpoints": {
            "health": "GET /health",
            "run": "POST /agent/run",
            "runStream": "POST /agent/run-stream",
            "projectWebsiteEdit": "POST /project-website-agent/edit",
            "projectWebsiteEditStream": "POST /project-website-agent/edit-stream",
        }
    }


@app.post("/project-website-agent/edit")
async def project_website_edit(request: ProjectWebsiteEditRequest):
    """
    Owner-facing website editing agent.
    Restricted to a specific project workspace.
    """
    if not PROJECT_WEBSITE_AGENT_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Owner website edit agent is disabled. Set PROJECT_WEBSITE_AGENT_ENABLED=true."
        )

    # Verify workspace path is valid
    workspace = Path(request.workspacePath).resolve()
    if not workspace.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")

    agent = ProjectWebsiteAgent(
        workspace_path=str(workspace),
        max_iterations=15,
        mode=request.mode or "static"
    )

    result = agent.run(message=request.message)

    return JSONResponse(content={
        "ok": result.get("ok", False),
        "ownerMessage": result.get("ownerMessage", "Done."),
        "changedFiles": result.get("changedFiles", []),
        "summary": result.get("summary", ""),
        "error": result.get("error")
    })


@app.post("/project-website-agent/edit-stream")
async def project_website_edit_stream(request: ProjectWebsiteEditRequest):
    """
    Owner-facing website editing agent with SSE streaming.
    Events are emitted as steps happen, then final result at end.
    """
    if not PROJECT_WEBSITE_AGENT_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Owner website edit agent is disabled. Set PROJECT_WEBSITE_AGENT_ENABLED=true."
        )

    workspace = Path(request.workspacePath).resolve()
    if not workspace.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")

    async def event_generator():
        agent = ProjectWebsiteAgent(
            workspace_path=str(workspace),
            max_iterations=15,
            mode=request.mode or "static"
        )

        collected_events = []

        def on_event(event: dict):
            collected_events.append(event)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: agent.run(message=request.message, on_event=on_event),
        )

        for event in collected_events:
            yield f"data: {json.dumps(event)}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'result': result})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)