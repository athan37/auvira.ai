"""
LLM client using the local MiniMax proxy endpoint.
Supports regular JSON and streaming SSE responses.
"""
import json
import httpx
import os
from typing import Any, Callable, Optional


class MiniMaxProxyClient:
    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.getenv(
            "MINIMAX_PROXY_URL", "http://localhost:3457"
        )

    def generate_json(
        self,
        system: str,
        prompt: str,
        schema: dict
    ) -> dict:
        """POST to /minimax-json and return parsed JSON result."""
        url = f"{self.base_url}/minimax-json"
        payload = {
            "system": system,
            "prompt": prompt,
            "schema": schema
        }

        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()

        if not result.get("ok") and result.get("validation", {}).get("valid") is False:
            raise ValueError(f"Schema validation failed: {result.get('validation', {}).get('errors')}")

        # Normalize: proxy returns {ok: true, data: {...}} - extract data if present
        if "data" in result and isinstance(result.get("data"), dict):
            return result["data"]
        return result

    def generate_json_stream(
        self,
        system: str,
        prompt: str,
        schema: dict,
        on_token: Optional[Callable[[str], None]] = None
    ) -> dict:
        """
        POST to /minimax-json/stream, read SSE events.
        Accumulate tokens via on_token callback.
        Only parse and return after done:true.
        """
        url = f"{self.base_url}/minimax-json/stream"
        payload = {
            "system": system,
            "prompt": prompt,
            "schema": schema
        }

        buffer = ""
        last_token = ""

        with httpx.Client(timeout=60.0) as client:
            with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()

                for line in response.iter_lines():
                    if not line.startswith("data:"):
                        continue

                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue

                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    if event.get("error"):
                        raise RuntimeError(f"Stream error: {event['error']}")

                    if event.get("token"):
                        last_token = event["token"]
                        buffer += last_token
                        if on_token:
                            on_token(last_token)

                    if event.get("done"):
                        break

        if not buffer.strip():
            raise RuntimeError("Empty response from stream")

        # Validate it looks like JSON before parsing
        trimmed = buffer.strip()
        if not (trimmed.startswith("{") or trimmed.startswith("[")):
            raise RuntimeError(f"Stream returned non-JSON: {trimmed[:500]}")

        # Handle case where proxy sends duplicate tokens (multiple concatenated JSON objects)
        # Try to parse as single JSON first
        try:
            result = json.loads(buffer)
        except json.JSONDecodeError:
            # Find the last complete JSON object using regex
            # Pattern matches {...} with up to 2 levels of nested braces
            import re
            pattern = r'\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}'
            objects = re.findall(pattern, buffer)
            if objects:
                result = json.loads(objects[-1])
            else:
                raise RuntimeError(f"Failed to parse streamed JSON. Buffer: {buffer[:500]}")

        if not result.get("ok") and result.get("validation", {}).get("valid") is False:
            raise ValueError(f"Schema validation failed: {result.get('validation', {}).get('errors')}")

        # Normalize: proxy returns {ok: true, data: {...}} - extract data if present
        if "data" in result and isinstance(result.get("data"), dict):
            return result["data"]
        return result