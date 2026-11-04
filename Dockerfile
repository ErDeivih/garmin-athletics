FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt pydantic-settings aiosqlite asyncpg

COPY . .

ENV PYTHONPATH=/app/backend

CMD ["python", "backend/main.py"]
