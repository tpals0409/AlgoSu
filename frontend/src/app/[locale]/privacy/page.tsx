/**
 * @file 개인정보처리방침 페이지
 * @domain legal
 * @layer page
 * @related LegalLayout, /terms
 */

import type { Metadata } from 'next';
import { LegalLayout } from '@/components/layout/LegalLayout';

export const metadata: Metadata = {
  title: '개인정보처리방침 | AlgoSu',
  description: 'AlgoSu 서비스의 개인정보처리방침입니다.',
};

/** 섹션 제목 스타일 */
function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-lg font-bold text-text first:mt-0">
      {children}
    </h2>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout>
      <article className="space-y-4 text-[14px] leading-relaxed text-text-2">
        <h1 className="mb-8 text-[26px] font-bold tracking-tight text-text">
          개인정보처리방침
        </h1>

        <p>
          AlgoSu(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요시하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가
          수집하는 개인정보의 항목, 수집 목적, 보유 기간 등을 안내합니다.
        </p>

        <p className="text-[12px] text-text-3">
          시행일: 2026년 4월 15일 | 최종 수정: 2026년 4월 15일
        </p>

        <SectionTitle>1. 수집하는 개인정보 항목</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>소셜 로그인 정보:</strong> 이메일, 이름, 프로필 이미지
            (Google, Naver, Kakao OAuth 제공 범위 내)
          </li>
          <li>
            <strong>GitHub 연동 정보:</strong> GitHub 사용자명, 연동 토큰
            (이용자가 직접 연동 시)
          </li>
          <li>
            <strong>서비스 이용 기록:</strong> 코드 제출 이력, AI 분석 결과,
            스터디 활동 내역
          </li>
          <li>
            <strong>자동 수집 정보:</strong> 접속 IP, 브라우저 정보, 쿠키,
            접속 일시
          </li>
        </ul>

        <SectionTitle>2. 개인정보의 수집·이용 목적</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>회원 식별 및 인증</li>
          <li>코드 제출, AI 분석, GitHub 동기화 등 핵심 서비스 제공</li>
          <li>스터디 그룹 관리 및 학습 통계 제공</li>
          <li>서비스 개선 및 오류 대응</li>
          <li>광고 게재 (Google AdSense)</li>
        </ul>

        <SectionTitle>3. 개인정보의 보유 및 이용 기간</SectionTitle>
        <p>
          이용자의 개인정보는 서비스 탈퇴 시 지체 없이 파기합니다. 단, 관련
          법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>서비스 이용 기록: 회원 탈퇴 후 즉시 삭제</li>
          <li>
            전자상거래법에 따른 표시·광고에 관한 기록: 6개월 (해당 시)
          </li>
        </ul>

        <SectionTitle>4. 개인정보의 제3자 제공</SectionTitle>
        <p>
          서비스는 원칙적으로 이용자의 동의 없이 개인정보를 제3자에게
          제공하지 않습니다. 다만 다음의 경우에는 예외로 합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Google AdSense:</strong> 광고 게재를 위해 쿠키 기반의 비식별
            정보가 Google에 전달될 수 있습니다.
          </li>
          <li>
            <strong>GitHub:</strong> 이용자가 GitHub 연동을 설정한 경우, 코드
            제출 데이터가 이용자의 GitHub 저장소에 동기화됩니다.
          </li>
          <li>법령에 의한 요청이 있는 경우</li>
        </ul>

        <SectionTitle>5. 쿠키(Cookie) 정책</SectionTitle>
        <p>
          서비스는 인증 세션 유지를 위해 필수 쿠키를 사용하며, Google AdSense
          광고 제공을 위해 제3자 쿠키가 사용될 수 있습니다. 이용자는
          브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 서비스
          이용에 제한이 있을 수 있습니다.
        </p>

        <SectionTitle>6. 이용자의 권리</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>개인정보 열람, 수정, 삭제 요청</li>
          <li>서비스 탈퇴를 통한 개인정보 일괄 삭제</li>
          <li>GitHub 연동 해제를 통한 연동 정보 삭제</li>
        </ul>
        <p>
          위 권리는 서비스 내 프로필 설정 페이지에서 직접 행사하거나, 아래
          연락처를 통해 요청할 수 있습니다.
        </p>

        <SectionTitle>7. 개인정보 보호책임자 및 연락처</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>담당: AlgoSu 운영팀</li>
          <li>이메일: privacy@algosu.kr</li>
        </ul>

        <SectionTitle>8. 방침 변경</SectionTitle>
        <p>
          본 개인정보처리방침은 법령 변경이나 서비스 정책 변경에 따라 수정될
          수 있으며, 변경 시 서비스 공지를 통해 안내합니다.
        </p>
      </article>
    </LegalLayout>
  );
}
