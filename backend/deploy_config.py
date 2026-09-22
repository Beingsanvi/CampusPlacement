"""
Azure Functions deployment configuration.
This file helps with deploying to Azure Functions.
"""

import os

# Deployment settings
DEPLOYMENT_CONFIG = {
    "app_name": os.getenv("AZURE_FUNCTION_APP_NAME", "campus-placement-api"),
    "runtime": "python",
    "runtime_version": "3.10",
    "operating_system": "linux",
    "location": "koreacentral"
}

# Required environment variables for Azure Functions
REQUIRED_ENV_VARS = [
    "FOUNDRY_PROJECT_ENDPOINT",
    "MODEL_DEPLOYMENT_NAME",
    "FOUNDRY_API_KEY",
    "AZURE_SEARCH_ENDPOINT",
    "AZURE_SEARCH_API_KEY"
]

def validate_deployment_config():
    """Validate that all required configuration is present."""
    missing = []
    for var in REQUIRED_ENV_VARS:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print(f"Missing environment variables: {', '.join(missing)}")
        return False
    
    print("All required environment variables are set.")
    return True


if __name__ == "__main__":
    print("Deployment Configuration:")
    for key, value in DEPLOYMENT_CONFIG.items():
        print(f"  {key}: {value}")
    
    print("\nValidating environment variables...")
    validate_deployment_config()