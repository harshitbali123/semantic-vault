from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from app.rag import stream_answer
import json
from celery.result import AsyncResult

from app.celery_app import celery
from app.qdrant_setup import setup_collections
from app.search import hybrid_search, image_search


# ── Startup lifecycle ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):

    print("[Startup] Setting up Qdrant collections...")
    setup_collections()

    # Warm embedding model
    from app.embedder import TEXT_MODEL
    TEXT_MODEL.encode(
        ["warmup"],
        show_progress_bar=False
    )

    print("[Startup] Ready.")
    yield


app = FastAPI(
    title="AI Knowledge Service",
    lifespan=lifespan
)


# ── Health check ─────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-service"
    }


# ── Dispatch ingestion task ──────────────────────
class DispatchRequest(BaseModel):
    document_id: str
    file_url: str
    file_name: str
    user_id: str


@app.post("/dispatch")
def dispatch_ingest(req: DispatchRequest):

    from app.tasks import ingest_document

    task = ingest_document.delay(
        req.document_id,
        req.file_url,
        req.file_name,
        req.user_id
    )

    return {
        "task_id": task.id,
        "document_id": req.document_id,
        "status": "queued"
    }


# ── Task status polling ──────────────────────────
@app.get("/status/{task_id}")
def get_task_status(task_id: str):

    result = AsyncResult(task_id, app=celery)

    response = {
        "task_id": task_id,
        "status": result.state
    }

    if result.state == "SUCCESS":
        response["result"] = result.result

    elif result.state == "FAILURE":
        response["error"] = str(result.result)

    return response


# ── Search endpoint ─────────────────────────────
class SearchRequest(BaseModel):
    query:   str
    user_id: str
    top_k:   int = 5


@app.post("/search")
def search(req: SearchRequest):
    """
    Called by Express. Returns ranked text chunks + image results.
    """
    if not req.query.strip():
        return {"results": [], "image_results": []}

    text_results = hybrid_search(req.query, req.user_id, req.top_k)
    image_results = image_search(req.query, req.user_id)

    return {
        "results":       text_results,
        "image_results": image_results,
        "query":         req.query,
        "total":         len(text_results)
    }


# ── Streaming RAG ask endpoint ──────────────────
class AskRequest(BaseModel):
    question:  str
    user_id:   str
    doc_names: dict = {}   # map of document_id → file_name, passed from Express


@app.post("/ask")
def ask(req: AskRequest):
    """
    Streaming RAG endpoint.
    Returns a text/event-stream SSE response.
    Express proxies this stream to the frontend.
    """
    if not req.question.strip():
        return {"error": "Question is required"}

    return StreamingResponse(
        stream_answer(req.question, req.user_id, req.doc_names),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no"   # disable nginx buffering if behind proxy
        }
    )