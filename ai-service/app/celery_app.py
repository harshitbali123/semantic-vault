from celery import Celery
from app.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

celery = Celery(
    "semantic_vault",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,

    include=["app.tasks"]  # Ensure tasks are registered
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
