#!/usr/bin/env python3
# ============================================================
# @file    scripts/ci/update-image-tags.py
# @domain  ci
# @layer   shared/helper
# @related .github/workflows/ci.yml (deploy job — update_tags step)
#
# Sprint 243 Q-6 (ADR-030): deploy job 의 inline `python3 -c` (kustomization.yaml
# 이미지 태그 갱신)을 헬퍼로 추출. 선례 = scripts/ci/compute-deploy-gate.sh —
# GHA context 의존(후보 수집/Trivy 게이트)은 ci.yml inline 유지, 순수 변환
# 로직만 스크립트로 분리한다 (단일 책임 + 단독 테스트 가능).
#
# 동작(기존 inline 과 동일):
#   kustomization.yaml 의 images[] 중 name 에 'algosu-<svc>' 를 포함하는 항목의
#   newTag 를 'main-<sha>' 로 갱신. PyYAML safe_load/dump (sort_keys 보존).
#
# 추출 시 개선점 (동작 불변):
#   - 매칭 0건인 서비스는 stderr 경고 (기존 inline 은 silent → 가시성 개선)
#
# 사용법:
#   update-image-tags.py --sha <git-sha> [--file kustomization.yaml] <svc> [svc ...]
#
# 인자:
#   --sha   (필수)  대상 이미지 태그에 쓸 git SHA (newTag = main-<sha>)
#   --file  (선택)  대상 kustomization 파일 (기본: kustomization.yaml, cwd 기준)
#   svc...  (가변)  갱신 대상 서비스명 (0개 가능 — no-op)
# ============================================================
"""Update kustomization.yaml image newTag values for the given services."""

import argparse
import sys

import yaml


def parse_args(argv=None):
    """CLI 인자 파싱 — --sha 필수, --file 기본값, 서비스명 가변 인자."""
    parser = argparse.ArgumentParser(
        description="Update kustomization.yaml image tags for changed services.",
    )
    parser.add_argument("--sha", required=True, help="git SHA (newTag = main-<sha>)")
    parser.add_argument(
        "--file",
        default="kustomization.yaml",
        help="kustomization file path (default: kustomization.yaml)",
    )
    parser.add_argument("services", nargs="*", help="service names to update")
    return parser.parse_args(argv)


def update_image_tags(file_path, sha, services):
    """images[] 중 algosu-<svc> 매칭 항목의 newTag 를 main-<sha> 로 갱신.

    매칭 0건인 서비스는 stderr 경고를 낸다(가시성 개선, 동작 불변).
    """
    with open(file_path, "r") as f:
        data = yaml.safe_load(f)

    images = data.get("images", []) if data else []
    for svc in services:
        matched = False
        for img in images:
            if f"algosu-{svc}" in img.get("name", ""):
                img["newTag"] = f"main-{sha}"
                matched = True
        if not matched:
            print(
                f"  ⚠ no image matched 'algosu-{svc}' in {file_path}",
                file=sys.stderr,
            )

    with open(file_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)


def main(argv=None):
    """엔트리포인트 — 인자 파싱 후 태그 갱신 수행."""
    args = parse_args(argv)
    update_image_tags(args.file, args.sha, args.services)
    return 0


if __name__ == "__main__":
    sys.exit(main())
