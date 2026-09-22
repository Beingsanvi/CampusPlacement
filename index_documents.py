"""
Script to index placement documents into Azure AI Search.
Run this script to populate the search index with your documents.
"""

import os
import sys
import re
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv
from services.search_service import get_search_service, SearchDocument

# Load environment variables
load_dotenv('backend/.env')


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """
    Split text into chunks for indexing.
    
    Args:
        text: Text to chunk
        chunk_size: Maximum chunk size
        overlap: Overlap between chunks
        
    Returns:
        List of text chunks
    """
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        
        # Try to break at a paragraph or sentence
        if end < text_length:
            # Look for paragraph break
            para_break = text.rfind('\n\n', start, end)
            if para_break > start + chunk_size // 2:
                end = para_break + 2
            else:
                # Look for sentence break
                sentence_break = text.rfind('. ', start, end)
                if sentence_break > start + chunk_size // 2:
                    end = sentence_break + 2
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        
        start = end - overlap
    
    return chunks


def read_document(file_path: str) -> str:
    """Read a document file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


def index_documents(documents_path: str):
    """
    Index all documents in the specified path.
    
    Args:
        documents_path: Path to documents directory
    """
    search_service = get_search_service()
    
    print(f"Azure AI Search Endpoint: {search_service.endpoint}")
    print(f"Index Name: {search_service.index_name}")
    print("-" * 50)
    
    # Create index if it doesn't exist
    print("Creating index...")
    # Note: In production, you'd call search_service.create_index()
    # For now, we'll just prepare the documents
    
    # Get all text files
    doc_path = Path(documents_path)
    text_files = list(doc_path.glob("*.txt"))
    
    if not text_files:
        print(f"No text files found in {documents_path}")
        print("Please ensure your documents are in .txt format")
        return
    
    print(f"Found {len(text_files)} documents to index")
    print("-" * 50)
    
    total_chunks = 0
    
    for file_path in text_files:
        print(f"\nProcessing: {file_path.name}")
        
        # Read document
        content = read_document(file_path)
        
        # Chunk the content
        chunks = chunk_text(content)
        print(f"  - Split into {len(chunks)} chunks")
        
        # Prepare documents for indexing
        documents = []
        for i, chunk in enumerate(chunks):
            doc = SearchDocument(
                id=f"{file_path.stem}_{i}",
                content=chunk,
                title=file_path.stem.replace('_', ' ').title(),
                source=file_path.name,
                metadata={"chunk_index": i, "total_chunks": len(chunks)}
            )
            documents.append(doc)
        
        # Index documents
        # Note: In production, you'd call search_service.index_document(doc)
        # For now, we'll just print what would be indexed
        print(f"  - Prepared {len(documents)} documents for indexing")
        
        # Show sample chunk
        if chunks:
            print(f"  - Sample chunk preview: {chunks[0][:100]}...")
        
        total_chunks += len(documents)
    
    print("-" * 50)
    print(f"Total documents prepared: {total_chunks}")
    print("\nTo complete indexing, run the Azure Function or use the search service directly.")
    
    return total_chunks


if __name__ == "__main__":
    documents_path = "documents"
    
    if not os.path.exists(documents_path):
        print(f"Documents folder not found at: {documents_path}")
        print("Please ensure the 'documents' folder exists in the project root.")
    else:
        print("=" * 50)
        print("Campus Placement AI - Document Indexing")
        print("=" * 50)
        index_documents(documents_path)