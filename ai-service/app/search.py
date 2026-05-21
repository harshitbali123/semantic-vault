import numpy as np
from math import exp
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from app.config import QDRANT_URL
from app.embedder import embed_texts, embed_text_for_image_search

# ── Load reranker model once at module level ──────
print("[Search] Loading reranker model...")
RERANKER = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
print("[Search] Reranker ready.")

qdrant = QdrantClient(url=QDRANT_URL)

MIN_TEXT_RELEVANCE = 0.55
MIN_IMAGE_RELEVANCE = 0.45


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + exp(-float(value)))


def _clamp_relevance(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _chunk_text(payload: dict) -> str:
    return payload.get("text") or payload.get("chunk_text", "")


def hybrid_search(query: str, user_id: str, top_k: int = 5) -> list:
    """
    Full hybrid search pipeline:
    1. Dense vector search via Qdrant
    2. BM25 sparse search on stored chunk texts
    3. RRF score fusion
    4. Cross-encoder reranking
    Returns top_k results with metadata.
    """

    # ── Stage 1: Dense search ─────────────────────
    query_embedding = embed_texts([query])[0]

    dense_results = qdrant.query_points(
        collection_name="text_chunks",
        query=query_embedding.tolist(),
        query_filter=Filter(
            must=[FieldCondition(
                key="user_id",
                match=MatchValue(value=user_id)
            )]
        ),
        limit=20,        # fetch 20, rerank to 5
        with_payload=True
    ).points

    if not dense_results:
        return []

    # ── Stage 2: BM25 sparse search ───────────────
    # Build BM25 corpus from the dense results
    # (searching only over retrieved chunks keeps it fast)
    corpus_texts = [_chunk_text(r.payload) for r in dense_results]
    tokenized    = [text.lower().split() for text in corpus_texts]

    if not tokenized or not any(tokenized):
        return [{
            "id":          str(result.id),
            "chunk_text":  _chunk_text(result.payload),
            "page_no":     result.payload.get("page_no", 0),
            "chunk_index": result.payload.get("chunk_index", 0),
            "document_id": result.payload.get("document_id", ""),
            "score":       float(result.score or 0.0),
        } for result in dense_results[:top_k]]

    bm25         = BM25Okapi(tokenized)
    bm25_scores  = bm25.get_scores(query.lower().split())

    # ── Stage 3: RRF (Reciprocal Rank Fusion) ─────
    # Combine dense and sparse ranks without needing to normalize scores
    K = 60   # RRF constant — higher = less weight on top ranks
    fused = {}

    for rank, result in enumerate(dense_results):
        pid = result.id
        fused[pid] = fused.get(pid, 0) + 1.0 / (K + rank + 1)

    bm25_ranked = np.argsort(bm25_scores)[::-1]
    for rank, idx in enumerate(bm25_ranked):
        pid = dense_results[idx].id
        fused[pid] = fused.get(pid, 0) + 1.0 / (K + rank + 1)

    # Sort by fused score, take top 10 for reranking
    sorted_ids  = sorted(fused.keys(), key=lambda x: fused[x], reverse=True)
    top_10_ids  = sorted_ids[:10]
    top_10      = [r for pid in top_10_ids for r in dense_results if r.id == pid]

    # ── Stage 4: Cross-encoder reranking ──────────
    pairs   = [(query, _chunk_text(r.payload)) for r in top_10]
    scores  = RERANKER.predict(pairs)
    ranked  = sorted(zip(top_10, scores), key=lambda x: x[1], reverse=True)

    # ── Format results ─────────────────────────────
    results = []
    for result, score in ranked[:top_k]:
        relevance = _sigmoid(score)
        if relevance < MIN_TEXT_RELEVANCE:
            continue

        results.append({
            "id":          str(result.id),
            "chunk_text":  _chunk_text(result.payload),
            "page_no":     result.payload.get("page_no", 0),
            "chunk_index": result.payload.get("chunk_index", 0),
            "document_id": result.payload.get("document_id", ""),
            "score":       round(_clamp_relevance(relevance), 3),
        })

    return results


def image_search(query: str, user_id: str, top_k: int = 6) -> list:
    """
    Search images using CLIP text embedding.
    Returns image metadata from Qdrant images collection.
    """
    query_embedding = embed_text_for_image_search(query)

    results = qdrant.query_points(
        collection_name="images",
        query=query_embedding.tolist(),
        query_filter=Filter(
            must=[FieldCondition(
                key="user_id",
                match=MatchValue(value=user_id)
            )]
        ),
        limit=top_k,
        with_payload=True
    ).points

    return [{
        "id":          str(r.id),
        "document_id": r.payload.get("document_id", ""),
        "page_no":     r.payload.get("page_no", 0),
        "score":       round(_clamp_relevance((float(r.score) + 1.0) / 2.0), 3),
    } for r in results if _clamp_relevance((float(r.score) + 1.0) / 2.0) >= MIN_IMAGE_RELEVANCE]