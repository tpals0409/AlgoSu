# AlgoSu AI Analysis Service — FastAPI (Oracle ARM Free Tier / aarch64)
FROM python:3.13-slim AS builder
# base image OS 보안 패치 (Sprint 159 — CVE-2026-4878 libcap2 / CVE-2026-29111 libsystemd0/libudev1)
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

FROM python:3.13-slim AS runner
# base image OS 보안 패치 (Sprint 159 — CVE-2026-4878 libcap2 / CVE-2026-29111 libsystemd0/libudev1)
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --gid 1001 appgroup && adduser --uid 1001 --gid 1001 --disabled-password appuser
WORKDIR /app
COPY --from=builder /app/deps /usr/local/lib/python3.13/site-packages/
# Sprint 267: 전이/베이스이미지 의존성 취약점 in-place 상향 (HIGH)
# - msgpack GHSA-6v7p-g79w-8964 (1.1.2 → 1.2.1): Unpacker reuse OOB read
# - setuptools CVE-2025-47273 (70.3.0 → 78.1.1): PackageIndex path traversal
# COPY overlay 로는 old dist-info 가 잔존해 Trivy 재탐지 → pip --upgrade 로 제거
RUN pip install --no-cache-dir --upgrade "setuptools>=78.1.1" "msgpack>=1.2.1"
COPY src/ ./src/
USER appuser
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
