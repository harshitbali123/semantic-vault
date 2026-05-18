import numpy as np
from sentence_transformers import SentenceTransformer
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import io
import torch

# ── Load models ONCE at module level ─────────────
# These load when the worker starts, not per-task
# bge-base: 768-dim text embeddings (~440MB)
print("[Embedder] Loading text embedding model...")
TEXT_MODEL = SentenceTransformer('BAAI/bge-base-en-v1.5')

# CLIP: 512-dim image+text embeddings (~600MB)
print("[Embedder] Loading CLIP model...")
CLIP_MODEL     = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
CLIP_PROCESSOR = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

print("[Embedder] All models loaded.")

# ── Text chunking ─────────────────────────────────
CHUNK_SIZE    = 400   # tokens approx
CHUNK_OVERLAP = 50

def chunk_text(text_chunks: list) -> list:
    """
    Split parsed text chunks into smaller overlapping chunks.
    Input:  [{"text": str, "page_no": int}, ...]
    Output: [{"text": str, "page_no": int, "chunk_index": int}, ...]
    """
    result = []
    chunk_index = 0

    for item in text_chunks:
        text    = item["text"]
        page_no = item["page_no"]
        words   = text.split()

        # Slide a window over words
        start = 0
        while start < len(words):
            end        = min(start + CHUNK_SIZE, len(words))
            chunk_text = " ".join(words[start:end])

            if len(chunk_text.strip()) > 20:   # skip near-empty chunks
                result.append({
                    "text":        chunk_text,
                    "page_no":     page_no,
                    "chunk_index": chunk_index
                })
                chunk_index += 1

            # Move forward with overlap
            start += CHUNK_SIZE - CHUNK_OVERLAP
            if start >= len(words):
                break

    return result  #returns chunks of text with page number and chunk index for reference 


# ── Text embedding ────────────────────────────────
def embed_texts(texts: list) -> np.ndarray:
    """
    Embed a list of strings.
    Returns numpy array of shape (len(texts), 768)
    """
    # BGE models work best with this instruction prefix
    prefixed = [f"Represent this sentence for searching: {t}" for t in texts]
    embeddings = TEXT_MODEL.encode(
        prefixed,
        normalize_embeddings=True,   # cosine similarity works best normalized
        batch_size=32,
        show_progress_bar=False
    )
    return embeddings


# ── Image embedding (CLIP) ────────────────────────
def embed_image(image_bytes: bytes) -> np.ndarray:
    """
    Embed a single image using CLIP.
    Returns numpy array of shape (512,)
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = CLIP_PROCESSOR(images=image, return_tensors="pt")
    with torch.no_grad():
        features = CLIP_MODEL.get_image_features(**inputs)
    # Normalize for cosine similarity
    embedding = features[0].numpy()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding


# ── Text→Image embedding (for search queries) ────
def embed_text_for_image_search(text: str) -> np.ndarray:
    """
    Embed a text query into CLIP's shared text-image space.
    Use this when searching images with a text query.
    Returns numpy array of shape (512,)
    """
    inputs = CLIP_PROCESSOR(text=[text], return_tensors="pt", padding=True)
    with torch.no_grad():
        features = CLIP_MODEL.get_text_features(**inputs)
    embedding = features[0].numpy()
    embedding = embedding / np.linalg.norm(embedding)
    return embedding