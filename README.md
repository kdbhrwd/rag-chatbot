# CreatorRAG — Video Analytics Intelligence

RAG-powered chatbot that lets you compare two social media videos (YouTube + Instagram Reel) — ask why one performed better, compare hooks, get improvement suggestions grounded in actual transcript data.

**Stack**: FastAPI · LangChain · LangGraph · ChromaDB · GPT-4o-mini · React/Vite

---

## Quick start (5 minutes)

### Prerequisites
- Python 3.10+
- Node.js 18+
- `yt-dlp` installed: `pip install yt-dlp` or `brew install yt-dlp`
- ffmpeg (needed by Whisper): `brew install ffmpeg` / `sudo apt install ffmpeg`
- OpenAI API key

---

### 1. Clone and configure

```bash
git clone <your-repo>
cd rag-creator-chatbot
```

Copy `.env.example` to `.env` and add your OpenAI key:

```bash
cp backend/.env.example backend/.env
# edit backend/.env → paste your OPENAI_API_KEY
```

---

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
# Note: torch + whisper are large (~2GB). If you want faster install and
# don't need Instagram transcription, remove openai-whisper and torch from
# requirements.txt and the fallback message will still work.

uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Test: open `http://localhost:8000/api/health`

---

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

---

### 4. Use it

1. Paste a YouTube URL (Video A) and an Instagram Reel URL (Video B)
2. Hit **Analyze Videos** — takes 30–90s (Whisper transcription is the slow part)
3. Chat with the RAG system — it cites exact chunks and shows engagement metrics

---

## Architecture decisions (defend on the call)

### Why ChromaDB?
Zero-config, runs in-process, persists to disk. Perfect for a demo. At 1000 creators/day, swap to Qdrant Cloud — it supports metadata filtering natively, has horizontal scaling, and a free tier. Migration is one import swap in `ingestor.py`.

### Why chunk_size=300, overlap=50?
Social media creators speak in tight idea units — hook, point, CTA. 300 tokens ≈ 60–90 words = one idea. Overlap of 50 tokens ensures phrases that span chunk boundaries aren't lost. Larger chunks (1000+) dilute retrieval precision; smaller chunks (<100) lose surrounding context the LLM needs for comparisons.

### Why GPT-4o-mini?
15× cheaper than GPT-4o. In a RAG setup, the context is pre-supplied — the model doesn't need to reason from scratch, it needs to summarize and synthesize. GPT-4o-mini handles this well. At 1000 creators/day with ~5 queries each: ~5000 requests × ~2000 tokens = 10M tokens/day = ~$1.50.

### Why text-embedding-3-small?
$0.02/M tokens vs $0.13 for ada-002 (6.5× cheaper). Comparable performance on retrieval benchmarks. A 10-min transcript ≈ 2000 tokens = 6 chunks = ~14,000 embedding tokens = $0.0003 per video pair.

### What breaks at 10k users?
- Whisper transcription (~30s/video) becomes the bottleneck → move to async Celery/Redis job queue
- In-memory session store → move to Redis
- Single-machine ChromaDB → Qdrant Cloud with proper indexing
- Single FastAPI process → Gunicorn workers behind nginx

### Cost at 1000 creators/day
| Component | Cost |
|---|---|
| Embeddings (text-embedding-3-small) | ~$0.30/day |
| LLM chat (GPT-4o-mini, 5 queries each) | ~$1.50/day |
| Whisper (open-source, runs locally) | $0 |
| ChromaDB (local) | $0 |
| **Total** | **~$1.80/day** |

---

## Project structure

```
rag-creator-chatbot/
├── backend/
│   ├── main.py          # FastAPI app — routes, session store
│   ├── scraper.py       # YouTube (transcript API + yt-dlp) + Instagram (yt-dlp + Whisper)
│   ├── ingestor.py      # Chunking (RecursiveTextSplitter) + embeddings + ChromaDB
│   ├── rag_chain.py     # LangGraph state machine + streaming SSE + citations
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main layout + ingest flow
│   │   └── components/
│   │       ├── VideoCard.jsx  # Metadata display + engagement bar
│   │       └── ChatPanel.jsx  # SSE streaming chat with citation badges
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## Notes

- Instagram scraping works on **public** Reels only
- If `youtube-transcript-api` fails (no captions), the system still works — metadata is stored and the LLM can answer metric questions
- Whisper `base` model is used by default. Switch to `small` in `scraper.py` for better accuracy (~2× slower)
