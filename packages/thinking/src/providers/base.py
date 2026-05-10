"""Base provider interface for all LLM providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str


@dataclass
class ProviderConfig:
    api_key: str | None = None
    base_url: str | None = None
    model: str | None = None
    max_tokens: int = 4096
    temperature: float = 0.7


@dataclass
class StreamChunk:
    text: str
    done: bool = False
    usage: dict | None = None


class BaseProvider(ABC):
    """Abstract base for LLM providers."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    @abstractmethod
    async def complete(self, messages: list[Message]) -> str:
        """Send messages and return the full completion."""
        ...

    @abstractmethod
    async def stream(self, messages: list[Message]) -> AsyncIterator[StreamChunk]:
        """Send messages and stream response chunks."""
        ...

    @abstractmethod
    def name(self) -> str:
        """Return the provider name."""
        ...
