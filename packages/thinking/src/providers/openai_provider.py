"""OpenAI provider implementation."""

from __future__ import annotations

import openai
from typing import AsyncIterator
from .base import BaseProvider, Message, ProviderConfig, StreamChunk


DEFAULT_MODEL = "gpt-4o"


class OpenAIProvider(BaseProvider):
    """Provider for OpenAI's GPT models."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client = openai.AsyncOpenAI(api_key=config.api_key)
        self.model = config.model or DEFAULT_MODEL

    def name(self) -> str:
        return "openai"

    def _prepare_messages(self, messages: list[Message]) -> list[dict]:
        """Convert messages to OpenAI format (system messages inline)."""
        return [{"role": msg.role, "content": msg.content} for msg in messages]

    async def complete(self, messages: list[Message]) -> str:
        conversation = self._prepare_messages(messages)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=conversation,
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
            stream=False,
        )
        return response.choices[0].message.content

    async def stream(self, messages: list[Message]) -> AsyncIterator[StreamChunk]:
        conversation = self._prepare_messages(messages)

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=conversation,
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
            stream=True,
        )

        async for chunk in response:
            yield StreamChunk(text=chunk.choices[0].delta.content or "")

        yield StreamChunk(text="", done=True, usage=None)
