# Semantic Vault

Semantic Vault is a full-stack, AI-powered personal knowledge platform where users can:
- upload documents,
- connect Google Drive and sync files,
- run semantic + keyword search,
- and ask questions with streaming, citation-backed answers.

## What this project does

This project builds a complete Retrieval-Augmented Generation (RAG) workflow:
1. Ingest files from upload or Google Drive
2. Parse text and images from files
3. Generate embeddings for text and images
4. Store vectors in Qdrant and metadata in Supabase
5. Retrieve relevant chunks with hybrid search
6. Generate grounded answers with citations using Groq LLM

## Tech stack used

### Frontend
- React 19 + Vite
- React Router
- Tailwind CSS
- Supabase JS SDK
- Axios

### Backend API
- Node.js + Express
- Supabase Admin + Auth APIs
- Multer (file upload)
- Redis (search cache)
- Google APIs (OAuth + Drive sync)

### AI / ML Service
- FastAPI
- Celery workers
- Qdrant vector database
- SentenceTransformers (`BAAI/bge-base-en-v1.5`) for text embeddings
- CLIP (`openai/clip-vit-base-patch32`) for image embeddings/search
- BM25 + Cross-Encoder reranking (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
- Groq (`llama-3.3-70b-versatile`) for answer generation
- Unstructured + PyMuPDF for parsing documents

### Data layer
- Supabase Postgres (documents, chunks, jobs, connectors)
- Supabase Storage (raw uploaded/synced files)
- Supabase Auth (user authentication + JWT)

### Infrastructure
- Docker Compose
- Redis
- Qdrant
- Separate frontend/backend/ai-service/celery containers

## Implemented features

- **Authentication**
  - Sign up / sign in with Supabase Auth
  - JWT-protected backend routes
  - SSE auth support for streaming chat endpoint

- **Document ingestion**
  - Upload supported: `.pdf`, `.docx`, `.pptx`, `.txt`, `.md` (up to 50MB)
  - Async ingestion pipeline via Celery
  - Document/job status tracking

- **Google Drive connector**
  - OAuth connect flow
  - Delta sync using stored page token
  - Syncs supported document/image types from Drive
  - Re-ingests only changed files

- **Semantic search**
  - Dense vector search in Qdrant
  - BM25 sparse matching
  - Reciprocal Rank Fusion (RRF)
  - Cross-encoder reranking
  - Redis query-result caching

- **Multimodal support**
  - Text chunk embeddings
  - Image embeddings and image result retrieval

- **Ask AI (RAG chat)**
  - Streaming SSE responses
  - Source citations with file and page references
  - Grounded prompt to reduce hallucination

- **Dashboard & UX**
  - Live dashboard updates
  - Document/source/status views
  - Connector management and sync triggers

## High-level architecture

1. **Frontend (React)** sends API requests to Express backend.
2. **Backend (Express)** handles auth, uploads, connectors, and orchestration.
3. **AI Service (FastAPI)** exposes `/dispatch`, `/search`, `/ask`, `/status`.
4. **Celery Worker** performs background parsing + embedding + vector upserts.
5. **Qdrant** stores vectors for retrieval.
6. **Supabase** stores users, metadata, jobs, connectors, and files.
7. **Redis** powers cache and Celery broker/result backend.

## Repository structure

```
.
├── frontend/        # React + Vite UI
├── backend/         # Node.js/Express API
├── ai-service/      # FastAPI + Celery + embedding/search pipeline
├── supabase/        # migrations and local config
└── docker-compose.yml
```

## Environment variables

Create `.env` in repo root (based on `.env.example`) and configure:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_SERVICE_URL`
- `QDRANT_URL`
- `REDIS_URL`
- `REDIS_BROKER_DB`
- `REDIS_RESULT_DB`
- `REDIS_CACHE_DB`
- `GROQ_API_KEY`
- `PORT`

For Google Drive connector:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

## Run locally

### Option 1: Docker (recommended)
```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- AI Service: `http://localhost:8000`
- Qdrant: `http://localhost:6333`
- Redis: `localhost:6379`

### Option 2: Run services manually

Frontend:
```bash
cd frontend
npm install
npm run dev
```

Backend:
```bash
cd backend
npm install
npm run dev
```

AI service:
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
celery -A app.celery_app worker --loglevel=info --concurrency=2
```

## Main API routes

- `GET /health`
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/documents/upload`
- `GET /api/documents/jobs/:taskId`
- `POST /api/search`
- `GET /api/ask?question=...` (SSE stream)
- `GET /api/connectors`
- `GET /api/connectors/google/auth-url`
- `POST /api/connectors/google/sync`
- `DELETE /api/connectors/:type`

## Database model (Supabase)

Main tables:
- `documents`
- `chunks`
- `jobs`
- `connectors`

Includes:
- status tracking for documents/jobs
- connector sync metadata (`page_token`, `last_synced_at`, `total_files_synced`)
- row-level security policies per user

## End-to-end flow

1. User uploads/syncs a file.
2. Backend stores file and creates document/job records.
3. Backend dispatches background task to AI service.
4. Worker downloads file, parses content, chunks text, generates embeddings.
5. Vectors are stored in Qdrant; chunk metadata is stored in Supabase.
6. User searches or asks questions.
7. Retrieval pipeline returns relevant chunks/images.
8. Chat response streams with citations.
