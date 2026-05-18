import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

from app.celery_app import celery
from app.config import QDRANT_URL

from app.parser import parse_document
from app.embedder import (
    chunk_text,
    embed_texts,
    embed_image
)


@celery.task(name="process_document")
def process_document(
    file_path: str,
    document_id: str,
    user_id: str
):

    print(f"[Task] Starting processing: {file_path}")

    # ── Parse document ───────────────────────────

    parsed = parse_document(file_path)

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

    texts = [
        chunk["text"]
        for chunk in chunks
    ]

    text_vectors = embed_texts(texts)

    print(
        f"[Task] Generated "
        f"{len(text_vectors)} text embeddings"
    )

    # ── Connect to Qdrant ────────────────────────

    client = QdrantClient(
        url=QDRANT_URL
    )

    # ── Upsert text chunks ───────────────────────

    text_points = []

    for chunk, vector in zip(chunks, text_vectors):

        point = PointStruct(
            id=str(uuid.uuid4()),
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

    if text_points:

        client.upsert(
            collection_name="text_chunks",
            points=text_points
        )

    print(
        f"[Task] Upserted "
        f"{len(text_points)} text vectors"
    )

    # ── Process images ───────────────────────────

    image_points = []

    for img in parsed["images"]:

        vector = embed_image(
            img["image_bytes"]
        )

        point = PointStruct(
            id=str(uuid.uuid4()),
            vector=vector.tolist(),
            payload={
                "document_id": document_id,
                "page_no": img["page_no"],
                "img_index": img["img_index"]
            }
        )

        image_points.append(point)

    if image_points:

        client.upsert(
            collection_name="images",
            points=image_points
        )

    print(
        f"[Task] Upserted "
        f"{len(image_points)} image vectors"
    )

    print("[Task] SUCCESS")

    return {
        "status": "success",
        "document_id": document_id,
        "chunks": len(text_points),
        "images": len(image_points)
    }


# Backward-compatible alias for older callers/imports.
ingest_document = process_document