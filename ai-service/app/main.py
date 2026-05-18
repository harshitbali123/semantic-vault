from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel
from celery.result import AsyncResult

from app.celery_app import celery
from app.qdrant_setup import setup_collections


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
    file_path: str
    user_id: str


@app.post("/dispatch")
def dispatch_ingest(req: DispatchRequest):

    from app.tasks import ingest_document

    task = ingest_document.delay(
        req.file_path,
        req.document_id,
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