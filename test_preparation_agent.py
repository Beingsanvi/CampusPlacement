"""
Test the Preparation Agent.
"""

import os
import sys
import asyncio

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')


async def test_preparation_agent():
    """Test the Preparation Agent with sample queries."""
    from agents.preparation_agent import create_preparation_agent
    
    print("=" * 60)
    print("Testing Preparation Agent")
    print("=" * 60)
    
    agent = create_preparation_agent()
    
    # Test queries
    test_queries = [
        "I have 30 days before placements. What should I prepare?",
        "How should I prepare for TechNova Solutions?",
        "Give me a plan for coding preparation"
    ]
    
    for query in test_queries:
        print(f"\n{'-'*60}")
        print(f"Query: {query}")
        print('-'*60)
        
        try:
            response = agent.process(query)
            
            print(f"\n{response.answer}")
            print(f"\nConfidence: {response.confidence:.2f}")
            print(f"Sources: {response.sources}")
            
        except Exception as e:
            print(f"Error: {e}")
    
    print(f"\n{'='*60}")
    print("Test Complete!")
    print('='*60)


if __name__ == "__main__":
    asyncio.run(test_preparation_agent())