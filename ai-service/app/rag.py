from groq import Groq
from app.config import GROQ_API_KEY
from app.search import hybrid_search

groq_client = Groq(api_key=GROQ_API_KEY)

SYSTEM_PROMPT = """You are a helpful AI assistant that answers questions
based strictly on the provided document context.

Rules:
- Only use information from the provided context
- Cite sources using [1], [2], [3] notation inline in your answer
- If the context doesn't contain the answer, say so clearly
- Be concise and accurate
- Never make up information not present in the context"""


def build_context(chunks: list) -> str:
    """
    Format retrieved chunks into a numbered context block.
    The numbers correspond to citation markers [1], [2] etc in the answer.
    """
    lines = []
    for i, chunk in enumerate(chunks, start=1):
        lines.append(
            f"[{i}] Source: {chunk.get('file_name','Unknown')} "
            f"(page {chunk.get('page_no', '?')})\n"
            f"{chunk.get('chunk_text', '')}"
        )
    return "\n\n".join(lines)


def stream_answer(question: str, user_id: str, doc_names: dict):
    """
    Generator that yields SSE-formatted strings.
    Yields chunks of the answer as they stream from Groq.
    Yields citations as a final JSON event.

    Usage:
        for event in stream_answer(question, user_id, doc_names):
            yield event
    """
    # Retrieve relevant chunks
    chunks = hybrid_search(question, user_id, top_k=5)

    if not chunks:
        yield "data: {\"type\": \"error\", \"content\": \"No relevant documents found.\"}\n\n"
        return

    # Enrich chunks with file names from doc_names map
    for chunk in chunks:
        doc_id = chunk.get('document_id', '')
        chunk['file_name'] = doc_names.get(doc_id, 'Unknown Document')

    # Build context block
    context = build_context(chunks)

    user_message = f"""Context:
{context}

Question: {question}

Answer (cite sources inline using [1], [2] etc):"""

    # Stream from Groq
    try:
        stream = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system",  "content": SYSTEM_PROMPT},
                {"role": "user",    "content": user_message}
            ],
            stream=True,
            max_tokens=1024,
            temperature=0.1    # low temp = more factual, less creative
        )

        # Stream each token as an SSE event
        for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                # Escape newlines for SSE format
                safe = token.replace('\n', '\\n')
                yield f"data: {{\"type\": \"token\", \"content\": \"{safe}\"}}\n\n"

        # After streaming completes, send citation metadata
        citations = [{
            "id":          i + 1,
            "document_id": c.get("document_id", ""),
            "file_name":   c.get("file_name", "Unknown"),
            "page_no":     c.get("page_no", 0),
            "chunk_text":  c.get("chunk_text", "")[:300],  # truncate for payload size
            "score":       round(c.get("score", 0), 3)
        } for i, c in enumerate(chunks)]

        import json
        yield f"data: {{\"type\": \"citations\", \"citations\": {json.dumps(citations)}}}\n\n"
        yield "data: {\"type\": \"done\"}\n\n"

    except Exception as e:
        yield f"data: {{\"type\": \"error\", \"content\": \"{str(e)}\"}}\n\n"