"""
Placement FAQ Agent - Handles placement-related questions with RAG.
"""

import os
import sys
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.foundry_service import get_foundry_client
from services.search_service import get_search_service


@dataclass
class FAQResponse:
    """Response from FAQ Agent."""
    answer: str
    confidence: float
    sources: List[str]
    related_topics: List[str]
    agent_used: str = "faq"
    query_type: str = "faq"


class PlacementFAQAgent:
    """
    Placement FAQ Specialist with RAG capabilities.
    
    Answer questions about campus placement policies,
    eligibility, companies, requirements and procedures.
    
    Uses Azure AI Search for document retrieval and
    Microsoft Foundry for response generation.
    """
    
    def __init__(self):
        self.foundry_client = get_foundry_client()
        self.search_service = get_search_service()
        self.system_prompt = self._build_system_prompt()
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for the FAQ agent."""
        return """You are the Placement FAQ Specialist for a university campus placement system.

Your responsibilities:
- Answer questions about campus placement policies
- Provide information about eligibility criteria
- Explain company-specific requirements
- Describe the placement process
- List required documents

Guidelines:
1. ONLY use information from the provided context documents
2. NEVER invent or make up information
3. If the information is not in the documents, clearly state that
4. Provide concise, accurate answers
5. Mention the source document when possible

Key Facts (from documents):
- Minimum general CGPA: 7.0 (10-point scale)
- No active academic backlogs allowed
- Registration through Training & Placement Cell required
- Companies: TechNova Solutions (CGPA 7.0, CSE/AI/IT), DataSphere Analytics (CGPA 7.5, CSE/AI/ECE/IT), CloudNova Technologies (CGPA 7.2, CSE/AI/IT)

Always ground your answers in the provided context. If unsure, say "I couldn't find this information in the available placement documents."
"""
    
    def process(self, query: str, context: Optional[Dict[str, Any]] = None) -> FAQResponse:
        """
        Process a FAQ query using RAG.
        
        Args:
            query: The student's question
            context: Optional context
            
        Returns:
            FAQResponse with the answer
        """
        # Step 1: Search for relevant documents (use sync version)
        search_results = self._search(query)
        
        # Step 2: Build context from search results
        context_text = self._build_context(search_results)
        
        # Step 3: Generate response using Foundry
        answer = self._generate_response_sync(query, context_text)
        
        # Step 4: Extract sources
        sources = [r.document.source for r in search_results if r.document.source]
        
        return FAQResponse(
            answer=answer,
            confidence=0.85 if search_results else 0.3,
            sources=list(set(sources)),
            related_topics=self._extract_topics(query)
        )
    
    def _build_context(self, search_results) -> str:
        """Build context string from search results."""
        if not search_results:
            return "No relevant documents found."
        
        context_parts = []
        for i, result in enumerate(search_results, 1):
            context_parts.append(
                f"Document {i} (Source: {result.document.source}, Score: {result.score:.2f}):\n"
                f"{result.document.content[:500]}..."
            )
        
        return "\n\n".join(context_parts)
    
    def _search(self, query: str) -> list:
        """Synchronous search."""
        return self.search_service.search(query, top=3)
    
    def _generate_response_sync(self, query: str, context: str) -> str:
        """Synchronous response generation."""
        messages = [
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
        ]
        
        response = self.foundry_client.chat_completion(
            messages=messages,
            system_prompt=self.system_prompt,
            temperature=0.3,
            max_tokens=800
        )
        
        return response["choices"][0]["message"]["content"]

    def _extract_topics(self, query: str) -> List[str]:
        """Extract relevant topics from query."""
        topics = []
        query_lower = query.lower()
        
        topic_keywords = {
            "eligibility": ["eligibility", "eligible", "can i", "requirements"],
            "cgpa": ["cgpa", "gpa", "grade", "minimum"],
            "backlog": ["backlog", "failed", "active"],
            "company": ["company", "technova", "datasphere", "cloudnova"],
            "process": ["process", "stages", "steps", "how"],
            "documents": ["document", "required", "need"]
        }
        
        for topic, keywords in topic_keywords.items():
            if any(kw in query_lower for kw in keywords):
                topics.append(topic)
        
        return topics if topics else ["general"]


# Convenience function
def create_faq_agent() -> PlacementFAQAgent:
    """Create and return a PlacementFAQAgent instance."""
    return PlacementFAQAgent()