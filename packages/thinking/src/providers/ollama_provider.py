"""Ollama provider implementation using REST API."""

from __future__ import annotations

import json
import httpx
from typing import AsyncIterator
from .base import BaseProvider, Message, ProviderConfig, StreamChunk


DEFAULT_MODEL = "llama3.2"


class OllamaProvider(BaseProvider):
    """Provider for locally-hosted Ollama models."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client = httpx.AsyncClient(
            base_url=config.base_url or "http://localhost:11434"
        )
        self.model = config.model or DEFAULT_MODEL

    def name(self) -> str:
        return "ollama"

    def _prepare_messages(self, messages: list[Message]) -> list[dict]:
        """Convert messages to Ollama format (system messages inline)."""
        return [{"role": msg.role, "content": msg.content} for msg in messages]

    async def complete(self, messages: list[Message]) -> str:
        conversation = self._prepare_messages(messages)

        response = await self.client.post(
            "/api/chat",
            json={
                "model": self.model,
                "messages": conversation,
                "stream": False,
                "options": {"temperature": self.config.temperature},
            },
        )
        response.raise_for_status()
        return response.json()["message"]["content"]

    async def stream(self, messages: list[Message]) -> AsyncIterator[StreamChunk]:
        conversation = self._prepare_messages(messages)

        async with self.client.stream(
            "POST",
            "/api/chat",
            json={
                "model": self.model,
                "messages": conversation,
                "stream": True,
                "options": {"temperature": self.config.temperature},
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if data.get("done"):
                    yield StreamChunk(text="", done=True, usage=None)
                    break
                yield StreamChunk(text=data["message"]["content"])
