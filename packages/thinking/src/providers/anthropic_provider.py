"""Anthropic Claude provider implementation."""

from __future__ import annotations

import anthropic
from typing import AsyncIterator
from .base import BaseProvider, Message, ProviderConfig, StreamChunk


DEFAULT_MODEL = "claude-sonnet-4-20250514"


class AnthropicProvider(BaseProvider):
    """Provider for Anthropic's Claude models."""

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        self.client = anthropic.AsyncAnthropic(api_key=config.api_key)
        self.model = config.model or DEFAULT_MODEL

    def name(self) -> str:
        return "anthropic"

    def _prepare_messages(
        self, messages: list[Message]
    ) -> tuple[str | None, list[dict]]:
        """Separate system message from conversation messages."""
        system = None
        conversation = []

        for msg in messages:
            if msg.role == "system":
                system = msg.content
            else:
                conversation.append({"role": msg.role, "content": msg.content})

        return system, conversation

    async def complete(self, messages: list[Message]) -> str:
        system, conversation = self._prepare_messages(messages)

        kwargs: dict = {
            "model": self.model,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "messages": conversation,
        }
        if system:
            kwargs["system"] = system

        response = await self.client.messages.create(**kwargs)
        return response.content[0].text

    async def stream(self, messages: list[Message]) -> AsyncIterator[StreamChunk]:
        system, conversation = self._prepare_messages(messages)

        kwargs: dict = {
            "model": self.model,
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "messages": conversation,
        }
        if system:
            kwargs["system"] = system

        async with self.client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield StreamChunk(text=text)

            final_message = await stream.get_final_message()
            yield StreamChunk(
                text="",
                done=True,
                usage={
                    "input_tokens": final_message.usage.input_tokens,
                    "output_tokens": final_message.usage.output_tokens,
                },
            )
