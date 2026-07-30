#!/bin/bash
echo "================================"
echo "  SR Money Tracker - Launcher"
echo "================================"
echo ""

# Start Backend
echo "[1/2] Starting Backend Server..."
cd "$(dirname "$0")/backend"
npm run dev &
BACKEND_PID=$!

sleep 3

# Start Frontend
echo "[2/2] Starting Frontend..."
cd "$(dirname "$0")/frontend"
npx serve . &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
