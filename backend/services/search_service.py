"""
Search Service - Integration with Azure AI Search for RAG.
"""

import os
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

try:
    from azure.search.documents import SearchClient
    from azure.search.documents.indexes.models import (
        SearchIndex,
        SimpleField,
        SearchableField,
        SearchFieldDataType
    )
    from azure.core.credentials import AzureKeyCredential
    SEARCH_SDK_AVAILABLE = True
except ImportError:
    SEARCH_SDK_AVAILABLE = False


@dataclass
class SearchDocument:
    id: str
    content: str
    title: str
    source: str
    metadata: Dict[str, Any]

@dataclass
class SearchResult:
    document: SearchDocument
    score: float


class SearchService:
    def __init__(self):
        self.endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT", "")
        self.api_key = os.environ.get("AZURE_SEARCH_API_KEY", "")
        self.index_name = os.environ.get("AZURE_SEARCH_INDEX_NAME", "placement-documents")
        self._search_client = None
    
    def _get_client(self):
        if self._search_client is None and SEARCH_SDK_AVAILABLE and self.api_key:
            try:
                self._search_client = SearchClient(
                    endpoint=self.endpoint,
                    index_name=self.index_name,
                    credential=AzureKeyCredential(self.api_key)
                )
            except Exception as e:
                print(f"Error creating search client: {e}")
        return self._search_client
    
    def search(self, query: str, top: int = 3) -> List[SearchResult]:
        client = self._get_client()
        
        if client:
            try:
                results = client.search(search_text=query, top=top)
                search_results = []
                for result in results:
                    doc = SearchDocument(
                        id=result["id"],
                        content=result["content"],
                        title=result.get("title", ""),
                        source=result.get("source", ""),
                        metadata={}
                    )
                    search_results.append(SearchResult(document=doc, score=result.get("@search.score", 0.0)))
                return search_results
            except Exception as e:
                print(f"Search error: {e}")
        
        return []


_search_service = None

def get_search_service():
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service