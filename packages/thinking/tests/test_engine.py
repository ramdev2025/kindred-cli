"""Tests for the ThinkingEngine and provider registration."""

from __future__ import annotations

import pytest
from src.engine import ThinkingEngine, THINKING_PROMPTS, PROVIDERS
from src.providers import (
    BaseProvider,
    AnthropicProvider,
    OpenAIProvider,
    OllamaProvider,
    Message,
    ProviderConfig,
    StreamChunk,
)


class TestProviderRegistration:
    """Test that all providers are registered and discoverable."""

    def test_all_providers_registered(self):
        assert "anthropic" in PROVIDERS
        assert "openai" in PROVIDERS
        assert "ollama" in PROVIDERS

    def test_provider_classes_are_subclasses(self):
        for name, cls in PROVIDERS.items():
            assert issubclass(cls, BaseProvider), f"{name} is not a BaseProvider subclass"

    def test_unknown_provider_raises(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            ThinkingEngine(provider_name="nonexistent")


class TestThinkingLevels:
    """Test thinking level prompt selection."""

    def test_all_levels_exist(self):
        for level in ["low", "medium", "high", "extra-high"]:
            assert level in THINKING_PROMPTS
            assert len(THINKING_PROMPTS[level]) > 0

    def test_set_valid_level(self):
        engine = ThinkingEngine(
            provider_name="anthropic",
            thinking_level="low",
            config=ProviderConfig(api_key="test"),
        )
        assert engine.thinking_level == "low"
        engine.set_thinking_level("high")
        assert engine.thinking_level == "high"

    def test_set_invalid_level_raises(self):
        engine = ThinkingEngine(
            provider_name="anthropic",
            thinking_level="medium",
            config=ProviderConfig(api_key="test"),
        )
        with pytest.raises(ValueError, match="Invalid thinking level"):
            engine.set_thinking_level("ultra")


class TestMessageBuilding:
    """Test that _build_messages produces correct message lists."""

    def test_includes_system_prompt(self):
        engine = ThinkingEngine(
            provider_name="anthropic",
            thinking_level="medium",
            config=ProviderConfig(api_key="test"),
        )
        messages = engine._build_messages("hello")
        assert messages[0].role == "system"
        assert messages[0].content == THINKING_PROMPTS["medium"]
        assert messages[-1].role == "user"
        assert messages[-1].content == "hello"

    def test_includes_history(self):
        engine = ThinkingEngine(
            provider_name="anthropic",
            thinking_level="low",
            config=ProviderConfig(api_key="test"),
        )
        history = [
            Message(role="user", content="first"),
            Message(role="assistant", content="response"),
        ]
        messages = engine._build_messages("second", history)
        assert len(messages) == 4  # system + 2 history + user
        assert messages[1].content == "first"
        assert messages[2].content == "response"
        assert messages[3].content == "second"

    def test_thinking_level_affects_system_prompt(self):
        engine = ThinkingEngine(
            provider_name="anthropic",
            thinking_level="extra-high",
            config=ProviderConfig(api_key="test"),
        )
        messages = engine._build_messages("test")
        assert "expert" in messages[0].content.lower()


class TestProviderConfig:
    """Test ProviderConfig dataclass defaults."""

    def test_defaults(self):
        config = ProviderConfig()
        assert config.api_key is None
        assert config.base_url is None
        assert config.model is None
        assert config.max_tokens == 4096
        assert config.temperature == 0.7

    def test_custom_values(self):
        config = ProviderConfig(
            api_key="sk-test",
            model="custom-model",
            max_tokens=2048,
            temperature=0.3,
        )
        assert config.api_key == "sk-test"
        assert config.model == "custom-model"
        assert config.max_tokens == 2048
        assert config.temperature == 0.3


class TestStreamChunk:
    """Test StreamChunk dataclass."""

    def test_defaults(self):
        chunk = StreamChunk(text="hello")
        assert chunk.text == "hello"
        assert chunk.done is False
        assert chunk.usage is None

    def test_final_chunk(self):
        chunk = StreamChunk(
            text="",
            done=True,
            usage={"input_tokens": 10, "output_tokens": 20},
        )
        assert chunk.done is True
        assert chunk.usage["input_tokens"] == 10


class TestProviderInstantiation:
    """Test that providers can be instantiated without errors."""

    def test_anthropic_provider(self):
        provider = AnthropicProvider(ProviderConfig(api_key="test"))
        assert provider.name() == "anthropic"
        assert provider.model == "claude-sonnet-4-20250514"

    def test_openai_provider(self):
        provider = OpenAIProvider(ProviderConfig(api_key="test"))
        assert provider.name() == "openai"
        assert provider.model == "gpt-4o"

    def test_ollama_provider(self):
        provider = OllamaProvider(ProviderConfig())
        assert provider.name() == "ollama"
        assert provider.model == "llama3.2"

    def test_custom_model(self):
        provider = AnthropicProvider(
            ProviderConfig(api_key="test", model="claude-3-haiku-20240307")
        )
        assert provider.model == "claude-3-haiku-20240307"

    def test_ollama_custom_base_url(self):
        provider = OllamaProvider(
            ProviderConfig(base_url="http://gpu-server:11434")
        )
        assert provider.client.base_url == "http://gpu-server:11434"
