"""
Quick test script to verify the setup.
Run this after installing dependencies.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')


def test_environment():
    """Test if environment variables are set."""
    print("=" * 50)
    print("Environment Variables Check")
    print("=" * 50)
    
    required_vars = [
        "FOUNDRY_PROJECT_ENDPOINT",
        "MODEL_DEPLOYMENT_NAME",
        "AZURE_SEARCH_ENDPOINT",
        "AZURE_SEARCH_API_KEY"
    ]
    
    all_set = True
    for var in required_vars:
        value = os.getenv(var, "")
        if value:
            # Mask sensitive values
            if "KEY" in var:
                display_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "***"
            else:
                display_value = value[:50] + "..." if len(value) > 50 else value
            print(f"✓ {var}: {display_value}")
        else:
            print(f"✗ {var}: NOT SET")
            all_set = False
    
    print("=" * 50)
    return all_set


def test_imports():
    """Test if required packages are installed."""
    print("\n" + "=" * 50)
    print("Package Import Check")
    print("=" * 50)
    
    packages = [
        ("azure.identity", "Azure Identity"),
        ("openai", "OpenAI SDK (AzureOpenAI)"),
        ("azure.search.documents", "Azure Search"),
        ("requests", "Requests (HTTP/scraping)"),
        ("dotenv", "python-dotenv")
    ]
    
    all_installed = True
    for package, name in packages:
        try:
            __import__(package)
            print(f"✓ {name} ({package})")
        except ImportError:
            print(f"✗ {name} ({package}) - NOT INSTALLED")
            all_installed = False
    
    print("=" * 50)
    return all_installed


def test_agents():
    """Test if agents can be imported."""
    print("\n" + "=" * 50)
    print("Agent Import Check")
    print("=" * 50)
    
    try:
        from agents import create_main_agent
        print("✓ Main Agent")
    except Exception as e:
        print(f"✗ Main Agent: {e}")
        return False
    
    try:
        from agents.faq_agent import create_faq_agent
        print("✓ FAQ Agent")
    except Exception as e:
        print(f"✗ FAQ Agent: {e}")
        return False
    
    try:
        from agents.preparation_agent import create_preparation_agent
        print("✓ Preparation Agent")
    except Exception as e:
        print(f"✗ Preparation Agent: {e}")
        return False
    
    print("=" * 50)
    return True


def main():
    """Run all tests."""
    print("\n" + "=" * 50)
    print("Campus Placement AI - Setup Verification")
    print("=" * 50)
    
    # Test 1: Environment variables
    env_ok = test_environment()
    
    # Test 2: Package imports
    packages_ok = test_imports()
    
    # Test 3: Agent imports
    agents_ok = test_agents()
    
    print("\n" + "=" * 50)
    print("Summary")
    print("=" * 50)
    
    if env_ok and packages_ok and agents_ok:
        print("✓ All checks passed! You're ready to go.")
        print("\nNext steps:")
        print("1. Run: python index_documents.py (to index documents)")
        print("2. Run: cd backend && func start (to start the API)")
        print("3. Open frontend/index.html in a browser")
    else:
        print("✗ Some checks failed. Please fix the issues above.")
        if not packages_ok:
            print("\nTo install missing packages:")
            print("  cd backend && pip install -r requirements.txt")
    
    print("=" * 50)


if __name__ == "__main__":
    main()