import asyncio
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from supabase import create_client

from app.celery_app import celery
from app.config import QDRANT_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

from app.parser import parse_document
from app.embedder import (
    chunk_text,
    embed_texts,
    embed_image
)


_supabase_admin = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_supabase_admin():
    global _supabase_admin

    if _supabase_admin is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("Missing Supabase credentials for AI service")

        _supabase_admin = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY
        )

    return _supabase_admin


def _update_document_status(document_id: str, status: str):
    get_supabase_admin().table("documents").update({
        "status": status,
        "updated_at": _utc_now_iso()
    }).eq("id", document_id).execute()


def _get_job_row(document_id: str):
    response = get_supabase_admin().table("jobs").select("id").eq(
        "document_id", document_id
    ).order("created_at", desc=True).limit(1).execute()

    data = response.data or []
    return data[0]["id"] if data else None


def _update_job_status(
    document_id: str,
    status: str,
    *,
    task_id: str | None = None,
    error_message: str | None = None
):
    now = _utc_now_iso()
    update = {
        "status": status
    }

    if task_id is not None:
        update["celery_task_id"] = task_id

    if status == "started":
        update["started_at"] = now

    if status in ("success", "failure"):
        update["finished_at"] = now

    if error_message is not None:
        update["error_message"] = error_message

    supabase = get_supabase_admin()
    job_id = _get_job_row(document_id)

    if job_id is None:
        supabase.table("jobs").insert({
            "document_id": document_id,
            **update
        }).execute()
        return

    supabase.table("jobs").update(update).eq("id", job_id).execute()


async def download_temp_file(file_url: str, suffix: str):

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.get(file_url)

    response.raise_for_status()

    temp = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    )

    temp.write(response.content)
    temp.close()

    return Path(temp.name)


@celery.task(name="process_document", bind=True)
def process_document(
    self,
    document_id: str,
    file_url: str,
    file_name: str,
    user_id: str
):

    temp_path = None
    task_id = self.request.id

    print(f"[Task] Starting processing: {file_url}")
    _update_document_status(document_id, "processing")
    _update_job_status(
        document_id,
        "started",
        task_id=task_id
    )

    suffix = Path(file_name).suffix
    if not suffix:
        suffix = Path(unquote(urlparse(file_url).path)).suffix

    if not suffix:
        suffix = ".bin"

    try:
        temp_path = asyncio.run(download_temp_file(file_url, suffix))

        print(f"[Task] Downloaded to temp file: {temp_path}")
        print("[Task] processing document", flush=True)

        # ── Parse document ───────────────────────────

        parsed = parse_document(temp_path)

        print(
            f"[Task] Parsed "
            f"{len(parsed['text_chunks'])} text chunks "
            f"and {len(parsed['images'])} images"
        )

        # ── Chunk text ───────────────────────────────

        chunks = chunk_text(
            parsed["text_chunks"]
        )

        print(
            f"[Task] Generated "
            f"{len(chunks)} final chunks"
        )

        # ── Generate embeddings ──────────────────────

        texts = [chunk["text"] for chunk in chunks]
        text_vectors = embed_texts(texts) if texts else []

        print(
            f"[Task] Generated "
            f"{len(text_vectors)} text embeddings"
        )
        print("[Task] embedding chunks", flush=True)

        # ── Connect to Qdrant ────────────────────────

        client = QdrantClient(
            url=QDRANT_URL
        )

        # ── Upsert text chunks ───────────────────────

        text_points = []
        chunk_rows = []

        supabase = get_supabase_admin()

        supabase.table("chunks").delete().eq(
            "document_id", document_id
        ).execute()

        for chunk, vector in zip(chunks, text_vectors):
            point_id = str(uuid.uuid4())

            point = PointStruct(
                id=point_id,
                vector=vector.tolist(),
                payload={
                    "document_id": document_id,
                    "user_id": user_id,
                    "text": chunk["text"],
                    "page_no": chunk["page_no"],
                    "chunk_index": chunk["chunk_index"]
                }
            )

            text_points.append(point)
            chunk_rows.append({
                "document_id": document_id,
                "chunk_text": chunk["text"],
                "page_no": chunk["page_no"],
                "chunk_index": chunk["chunk_index"],
                "qdrant_point_id": point_id
            })

        if text_points:

            client.upsert(
                collection_name="text_chunks",
                points=text_points
            )

        if chunk_rows:
            supabase.table("chunks").insert(chunk_rows).execute()

        print(
            f"[Task] Upserted "
            f"{len(text_points)} text vectors"
        )

        # ── Process images ───────────────────────────

        image_points = []
        image_chunk_rows = []

        for img in parsed["images"]:

            vector = embed_image(
                img["image_bytes"]
            )

            point_id = str(uuid.uuid4())

            point = PointStruct(
                id=point_id,
                vector=vector.tolist(),
                payload={
                    "document_id": document_id,
                    "page_no": img["page_no"],
                    "img_index": img["img_index"]
                }
            )

            image_points.append(point)

            # Prepare a chunk row for this image so it appears in the chunks table
            image_chunk_rows.append({
                "document_id": document_id,
                "chunk_text": None,
                "page_no": img["page_no"],
                "chunk_index": img.get("img_index", 0),
                "qdrant_point_id": point_id
            })

        if image_points:

            client.upsert(
                collection_name="images",
                points=image_points
            )

        if image_chunk_rows:
            # Insert image chunk metadata into Supabase so UI and queries see image chunks
            supabase.table("chunks").insert(image_chunk_rows).execute()

        print(
            f"[Task] Upserted "
            f"{len(image_points)} image vectors"
        )

        print("[Task] SUCCESS")

        _update_document_status(document_id, "done")
        _update_job_status(
            document_id,
            "success",
            task_id=task_id
        )

        return {
            "status": "success",
            "document_id": document_id,
            "chunks": len(text_points),
            "images": len(image_points)
        }

    except Exception as exc:
        _update_document_status(document_id, "error")
        _update_job_status(
            document_id,
            "failure",
            task_id=task_id,
            error_message=str(exc)
        )

        if self.request.retries >= self.max_retries:
            raise exc

        raise self.retry(exc=exc)

    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
            print(f"[Task] temp file deleted: {temp_path}", flush=True)


# Backward-compatible alias for older callers/imports.
ingest_document = process_document