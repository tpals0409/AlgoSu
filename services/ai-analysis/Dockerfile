# AlgoSu AI Analysis Service — FastAPI (Oracle ARM Free Tier / aarch64)
FROM python:3.13-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

FROM python:3.13-slim AS runner
RUN addgroup --gid 1001 appgroup && adduser --uid 1001 --gid 1001 --disabled-password appuser
WORKDIR /app
COPY --from=builder /app/deps /usr/local/lib/python3.13/site-packages/
COPY src/ ./src/
USER appuser
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
