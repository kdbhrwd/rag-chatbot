import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from scraper import get_youtube_data, get_instagram_data
from ingestor import ingest_video, clear_vectorstore
from rag_chain import stream_answer, history_to_langchain

app = FastAPI(title="RAG Creator Chatbot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_sessions = {}
video_metadata = {}

class IngestRequest(BaseModel):
    youtube_url: str
    instagram_url: str

class ChatRequest(BaseModel):
    session_id: str
    question: str

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/session")
async def new_session():
    sid = str(uuid.uuid4())
    chat_sessions[sid] = []
    return {"session_id": sid}

@app.post("/api/ingest")
async def ingest_videos(req: IngestRequest):
    try:
        clear_vectorstore()
        video_metadata.clear()
        print("Scraping YouTube...")
        yt_data = get_youtube_data(req.youtube_url)
        print(f"YouTube done: {yt_data['title'][:50]}")
        print("Scraping Instagram...")
        ig_data = get_instagram_data(req.instagram_url)
        print(f"Instagram done: {ig_data['title'][:50]}")
        print("Ingesting into ChromaDB...")
        yt_result = ingest_video(yt_data, "A")
        ig_result = ingest_video(ig_data, "B")
        print(f"Stored {yt_result['chunks_stored']} + {ig_result['chunks_stored']} chunks")
        video_metadata["A"] = {k: v for k, v in yt_data.items() if k != "transcript"}
        video_metadata["B"] = {k: v for k, v in ig_data.items() if k != "transcript"}
        return {
            "status": "success",
            "video_a": {**yt_result, "metadata": video_metadata["A"]},
            "video_b": {**ig_result, "metadata": video_metadata["B"]},
        }
    except Exception as e:
        print(f"Ingest error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/metadata")
async def get_metadata():
    if not video_metadata:
        raise HTTPException(status_code=404, detail="No videos ingested yet")
    return video_metadata

@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    if req.session_id not in chat_sessions:
        chat_sessions[req.session_id] = []
    raw_history = chat_sessions[req.session_id]
    lc_history = history_to_langchain(raw_history)

    async def generate():
        full_response = ""
        try:
            async for chunk in stream_answer(req.question, lc_history):
                yield chunk
                if '"type": "token"' in chunk:
                    import json
                    try:
                        data = json.loads(chunk[6:])
                        full_response += data.get("content", "")
                    except Exception:
                        pass
        finally:
            raw_history.append({"role": "user", "content": req.question})
            raw_history.append({"role": "assistant", "content": full_response or "[streamed]"})
            chat_sessions[req.session_id] = raw_history[-20:]

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.delete("/api/chat/{session_id}")
async def clear_session(session_id: str):
    chat_sessions.pop(session_id, None)
    return {"status": "cleared"}
