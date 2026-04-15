import { SITE_URL } from "@/lib/site";

export const APP_CLIP_QUERY_PARAM = "appClip";
export const APP_CLIP_QUERY_VALUE = "1";
export const APP_CLIP_USER_AGENT_TOKEN = "yozmeat-appclip";
export const IOS_APP_CLIP_BUNDLE_ID = "com.yozmeat.app.Clip";

const SITE_ORIGIN = new URL(SITE_URL).origin;

function isAbsoluteUrl(value: string) {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

export function isAppClipSearchParam(value?: string | null) {
  return value === APP_CLIP_QUERY_VALUE;
}

export function isAppClipUserAgent(userAgent?: string | null) {
  if (!userAgent) {
    return false;
  }

  return userAgent.toLowerCase().includes(APP_CLIP_USER_AGENT_TOKEN);
}

export function withAppClipParam(href: string, isAppClipExperience: boolean) {
  if (!isAppClipExperience) {
    return href;
  }

  try {
    const absolute = isAbsoluteUrl(href);
    const url = new URL(href, SITE_URL);

    if (url.origin !== SITE_ORIGIN) {
      return href;
    }

    url.searchParams.set(APP_CLIP_QUERY_PARAM, APP_CLIP_QUERY_VALUE);

    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function stripAppClipParam(rawUrl: string) {
  try {
    const absolute = isAbsoluteUrl(rawUrl);
    const url = new URL(rawUrl, SITE_URL);

    if (url.origin !== SITE_ORIGIN) {
      return rawUrl;
    }

    url.searchParams.delete(APP_CLIP_QUERY_PARAM);

    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawUrl;
  }
}

export function buildAppleSmartBannerContent(appStoreId?: string | null) {
  const trimmedAppStoreId = appStoreId?.trim();

  if (!trimmedAppStoreId) {
    return null;
  }

  return `app-clip-bundle-id=${IOS_APP_CLIP_BUNDLE_ID}, app-id=${trimmedAppStoreId}`;
}
