# CreatorRAG

Hey! This is a chatbot built to help content creators compare two videos (a YouTube video and an Instagram Reel) side-by-side. You paste the URLs, it scrapes the metadata and transcribes the audio, stores it locally, and then lets you chat with your video data to find out why one performed better, compare hooks, or brainstorm improvements.

Under the hood, it uses FastAPI for the backend, React with Vite for the frontend, ChromaDB for storing the vector chunks, local HuggingFace embeddings, and Groq (Llama 3.3) to power the chat.

---

## What you need before starting

* Python 3.10 or higher
* Node.js 18 or higher
* ffmpeg installed on your computer (faster-whisper needs this to transcribe the audio from Instagram Reels)
* A free Groq API key (grab one from console.groq.com)

---

## Getting it up and running

### 1. Configure the API Key

Make a copy of backend/.env.example and rename it to backend/.env:

```
GROQ_API_KEY=your_groq_api_key_here
```

Don't worry, backend/.env is already in the .gitignore file so your API key will never be pushed to GitHub.

### 2. Run the Backend

Open your terminal, go into the backend folder, set up a python virtual environment, install the dependencies, and start the server:

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will start running at http://localhost:8000. You can verify it is up by going to http://localhost:8000/api/health in your browser.

### 3. Run the Frontend

Open a new terminal window, go into the frontend folder, install the packages, and start the development server:

```bash
cd frontend
npm install
npm run dev
```

The frontend will start running at http://localhost:5173. Open that up in your browser and you are good to go!

---

## How it works

1. **Scraping**: When you paste the URLs and hit analyze, the backend uses yt-dlp. For YouTube, it attempts to fetch the official transcript first. For Instagram Reels (or YouTube videos without transcripts), it downloads the audio and runs it through faster-whisper locally to generate the text.
2. **Chunking & Vector Store**: The transcript text is split into chunks of 300 tokens with an overlap of 50 tokens. This size is selected because creators usually speak in short, punchy ideas (like a hook, a core tip, or a call-to-action). 300 tokens is perfect to capture one complete idea without diluting the context.
3. **Embeddings & ChromaDB**: The chunks are turned into vectors using a local HuggingFace embedding model (all-MiniLM-L6-v2) so you don't need any paid embedding API. ChromaDB stores them locally in the backend/chroma_db folder.
4. **Chatting**: When you ask a question, the backend retrieves the most relevant chunks from both videos and feeds them to Llama 3.3 on Groq along with the video metrics. It then streams the answer back to the frontend with specific citations (like [Video A — chunk 2]) showing exactly where the answer came from.
