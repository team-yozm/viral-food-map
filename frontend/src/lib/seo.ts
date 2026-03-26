import type { Metadata } from "next";
import {
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "./site";

interface BuildMetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  keywords?: string[];
  noIndex?: boolean;
  type?: "website" | "article";
}

interface BuildTrendDescriptionOptions {
  name: string;
  description?: string | null;
  storeCount?: number;
  detectedAt?: string | null;
}

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function truncateDescription(text: string, maxLength = 160): string {
  const normalized = normalizeText(text);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function resolveImageUrl(image?: string | null): string {
  if (!image) {
    return absoluteUrl(DEFAULT_OG_IMAGE);
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return absoluteUrl(image.startsWith("/") ? image : `/${image}`);
}

function mergeKeywords(keywords: string[] = []): string[] {
  return Array.from(new Set([...keywords, ...DEFAULT_KEYWORDS]));
}

export function buildTrendDescription({
  name,
  description,
  storeCount = 0,
  detectedAt,
}: BuildTrendDescriptionOptions): string {
  if (description) {
    return truncateDescription(description);
  }

  const detectedDate = detectedAt
    ? `${new Date(detectedAt).toLocaleDateString("ko-KR")} 기준 `
    : "";
  const storeSummary =
    storeCount > 0
      ? `판매처 ${storeCount}곳을 지도에서 확인하세요.`
      : "내 주변 판매처와 최신 트렌드 정보를 확인하세요.";

  return truncateDescription(
    `${detectedDate}${name} 트렌드 페이지입니다. ${storeSummary} 요즘뭐먹이 SNS에서 뜨는 음식을 빠르게 모아 보여드립니다.`
  );
}

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  image,
  keywords,
  noIndex = false,
  type = "website",
}: BuildMetadataOptions): Metadata {
  const resolvedImage = resolveImageUrl(image);
  const openGraphTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

  return {
    title: title ?? SITE_NAME,
    description,
    keywords: mergeKeywords(keywords),
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: openGraphTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: "ko_KR",
      type,
      images: [
        {
          url: resolvedImage,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: openGraphTitle,
      description,
      images: [resolvedImage],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}
