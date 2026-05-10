"""JSON-RPC bridge server for TypeScript <-> Python communication.

Reads JSON-RPC requests from stdin, dispatches to ThinkingEngine,
writes JSON-RPC responses to stdout. This is spawned as a child process
by the TypeScript side.
"""

from __future__ import annotations

import asyncio
import json
import sys
from .engine import ThinkingEngine
from .providers import Message, ProviderConfig


class BridgeServer:
    def __init__(self):
        self.engine: ThinkingEngine | None = None

    async def handle_request(self, request: dict) -> dict:
        method = request.get("method", "")
        params = request.get("params", {})
        req_id = request.get("id")

        try:
            result = await self._dispatch(method, params)
            return {"jsonrpc": "2.0", "id": req_id, "result": result}
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32000, "message": str(e)},
            }

    async def _dispatch(self, method: str, params: dict) -> dict:
        if method == "initialize":
            return await self._initialize(params)
        elif method == "complete":
            return await self._complete(params)
        elif method == "stream":
            return await self._stream(params)
        elif method == "set_thinking_level":
            return self._set_thinking_level(params)
        elif method == "set_provider":
            return await self._set_provider(params)
        elif method == "shutdown":
            return {"status": "ok"}
        else:
            raise ValueError(f"Unknown method: {method}")

    async def _initialize(self, params: dict) -> dict:
        config = ProviderConfig(
            api_key=params.get("api_key"),
            base_url=params.get("base_url"),
            model=params.get("model"),
            max_tokens=params.get("max_tokens", 4096),
            temperature=params.get("temperature", 0.7),
        )
        self.engine = ThinkingEngine(
            provider_name=params.get("provider", "anthropic"),
            thinking_level=params.get("thinking_level", "medium"),
            config=config,
        )
        return {"status": "initialized", "provider": self.engine.provider_name}

    async def _complete(self, params: dict) -> dict:
        if not self.engine:
            raise RuntimeError("Engine not initialized. Call 'initialize' first.")

        history = [Message(**m) for m in params.get("history", [])]
        result = await self.engine.complete(params["message"], history or None)
        return {"text": result}

    async def _stream(self, params: dict) -> dict:
        """Stream responses — writes individual chunks as JSON lines to stdout."""
        if not self.engine:
            raise RuntimeError("Engine not initialized. Call 'initialize' first.")

        history = [Message(**m) for m in params.get("history", [])]
        full_text = ""

        async for chunk in self.engine.stream(params["message"], history or None):
            # Write streaming chunks as separate JSON lines prefixed with "chunk:"
            chunk_data = json.dumps({
                "type": "chunk",
                "text": chunk.text,
                "done": chunk.done,
                "usage": chunk.usage,
            })
            sys.stdout.write(f"chunk:{chunk_data}\n")
            sys.stdout.flush()
            full_text += chunk.text

        return {"text": full_text}

    def _set_thinking_level(self, params: dict) -> dict:
        if not self.engine:
            raise RuntimeError("Engine not initialized.")
        self.engine.set_thinking_level(params["level"])
        return {"status": "ok", "level": params["level"]}

    async def _set_provider(self, params: dict) -> dict:
        if not self.engine:
            raise RuntimeError("Engine not initialized.")
        config = ProviderConfig(
            api_key=params.get("api_key"),
            model=params.get("model"),
        )
        self.engine.set_provider(params["provider"], config)
        return {"status": "ok", "provider": params["provider"]}


async def main():
    server = BridgeServer()

    # Read from stdin line by line
    loop = asyncio.get_event_loop()
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    while True:
        line = await reader.readline()
        if not line:
            break

        line_str = line.decode("utf-8").strip()
        if not line_str:
            continue

        try:
            request = json.loads(line_str)
        except json.JSONDecodeError:
            continue

        response = await server.handle_request(request)

        if request.get("method") == "shutdown":
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
            break

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(main())
