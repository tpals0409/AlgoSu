/**
 * @file 이용약관 페이지
 * @domain legal
 * @layer page
 * @related LegalLayout, /privacy
 */

import type { Metadata } from 'next';
import { LegalLayout } from '@/components/layout/LegalLayout';

export const metadata: Metadata = {
  title: '이용약관 | AlgoSu',
  description: 'AlgoSu 서비스의 이용약관입니다.',
};

/** 섹션 제목 스타일 */
function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-10 text-lg font-bold text-text first:mt-0">
      {children}
    </h2>
  );
}

export default function TermsPage() {
  return (
    <LegalLayout>
      <article className="space-y-4 text-[14px] leading-relaxed text-text-2">
        <h1 className="mb-8 text-[26px] font-bold tracking-tight text-text">
          이용약관
        </h1>

        <p>
          본 약관은 AlgoSu(이하 &quot;서비스&quot;)의 이용 조건 및 절차,
          이용자와 서비스 간의 권리·의무를 규정합니다.
        </p>

        <p className="text-[12px] text-text-3">
          시행일: 2026년 4월 15일 | 최종 수정: 2026년 4월 15일
        </p>

        <SectionTitle>제1조 (서비스 개요)</SectionTitle>
        <p>
          AlgoSu는 알고리즘 스터디 플랫폼으로, 코드 제출·AI 분석·GitHub
          자동 동기화·피어 리뷰 등의 기능을 제공합니다.
        </p>

        <SectionTitle>제2조 (이용 자격)</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스는 소셜 로그인(Google, Naver, Kakao)을 통해 가입한
            이용자에게 제공됩니다.
          </li>
          <li>
            만 14세 미만의 아동은 법정대리인의 동의 없이 서비스를 이용할 수
            없습니다.
          </li>
        </ul>

        <SectionTitle>제3조 (이용자의 의무 및 금지 행위)</SectionTitle>
        <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>타인의 코드를 도용하거나 허위로 제출하는 행위</li>
          <li>서비스의 정상적인 운영을 방해하는 행위</li>
          <li>다른 이용자의 개인정보를 무단으로 수집·이용하는 행위</li>
          <li>서비스를 상업적으로 무단 이용하거나 재판매하는 행위</li>
          <li>
            자동화 도구를 이용하여 비정상적으로 대량의 요청을 발생시키는
            행위
          </li>
        </ul>

        <SectionTitle>제4조 (지적재산권)</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스의 UI, 디자인, 로고, 소프트웨어 등 일체의 지적재산권은
            AlgoSu에 귀속됩니다.
          </li>
          <li>
            이용자가 제출한 코드의 저작권은 해당 이용자에게 귀속됩니다.
            다만, AI 분석 및 학습 통계 목적으로 서비스 내에서 활용될 수
            있습니다.
          </li>
        </ul>

        <SectionTitle>제5조 (서비스 중단 및 변경)</SectionTitle>
        <p>
          서비스는 시스템 점검, 기술적 장애, 천재지변 등 불가피한 사유로
          일시 중단될 수 있으며, 서비스의 내용은 운영상 필요에 따라 변경될
          수 있습니다. 중요한 변경 사항은 사전에 공지합니다.
        </p>

        <SectionTitle>제6조 (면책)</SectionTitle>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            서비스는 무료로 제공되며, 서비스 이용으로 인한 직접적·간접적
            손해에 대해 법적 책임을 지지 않습니다.
          </li>
          <li>
            AI 분석 결과는 참고용이며, 코드의 정확성이나 성능을 보증하지
            않습니다.
          </li>
          <li>
            이용자 간의 분쟁에 대해 서비스는 개입 의무를 지지 않습니다.
          </li>
        </ul>

        <SectionTitle>제7조 (계정 탈퇴 및 해지)</SectionTitle>
        <p>
          이용자는 언제든지 서비스 내 프로필 설정에서 계정을 탈퇴할 수
          있으며, 탈퇴 시 개인정보 및 서비스 이용 기록은 즉시 삭제됩니다.
        </p>

        <SectionTitle>제8조 (약관 변경)</SectionTitle>
        <p>
          본 약관은 관련 법령 변경이나 서비스 정책 변경에 따라 수정될 수
          있습니다. 약관이 변경되는 경우, 시행일 7일 전 서비스 내 공지를
          통해 안내합니다. 변경된 약관에 동의하지 않는 경우 서비스 탈퇴를
          통해 이용을 중단할 수 있습니다.
        </p>

        <SectionTitle>제9조 (준거법 및 관할)</SectionTitle>
        <p>
          본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련한
          분쟁의 관할 법원은 민사소송법에 따릅니다.
        </p>
      </article>
    </LegalLayout>
  );
}
