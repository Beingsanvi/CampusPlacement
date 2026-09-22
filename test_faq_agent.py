"""
Test the FAQ agent with a real query to verify RAG is working.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv

# Load environment variables
load_dotenv('backend/.env')


def test_faq_agent():
    """Test the FAQ agent with sample queries."""
    from agents.faq_agent import create_faq_agent
    
    print("=" * 60)
    print("Testing FAQ Agent with RAG")
    print("=" * 60)
    
    agent = create_faq_agent()
    
    # Test queries
    test_queries = [
        "What is the minimum CGPA required for placements?",
        "Tell me about TechNova Solutions eligibility",
        "What is the placement process?",
        "What documents are required?"
    ]
    
    for query in test_queries:
        print(f"\n{'-'*60}")
        print(f"Query: {query}")
        print('-'*60)
        
        try:
            response = agent.process(query)
            
            print(f"\nAnswer:\n{response.answer}")
            print(f"\nConfidence: {response.confidence:.2f}")
            print(f"Sources: {response.sources}")
            print(f"Topics: {response.related_topics}")
            
        except Exception as e:
            print(f"Error: {e}")
    
    print(f"\n{'='*60}")
    print("Test Complete!")
    print('='*60)


if __name__ == "__main__":
    test_faq_agent()