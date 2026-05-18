from qdrant_client import QdrantClient
from qdrant_client.models import (
    VectorParams, Distance,
    PayloadSchemaType
)
from app.config import QDRANT_URL

def setup_collections():
    client = QdrantClient(url=QDRANT_URL)

    # ── Text chunks collection (bge-base = 768 dims) ──
    existing = [c.name for c in client.get_collections().collections]

    if "text_chunks" not in existing:
        client.create_collection(
            collection_name="text_chunks",
            vectors_config=VectorParams(
                size=768,                 # bge-base-en-v1.5 output dim
                distance=Distance.COSINE
            )
        )
        # Create payload indexes for fast filtering
        client.create_payload_index(
            collection_name="text_chunks",
            field_name="document_id",
            field_schema=PayloadSchemaType.KEYWORD
        )
        client.create_payload_index(
            collection_name="text_chunks",
            field_name="user_id",
            field_schema=PayloadSchemaType.KEYWORD
        )
        print("[Qdrant] Created collection: text_chunks (768-dim)")
    else:
        print("[Qdrant] Collection text_chunks already exists — skipping")

    # ── Images collection (CLIP = 512 dims) ──────────
    if "images" not in existing:
        client.create_collection(
            collection_name="images",
            vectors_config=VectorParams(
                size=512,                 # CLIP output dim
                distance=Distance.COSINE
            )
        )
        client.create_payload_index(
            collection_name="images",
            field_name="document_id",
            field_schema=PayloadSchemaType.KEYWORD
        )
        print("[Qdrant] Created collection: images (512-dim)")
    else:
        print("[Qdrant] Collection images already exists — skipping")

    print("[Qdrant] Setup complete.")
    return client


if __name__ == "__main__":
    setup_collections()