"""
Main Placement Agent - Orchestrates the placement assistance system.

This agent coordinates between FAQ Agent and Preparation Agent
to provide comprehensive placement support to students.
"""

import os
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class QueryType(Enum):
    """Types of queries the system can handle."""
    FAQ = "faq"
    PREPARATION = "preparation"
    GENERAL = "general"
    UNKNOWN = "unknown"


@dataclass
class AgentResponse:
    """Response structure from agents."""
    answer: str
    agent_used: str
    confidence: float
    sources: list
    query_type: str


class MainPlacementAgent:
    """
    Main Campus Placement AI Agent.
    
    Responsibilities:
    - Understand the student's request
    - Determine what type of task is required
    - Coordinate specialized agents
    - Use placement knowledge
    - Ensure answers are grounded
    - Never invent university/company policies
    """
    
    def __init__(self):
        self.faq_agent = None
        self.preparation_agent = None
        self.knowledge_source = None
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize sub-agents."""
        try:
            from .faq_agent import PlacementFAQAgent
            from .preparation_agent import PlacementPreparationAgent
            
            self.faq_agent = PlacementFAQAgent()
            self.preparation_agent = PlacementPreparationAgent()
        except ImportError:
            print("Warning: Sub-agents not available. Running in standalone mode.")
    
    def classify_query(self, query: str) -> QueryType:
        """
        Classify the user query to determine the appropriate agent.
        
        Args:
            query: The user's question or request
            
        Returns:
            QueryType enum indicating the appropriate agent
        """
        query_lower = query.lower()
        
        # Keywords for FAQ queries
        faq_keywords = [
            'what is', 'what are', 'how many', 'minimum', 'maximum',
            'required', 'eligible', 'eligibility', 'can i', 'is it',
            'tell me about', 'explain', 'describe', 'details about',
            'cgpa', 'backlog', 'branch', 'company', 'requirement',
            'policy', 'rule', 'guideline', 'process', 'deadline',
            'tech nova', 'datasphere', 'cloudnova', 'documents'
        ]
        
        # Keywords for preparation queries
        preparation_keywords = [
            'prepare', 'preparation', 'plan', 'schedule', 'study',
            'practice', 'how to', 'tips', 'strategy', 'days before',
            'interview', 'aptitude', 'coding', 'technical', 'hr',
            'assessment', 'test', 'learn', 'improve', 'strong',
            'weakness', 'strength', 'time', 'days', 'weeks'
        ]
        
        # Check for preparation queries first (more specific)
        if any(keyword in query_lower for keyword in preparation_keywords):
            if any(time_word in query_lower for time_word in ['days', 'weeks', 'before', 'plan', 'schedule']):
                return QueryType.PREPARATION
        
        # Check for FAQ queries
        if any(keyword in query_lower for keyword in faq_keywords):
            return QueryType.FAQ
        
        # Default to general (will try FAQ first)
        return QueryType.GENERAL
    
    def process_query(self, query: str, context: Optional[Dict[str, Any]] = None) -> AgentResponse:
        """
        Process a student query and return an appropriate response.
        
        Args:
            query: The student's question or request
            context: Optional context information
            
        Returns:
            AgentResponse with the answer and metadata
        """
        if not query or not query.strip():
            return AgentResponse(
                answer="Please provide a valid question about campus placements.",
                agent_used="main",
                confidence=0.0,
                sources=[],
                query_type="invalid"
            )
        
        query_type = self.classify_query(query)
        
        # Route to appropriate agent (normalize into a uniform AgentResponse)
        if query_type == QueryType.PREPARATION and self.preparation_agent:
            resp = self.preparation_agent.process(query, context)
            return AgentResponse(
                answer=resp.answer,
                agent_used="preparation",
                confidence=getattr(resp, "confidence", 0.9),
                sources=getattr(resp, "sources", []),
                query_type="preparation"
            )
        elif query_type in [QueryType.FAQ, QueryType.GENERAL] and self.faq_agent:
            resp = self.faq_agent.process(query, context)
            return AgentResponse(
                answer=resp.answer,
                agent_used="faq",
                confidence=getattr(resp, "confidence", 0.85),
                sources=getattr(resp, "sources", []),
                query_type="faq"
            )
        else:
            # Standalone mode - provide basic response
            return self._standalone_response(query)
    
    def _standalone_response(self, query: str) -> AgentResponse:
        """Provide a response when sub-agents are not available."""
        return AgentResponse(
            answer=(
                "I'm the Main Campus Placement Agent. I can help you with:\n\n"
                "1. Placement eligibility and requirements\n"
                "2. Company-specific information\n"
                "3. Placement process details\n"
                "4. Preparation guidance\n\n"
                "Please connect me to the FAQ Agent and Preparation Agent "
                "for detailed responses, or check the knowledge base for "
                "specific information."
            ),
            agent_used="main_standalone",
            confidence=0.5,
            sources=["main_agent_knowledge"],
            query_type="general"
        )
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get the current status of the agent system."""
        return {
            "main_agent": "active",
            "faq_agent": "active" if self.faq_agent else "inactive",
            "preparation_agent": "active" if self.preparation_agent else "inactive",
            "knowledge_source": "connected" if self.knowledge_source else "not_connected"
        }


# Convenience function for quick access
def create_main_agent() -> MainPlacementAgent:
    """Create and return a MainPlacementAgent instance."""
    return MainPlacementAgent()