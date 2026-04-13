const UNOPTIMIZED_IMAGE_HOSTNAMES = new Set([
  "momstouch.co.kr",
  "www.momstouch.co.kr",
]);

export function shouldUseUnoptimizedImage(src: string | null | undefined) {
  if (!src) {
    return false;
  }

  try {
    const { hostname } = new URL(src);
    return UNOPTIMIZED_IMAGE_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}
