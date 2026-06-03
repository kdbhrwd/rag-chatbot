#!/bin/bash
# Run both backend and frontend in parallel

# Check .env exists
if [ ! -f backend/.env ]; then
  echo "❌  backend/.env not found. Copy backend/.env.example and add your OPENAI_API_KEY."
  exit 1
fi

echo "🚀  Starting CreatorRAG..."
echo ""

# Backend
(cd backend && source venv/bin/activate 2>/dev/null || true && uvicorn main:app --reload --port 8000) &
BACKEND_PID=$!

sleep 2

# Frontend
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅  Backend  → http://localhost:8000"
echo "✅  Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both"

wait $BACKEND_PID $FRONTEND_PID
