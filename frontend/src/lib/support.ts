import type { Store } from "./types";

export const SUPPORT_EMAIL = "support@yozmeat.com";

interface MailtoOptions {
  subject: string;
  bodyLines?: string[];
}

function buildMailtoUrl({ subject, bodyLines = [] }: MailtoOptions) {
  const params = new URLSearchParams();
  params.set("subject", subject);

  if (bodyLines.length > 0) {
    params.set("body", bodyLines.join("\n"));
  }

  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

export function buildGeneralSupportMailto(topic: string) {
  return buildMailtoUrl({
    subject: `요즘뭐먹 문의 - ${topic}`,
    bodyLines: [
      "문의 내용을 적어주세요.",
      "",
      "[기기/브라우저]",
      "[문제가 발생한 화면]",
      "[상세 설명]",
    ],
  });
}

export function buildPrivacyRequestMailto() {
  return buildMailtoUrl({
    subject: "요즘뭐먹 개인정보/콘텐츠 삭제 요청",
    bodyLines: [
      "삭제 또는 열람을 원하는 항목을 적어주세요.",
      "",
      "[요청 유형] 개인정보 삭제 / 콘텐츠 수정 / 콘텐츠 삭제 / 기타",
      "[대상 화면 또는 매장명]",
      "[상세 설명]",
      "[회신 받을 이메일]",
    ],
  });
}

export function buildStoreIssueMailto(
  store: Pick<Store, "id" | "name" | "address">,
  options?: {
    trendName?: string | null;
    pagePath?: string | null;
  }
) {
  return buildMailtoUrl({
    subject: `요즘뭐먹 정보 수정/삭제 요청 - ${store.name}`,
    bodyLines: [
      "아래 정보를 확인해 수정 또는 삭제를 요청합니다.",
      "",
      `[매장명] ${store.name}`,
      `[주소] ${store.address}`,
      `[매장 ID] ${store.id}`,
      `[트렌드] ${options?.trendName ?? "확인 필요"}`,
      `[화면 경로] ${options?.pagePath ?? "앱 내 화면"}`,
      "",
      "[요청 유형] 정보 수정 / 정보 삭제 / 기타",
      "[상세 설명]",
    ],
  });
}
