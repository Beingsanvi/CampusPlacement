"""
Placement Preparation Agent - Helps students prepare for placements.

This agent specializes in:
- Creating preparation plans
- Providing study schedules
- Offering interview tips
- Suggesting practice resources
- Company-specific preparation guidance
"""

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta


@dataclass
class PreparationPlan:
    """A structured preparation plan."""
    timeline: str
    daily_schedule: Dict[str, List[str]]
    weekly_goals: List[str]
    focus_areas: List[str]
    tips: List[str]
    resources: List[str]


@dataclass
class PreparationResponse:
    """Response from Preparation Agent."""
    answer: str
    plan: Optional[PreparationPlan]
    confidence: float
    sources: List[str]


class PlacementPreparationAgent:
    """
    Campus Placement Preparation Specialist.
    
    Help students prepare for campus placement assessments
    and interviews.
    
    Creates practical preparation plans based on:
    - Available assessment information
    - Student timeline
    - Student strengths/weaknesses
    - Required skills
    """
    
    def __init__(self):
        self.preparation_guidelines = self._load_guidelines()
    
    def _load_guidelines(self) -> Dict[str, Any]:
        """Load preparation guidelines from knowledge base."""
        return {
            "aptitude": {
                "topics": [
                    "Logical Reasoning",
                    "Quantitative Aptitude",
                    "Verbal Ability",
                    "Data Interpretation"
                ],
                "resources": ["IndiaBix", "PrepInsta", "Smartkeeda"],
                "daily_practice": "1-2 hours"
            },
            "coding": {
                "topics": [
                    "Data Structures (Arrays, Linked Lists, Trees, Graphs)",
                    "Algorithms (Sorting, Searching, DP, Greedy)",
                    "Programming Languages (Python, Java, C++)",
                    "Problem-solving techniques"
                ],
                "resources": ["LeetCode", "GeeksforGeeks", "HackerRank"],
                "daily_practice": "2-3 hours"
            },
            "technical": {
                "topics": [
                    "Core CS concepts (OS, DBMS, CN)",
                    "System Design basics",
                    "Project discussion",
                    "Technical fundamentals"
                ],
                "resources": ["InterviewBit", "System Design resources"],
                "daily_practice": "1-2 hours"
            },
            "hr": {
                "topics": [
                    "Tell me about yourself",
                    "Strengths and weaknesses",
                    "Career goals",
                    "Company research",
                    "Behavioral questions (STAR method)"
                ],
                "resources": ["Mock interviews", "HR interview questions"],
                "daily_practice": "30 minutes"
            },
            "company_specific": {
                "technova_solutions": {
                    "name": "TechNova Solutions",
                    "focus": ["Python/Java", "SQL basics", "DSA"],
                    "practice_areas": ["Coding problems", "Aptitude tests"],
                    "process": ["Aptitude Test", "Coding Test", "Technical Interview", "HR Interview"],
                    "tips": [
                        "Focus on Python/Java programming",
                        "Practice SQL queries",
                        "Solve DSA problems on LeetCode",
                        "Prepare for aptitude tests"
                    ]
                },
                "datasphere_analytics": {
                    "name": "DataSphere Analytics",
                    "focus": ["SQL proficiency", "Python for data", "Statistics", "ML basics"],
                    "practice_areas": ["SQL queries", "Data analysis", "ML concepts"],
                    "process": ["Aptitude Test", "SQL/Data Assessment", "Technical Interview", "HR Interview"],
                    "tips": [
                        "Master SQL joins and queries",
                        "Learn Python pandas basics",
                        "Study statistics fundamentals",
                        "Understand ML concepts"
                    ]
                },
                "cloudnova_technologies": {
                    "name": "CloudNova Technologies",
                    "focus": ["Programming fundamentals", "Cloud basics", "Linux", "Docker"],
                    "practice_areas": ["Coding problems", "System design basics"],
                    "process": ["Coding Test", "Technical Interview", "Managerial Interview", "HR Interview"],
                    "tips": [
                        "Strengthen programming fundamentals",
                        "Learn Linux command line",
                        "Understand Docker basics",
                        "Practice system design"
                    ]
                }
            }
        }
    
    def process(self, query: str, context: Optional[Dict[str, Any]] = None) -> PreparationResponse:
        """
        Process a preparation query and return a plan.
        
        Args:
            query: The student's preparation request
            context: Optional context (e.g., timeline, strengths)
            
        Returns:
            PreparationResponse with the plan
        """
        query_lower = query.lower()
        
        # Extract timeline if mentioned
        timeline = self._extract_timeline(query_lower)
        
        # Check for company-specific preparation
        for company in ['technova', 'datasphere', 'cloudnova']:
            if company in query_lower:
                return self._company_specific_preparation(company, timeline)
        
        # Check for specific area preparation
        if any(keyword in query_lower for keyword in ['aptitude', 'quantitative', 'reasoning']):
            return self._area_specific_preparation('aptitude', timeline)
        
        if any(keyword in query_lower for keyword in ['coding', 'programming', 'dsa', 'data structure']):
            return self._area_specific_preparation('coding', timeline)
        
        if any(keyword in query_lower for keyword in ['technical', 'interview', 'cs concepts']):
            return self._area_specific_preparation('technical', timeline)
        
        if any(keyword in query_lower for keyword in ['hr', 'behavioral', 'tell me about yourself']):
            return self._area_specific_preparation('hr', timeline)
        
        # General preparation plan
        return self._general_preparation_plan(timeline)
    
    def _extract_timeline(self, query: str) -> str:
        """Extract timeline from query."""
        if '30 days' in query or '30days' in query:
            return "30 days"
        elif '15 days' in query or '15days' in query:
            return "15 days"
        elif '1 week' in query or '7 days' in query:
            return "1 week"
        elif '2 weeks' in query or '14 days' in query:
            return "2 weeks"
        elif '1 month' in query:
            return "30 days"
        elif '2 months' in query:
            return "60 days"
        else:
            return "30 days"  # Default
    
    def _general_preparation_plan(self, timeline: str) -> PreparationResponse:
        """Create a general preparation plan."""
        days = self._parse_timeline(timeline)
        
        plan = PreparationPlan(
            timeline=timeline,
            daily_schedule={
                "morning": [
                    "1 hour - Aptitude practice (logical reasoning, quantitative)"
                ],
                "afternoon": [
                    "2 hours - Coding practice (DSA problems)",
                    "1 hour - Technical concepts"
                ],
                "evening": [
                    "1 hour - HR interview preparation",
                    "30 minutes - Company research"
                ]
            },
            weekly_goals=[
                f"Week 1: Focus on fundamentals - aptitude basics, coding basics",
                f"Week 2: Practice medium-level problems, technical concepts",
                f"Week 3: Advanced problems, mock interviews",
                f"Week 4: Company-specific preparation, final revision"
            ],
            focus_areas=[
                "Aptitude (Logical Reasoning, Quantitative)",
                "Coding (Data Structures & Algorithms)",
                "Technical Interview (CS fundamentals)",
                "HR Interview (Behavioral questions)"
            ],
            tips=[
                "Start with basics and gradually increase difficulty",
                "Practice at least 5-10 coding problems daily",
                "Take mock interviews regularly",
                "Research companies before interviews",
                "Maintain a consistent schedule"
            ],
            resources=[
                "LeetCode, GeeksforGeeks for coding",
                "IndiaBix for aptitude",
                "InterviewBit for technical interviews",
                "Mock interview platforms"
            ]
        )
        
        answer = self._format_plan(plan)
        
        return PreparationResponse(
            answer=answer,
            plan=plan,
            confidence=0.9,
            sources=["placement_guidelines.txt"]
        )
    
    def _company_specific_preparation(self, company: str, timeline: str) -> PreparationResponse:
        """Create company-specific preparation plan."""
        company_data = self.preparation_guidelines["company_specific"].get(company, {})
        
        if not company_data:
            return PreparationResponse(
                answer="I couldn't find specific preparation guidelines for that company.",
                plan=None,
                confidence=0.3,
                sources=[]
            )
        
        company_name = company_data.get("name", company.replace("_", " ").title())
        focus_areas = company_data.get("focus", [])
        practice_areas = company_data.get("practice_areas", [])
        process = company_data.get("process", [])
        tips = company_data.get("tips", [])
        
        # Build detailed answer
        answer_lines = [
            f"## Preparation Plan for {company_name}",
            "",
            f"**Timeline:** {timeline}",
            "",
            "### Selection Process",
        ]
        
        for i, step in enumerate(process, 1):
            answer_lines.append(f"{i}. {step}")
        
        answer_lines.extend([
            "",
            "### Focus Areas",
        ])
        for area in focus_areas:
            answer_lines.append(f"- {area}")
        
        answer_lines.extend([
            "",
            "### Practice Areas",
        ])
        for area in practice_areas:
            answer_lines.append(f"- {area}")
        
        answer_lines.extend([
            "",
            "### Daily Schedule",
            f"- Morning: {focus_areas[0] if focus_areas else 'General preparation'} practice (1 hour)",
            "- Afternoon: Coding problems (2 hours)",
            f"- Evening: {practice_areas[0] if practice_areas else 'Technical concepts'} (1 hour)",
            "",
            "### Tips",
        ])
        for tip in tips:
            answer_lines.append(f"- {tip}")
        
        answer_lines.extend([
            "",
            "### Resources",
            "- Company-specific practice on GeeksforGeeks",
            "- LeetCode for coding problems",
            "- Mock interviews with peers"
        ])
        
        answer = "\n".join(answer_lines)
        
        return PreparationResponse(
            answer=answer,
            plan=None,
            confidence=0.9,
            sources=["company_eligibility.txt", "placement_guidelines.txt"]
        )
    
    def _area_specific_preparation(self, area: str, timeline: str) -> PreparationResponse:
        """Create area-specific preparation plan."""
        area_data = self.preparation_guidelines.get(area, {})
        
        if not area_data:
            return PreparationResponse(
                answer=f"I couldn't find specific preparation guidelines for {area}.",
                plan=None,
                confidence=0.3,
                sources=[]
            )
        
        topics = area_data.get("topics", [])
        resources = area_data.get("resources", [])
        daily_practice = area_data.get("daily_practice", "1-2 hours")
        
        plan = PreparationPlan(
            timeline=timeline,
            daily_schedule={
                "daily_practice": [f"Spend {daily_practice} on {area}"],
                "topics": topics
            },
            weekly_goals=[
                f"Master all {area} topics",
                f"Practice with resources: {', '.join(resources[:3])}",
                "Take practice tests"
            ],
            focus_areas=topics,
            tips=[
                f"Dedicate {daily_practice} daily to {area}",
                "Practice with real problems",
                "Track your progress"
            ],
            resources=resources
        )
        
        answer = self._format_plan(plan)
        
        return PreparationResponse(
            answer=answer,
            plan=plan,
            confidence=0.85,
            sources=["placement_guidelines.txt"]
        )
    
    def _parse_timeline(self, timeline: str) -> int:
        """Parse timeline string to days."""
        if '30 days' in timeline or '1 month' in timeline:
            return 30
        elif '15 days' in timeline:
            return 15
        elif '1 week' in timeline or '7 days' in timeline:
            return 7
        elif '2 weeks' in timeline or '14 days' in timeline:
            return 14
        elif '2 months' in timeline:
            return 60
        else:
            return 30
    
    def _format_plan(self, plan: PreparationPlan) -> str:
        """Format a preparation plan for display."""
        lines = [
            f"## Preparation Plan ({plan.timeline})",
            "",
            "### Daily Schedule",
        ]
        
        for time_slot, activities in plan.daily_schedule.items():
            lines.append(f"\n**{time_slot.title()}:**")
            for activity in activities:
                lines.append(f"- {activity}")
        
        lines.extend([
            "",
            "### Weekly Goals",
        ])
        for goal in plan.weekly_goals:
            lines.append(f"- {goal}")
        
        lines.extend([
            "",
            "### Focus Areas",
        ])
        for area in plan.focus_areas:
            lines.append(f"- {area}")
        
        lines.extend([
            "",
            "### Tips",
        ])
        for tip in plan.tips:
            lines.append(f"- {tip}")
        
        lines.extend([
            "",
            "### Resources",
        ])
        for resource in plan.resources:
            lines.append(f"- {resource}")
        
        return "\n".join(lines)


# Convenience function
def create_preparation_agent() -> PlacementPreparationAgent:
    """Create and return a PlacementPreparationAgent instance."""
    return PlacementPreparationAgent()