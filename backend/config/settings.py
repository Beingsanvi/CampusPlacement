"""
Configuration settings for Campus Placement AI Agent.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AzureConfig:
    """Azure service configuration."""
    # Microsoft Foundry
    foundry_project_endpoint: str = os.getenv("FOUNDRY_PROJECT_ENDPOINT", "")
    model_deployment_name: str = os.getenv("MODEL_DEPLOYMENT_NAME", "")
    foundry_api_key: str = os.getenv("FOUNDRY_API_KEY", "")
    # Optional override for the OpenAI-compatible host derived from the project endpoint
    foundry_openai_base_url: str = os.getenv("FOUNDRY_OPENAI_BASE_URL", "")
    
    # Azure AI Search
    search_endpoint: str = os.getenv("AZURE_SEARCH_ENDPOINT", "")
    search_api_key: str = os.getenv("AZURE_SEARCH_API_KEY", "")
    search_index_name: str = os.getenv("AZURE_SEARCH_INDEX_NAME", "placement-documents")
    
    # Azure Key Vault (optional)
    key_vault_url: str = os.getenv("KEY_VAULT_URL", "")


@dataclass
class GitHubConfig:
    """GitHub configuration."""
    token: str = os.getenv("GITHUB_TOKEN", "")
    repo_owner: str = os.getenv("GITHUB_REPO_OWNER", "")
    repo_name: str = os.getenv("GITHUB_REPO_NAME", "campus-placement-ai")
    documents_path: str = "documents/"
    output_path: str = "output/"


@dataclass
class SMTPConfig:
    """SMTP settings for sending cold application emails."""
    host: str = os.getenv("SMTP_HOST", "")
    port: int = int(os.getenv("SMTP_PORT", "587"))
    username: str = os.getenv("SMTP_USERNAME", "")
    password: str = os.getenv("SMTP_PASSWORD", "")
    email_from: str = os.getenv("EMAIL_FROM", "")
    from_name: str = os.getenv("EMAIL_FROM_NAME", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.host and self.username and self.password and self.email_from)


@dataclass
class AppConfig:
    """Application configuration."""
    app_name: str = "Campus Placement AI"
    version: str = "2.0.0"
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Local persistent storage (file-based; also works on Azure Functions tmp fs)
    data_dir: str = os.getenv("DATA_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"))

    # Agent settings
    max_response_length: int = 2000
    confidence_threshold: float = 0.7

    # Job scraping
    jobs_cache_ttl_seconds: int = int(os.getenv("JOBS_CACHE_TTL_SECONDS", "3600"))
    jobs_max_per_source: int = int(os.getenv("JOBS_MAX_PER_SOURCE", "50"))

    # CORS settings for frontend
    allowed_origins: list = None

    def __post_init__(self):
        os.makedirs(self.data_dir, exist_ok=True)
        if self.allowed_origins is None:
            self.allowed_origins = ["*"]


@dataclass
class Settings:
    """Main settings class combining all configurations."""
    azure: AzureConfig = None
    github: GitHubConfig = None
    app: AppConfig = None
    smtp: SMTPConfig = None

    def __post_init__(self):
        self.azure = AzureConfig()
        self.github = GitHubConfig()
        self.app = AppConfig()
        self.smtp = SMTPConfig()


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the global settings instance."""
    return settings