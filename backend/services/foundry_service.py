"""
Foundry Service - Integration with Microsoft Foundry.

Microsoft Foundry projects expose an OpenAI-compatible endpoint. The base URL
is derived from the project endpoint (e.g. projectsanvi.services.ai.azure.com
-> https://projectsanvi.openai.azure.com). It can be overridden explicitly via
FOUNDRY_OPENAI_BASE_URL when the auto-derived host is wrong.
"""

import logging
import os
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

try:
    from openai import AzureOpenAI, OpenAIError
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False


def derive_base_url(project_endpoint: str) -> str:
    """Derive the OpenAI-compatible host from a Foundry project endpoint."""
    override = os.environ.get("FOUNDRY_OPENAI_BASE_URL", "")
    if override:
        return override.rstrip("/")
    try:
        resource_name = project_endpoint.split("//")[1].split(".")[0]
        return f"https://{resource_name}.openai.azure.com"
    except (IndexError, AttributeError):
        return ""


class FoundryClient:
    """Client for Microsoft Foundry integration."""

    def __init__(self):
        self.project_endpoint = os.environ.get("FOUNDRY_PROJECT_ENDPOINT", "")
        self.model_deployment = os.environ.get("MODEL_DEPLOYMENT_NAME", "")
        self.api_key = os.environ.get("FOUNDRY_API_KEY", "")
        self.base_url = derive_base_url(self.project_endpoint)
        self._client = None

    def is_configured(self) -> bool:
        return bool(self.api_key and self.base_url and self.model_deployment)

    def _get_client(self):
        """Get or create the OpenAI client."""
        if self._client is None and AZURE_SDK_AVAILABLE and self.is_configured():
            try:
                self._client = AzureOpenAI(
                    api_key=self.api_key,
                    azure_endpoint=self.base_url,
                    api_version="2024-02-15-preview"
                )
            except Exception as e:
                logger.error("Error creating OpenAI client: %s", e)
        return self._client

    def chat_completion(self, messages, temperature=0.7, max_tokens=1000, system_prompt=None):
        """Generate chat completion. Returns dict with choices+usage."""
        client = self._get_client()
        placeholder = {
            "choices": [{"message": {"content": "I found information in the placement documents but I could not reach the language model. Please check the Foundry configuration (endpoint, model, API key)."}}],
            "usage": {"total_tokens": 0}
        }

        if not client:
            logger.warning("Foundry client not configured (endpoint=%s model=%s key=%s)",
                           self.base_url, self.model_deployment, bool(self.api_key))
            return placeholder

        try:
            if system_prompt:
                messages = [{"role": "system", "content": system_prompt}] + messages
            response = client.chat.completions.create(
                model=self.model_deployment,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return {
                "choices": [{"message": {"content": response.choices[0].message.content}}],
                "usage": {"total_tokens": response.usage.total_tokens if response.usage else 0}
            }
        except Exception as e:
            logger.error("Error calling Foundry: %s", e)
            return placeholder


_foundry_client = None

def get_foundry_client():
    global _foundry_client
    if _foundry_client is None:
        _foundry_client = FoundryClient()
    return _foundry_client