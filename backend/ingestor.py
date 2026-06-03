import os
import shutil
import chromadb
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

import tempfile

# Use writeable temp directory on Linux (Railway/production) to avoid permission errors, local path on Windows
if os.name == "nt":
    CHROMA_PATH = "./chroma_db"
else:
    CHROMA_PATH = os.path.join(tempfile.gettempdir(), "chroma_db")

COLLECTION  = "videos"

# Module-level singleton — prevents multiple processes opening the SQLite file
_chroma_client = None


def _get_client() -> chromadb.PersistentClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    return _chroma_client


_embeddings_instance = None


def get_embeddings():
    # Free local embeddings — runs on CPU, no API key needed
    global _embeddings_instance
    if _embeddings_instance is None:
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings_instance


def get_vectorstore():
    return Chroma(
        client=_get_client(),
        embedding_function=get_embeddings(),
        collection_name=COLLECTION,
    )


def ingest_video(video_data: dict, label: str) -> dict:
    """
    Chunk transcript → embed → store in ChromaDB.
    Every chunk gets rich metadata so the LLM can cite precisely.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=300,     # ~300 tokens = one tight idea unit (optimal for social media speech)
        chunk_overlap=50,   # 50-token overlap preserves cross-boundary context
        separators=["\n\n", "\n", ". ", "! ", "? ", ", ", " ", ""],
    )

    chunks = splitter.split_text(video_data["transcript"])
    if not chunks:
        chunks = ["[No transcript available]"]

    # Build per-chunk metadata — this drives citation quality
    metadatas = []
    ids = []
    for i, _ in enumerate(chunks):
        metadatas.append({
            "video_id":       label,
            "platform":       video_data["platform"],
            "creator":        video_data["creator"],
            "title":          video_data["title"][:100],
            "views":          video_data["views"],
            "likes":          video_data["likes"],
            "comments":       video_data["comments"],
            "engagement_rate": video_data["engagement_rate"],
            "follower_count": video_data["channel_follower_count"],
            "upload_date":    video_data["upload_date"],
            "duration":       video_data["duration"],
            "hashtags":       ", ".join(video_data["hashtags"]),
            "chunk_index":    i,
            "source":         f"Video {label} — chunk {i + 1}",
        })
        ids.append(f"video_{label}_chunk_{i}")

    vs = get_vectorstore()
    vs.add_texts(texts=chunks, metadatas=metadatas, ids=ids)

    return {"chunks_stored": len(chunks), "label": label}


def clear_vectorstore():
    global _chroma_client
    # Release the client handle so Windows unlocks the SQLite file
    if _chroma_client is not None:
        try:
            _chroma_client.reset()
        except Exception:
            pass
        _chroma_client = None
    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)
