"""CodeCLI Thinking Engine — manages LLM interactions with thinking level formatting."""

from __future__ import annotations

from .providers import (
    BaseProvider,
    AnthropicProvider,
    OpenAIProvider,
    OllamaProvider,
    Message,
    ProviderConfig,
    StreamChunk,
)
from typing import AsyncIterator


# Thinking level system prompts — these frame how the model should reason
THINKING_PROMPTS: dict[str, str] = {
    "low": (
        "You are a concise coding assistant. Give direct, short answers. "
        "Skip explanations unless asked. Prefer code over prose."
    ),
    "medium": (
        "You are a coding assistant. Provide clear answers with brief explanations. "
        "Show your reasoning when relevant but stay focused."
    ),
    "high": (
        "You are a thorough coding assistant. Think step-by-step before answering. "
        "Explain your reasoning, consider edge cases, and provide comprehensive solutions."
    ),
    "extra-high": (
        "You are an expert coding assistant engaged in deep analysis. "
        "Think through the problem systematically: understand the context, consider multiple "
        "approaches, evaluate trade-offs, identify edge cases and failure modes, then provide "
        "a detailed, well-structured solution with explanations."
    ),
}


PROVIDERS: dict[str, type[BaseProvider]] = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "ollama": OllamaProvider,
}


class ThinkingEngine:
    """Core engine that manages LLM provider selection and thinking-level formatting."""

    def __init__(
        self,
        provider_name: str = "anthropic",
        thinking_level: str = "medium",
        config: ProviderConfig | None = None,
    ):
        self.thinking_level = thinking_level
        self.provider_name = provider_name

        provider_cls = PROVIDERS.get(provider_name)
        if not provider_cls:
            raise ValueError(
                f"Unknown provider '{provider_name}'. Available: {list(PROVIDERS.keys())}"
            )

        self.provider: BaseProvider = provider_cls(config or ProviderConfig())

    def _build_messages(
        self, user_message: str, history: list[Message] | None = None
    ) -> list[Message]:
        """Build the message list with thinking-level system prompt."""
        system_prompt = THINKING_PROMPTS.get(self.thinking_level, THINKING_PROMPTS["medium"])

        messages: list[Message] = [Message(role="system", content=system_prompt)]

        if history:
            messages.extend(history)

        messages.append(Message(role="user", content=user_message))
        return messages

    async def complete(
        self, user_message: str, history: list[Message] | None = None
    ) -> str:
        """Get a full completion from the LLM."""
        messages = self._build_messages(user_message, history)
        return await self.provider.complete(messages)

    async def stream(
        self, user_message: str, history: list[Message] | None = None
    ) -> AsyncIterator[StreamChunk]:
        """Stream a response from the LLM."""
        messages = self._build_messages(user_message, history)
        async for chunk in self.provider.stream(messages):
            yield chunk

    def set_thinking_level(self, level: str) -> None:
        if level not in THINKING_PROMPTS:
            raise ValueError(
                f"Invalid thinking level '{level}'. Options: {list(THINKING_PROMPTS.keys())}"
            )
        self.thinking_level = level

    def set_provider(self, provider_name: str, config: ProviderConfig | None = None) -> None:
        provider_cls = PROVIDERS.get(provider_name)
        if not provider_cls:
            raise ValueError(f"Unknown provider '{provider_name}'")
        self.provider = provider_cls(config or ProviderConfig())
        self.provider_name = provider_name
