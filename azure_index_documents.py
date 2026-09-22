"""
Script to actually index documents into Azure AI Search.
Run this after test_setup.py passes.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex,
    SimpleField,
    SearchableField,
    SearchFieldDataType
)
from azure.core.credentials import AzureKeyCredential

# Load environment variables
load_dotenv('backend/.env')


def create_search_index():
    """Create the search index in Azure AI Search."""
    endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
    api_key = os.getenv("AZURE_SEARCH_API_KEY")
    index_name = os.getenv("AZURE_SEARCH_INDEX_NAME", "placement-documents")
    
    print(f"Creating index: {index_name}")
    
    # Create index client
    credential = AzureKeyCredential(api_key)
    index_client = SearchIndexClient(endpoint=endpoint, credential=credential)
    
    # Define index
    index = SearchIndex(
        name=index_name,
        fields=[
            SimpleField(name="id", type=SearchFieldDataType.String, key=True),
            SearchableField(name="title", type=SearchFieldDataType.String),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SimpleField(name="source", type=SearchFieldDataType.String),
            SimpleField(name="chunk_index", type=SearchFieldDataType.Int32)
        ]
    )
    
    # Create or update index
    try:
        index_client.delete_index(index_name)
        print(f"  Deleted existing index: {index_name}")
    except Exception:
        pass
    
    index_client.create_index(index)
    print(f"  Created index: {index_name}")
    
    return index_client, index_name


def chunk_text(text, chunk_size=1000, overlap=200):
    """Split text into chunks."""
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        
        if end < text_length:
            para_break = text.rfind('\n\n', start, end)
            if para_break > start + chunk_size // 2:
                end = para_break + 2
            else:
                sentence_break = text.rfind('. ', start, end)
                if sentence_break > start + chunk_size // 2:
                    end = sentence_break + 2
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        
        start = end - overlap
    
    return chunks


def index_documents():
    """Index all documents into Azure AI Search."""
    endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
    api_key = os.getenv("AZURE_SEARCH_API_KEY")
    index_name = os.getenv("AZURE_SEARCH_INDEX_NAME", "placement-documents")
    
    # Create index
    index_client, index_name = create_search_index()
    
    # Create search client
    credential = AzureKeyCredential(api_key)
    search_client = SearchClient(endpoint=endpoint, index_name=index_name, credential=credential)
    
    # Get all text files
    doc_path = Path("documents")
    text_files = list(doc_path.glob("*.txt"))
    
    print(f"\nIndexing {len(text_files)} documents...")
    
    total_chunks = 0
    
    for file_path in text_files:
        print(f"\nProcessing: {file_path.name}")
        
        # Read document
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Chunk the content
        chunks = chunk_text(content)
        print(f"  - Split into {len(chunks)} chunks")
        
        # Prepare documents for indexing
        documents = []
        for i, chunk in enumerate(chunks):
            doc = {
                "id": f"{file_path.stem}_{i}",
                "title": file_path.stem.replace('_', ' ').title(),
                "content": chunk,
                "source": file_path.name,
                "chunk_index": i
            }
            documents.append(doc)
        
        # Index documents in batches
        batch_size = 10
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            result = search_client.upload_documents(documents=batch)
            print(f"  - Indexed batch {i//batch_size + 1}: {len(batch)} documents")
        
        total_chunks += len(documents)
    
    print(f"\n{'='*50}")
    print(f"Indexing complete!")
    print(f"Total documents indexed: {total_chunks}")
    print(f"Index: {index_name}")
    print(f"Endpoint: {endpoint}")
    print(f"{'='*50}")


if __name__ == "__main__":
    index_documents()