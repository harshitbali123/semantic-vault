import fitz  # PyMuPDF
from pathlib import Path
from unstructured.partition.auto import partition
from unstructured.cleaners.core import clean

SUPPORTED_TYPES = {'.pdf', '.docx', '.pptx', '.txt', '.md'}


def parse_document(file_path: str) -> dict:
    """
    Parse a document and return extracted text chunks + images.

    Returns:
    {
        "text_chunks": [{"text": str, "page_no": int}, ...],
        "images": [{"image_bytes": bytes, "page_no": int}, ...]
    }
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lower()

    if ext not in SUPPORTED_TYPES:
        raise ValueError(f"Unsupported file type: {ext}")

    text_chunks = []
    images = []

    # ── Extract text using Unstructured ──────────────
    try:
        elements = partition(filename=str(path))
        current_page = 1

        for el in elements:

            # Track page numbers safely
            if (
                hasattr(el, "metadata")
                and el.metadata
                and hasattr(el.metadata, "page_number")
                and el.metadata.page_number
            ):
                current_page = el.metadata.page_number

            raw_text = str(el).strip()

            if not raw_text:
                continue

            cleaned = clean(
                raw_text,
                extra_whitespace=True,
                dashes=True,
                bullets=True,
                trailing_punctuation=False,
            )

            # Skip tiny fragments
            if len(cleaned) > 30:
                text_chunks.append({
                    "text": cleaned,
                    "page_no": current_page
                })

    except Exception as e:
        print(f"[Parser] Unstructured error: {e}")
        print("[Parser] Falling back to PyMuPDF")

        # Fallback PDF extraction
        if ext == ".pdf":
            text_chunks = _extract_pdf_text(path)

    # ── Extract images from PDFs ────────────────────
    if ext == ".pdf":
        images = _extract_pdf_images(path)

    return {
        "text_chunks": text_chunks,
        "images": images
    }


def _extract_pdf_text(path: Path) -> list:
    """Fallback PDF text extraction using PyMuPDF."""

    chunks = []

    doc = fitz.open(str(path))

    for page_num, page in enumerate(doc, start=1):

        text = page.get_text().strip()

        if text and len(text) > 30:
            chunks.append({
                "text": text,
                "page_no": page_num
            })

    doc.close()

    return chunks


def _extract_pdf_images(path: Path) -> list:
    """Extract embedded images from a PDF."""

    images = []

    doc = fitz.open(str(path))

    for page_num, page in enumerate(doc, start=1):

        image_list = page.get_images(full=True)

        for img_index, img in enumerate(image_list):

            xref = img[0]

            base_image = doc.extract_image(xref)

            image_bytes = base_image["image"]

            # Skip tiny images/icons
            if len(image_bytes) > 5000:
                images.append({
                    "image_bytes": image_bytes,
                    "page_no": page_num,
                    "img_index": img_index
                })

    doc.close()

    return images