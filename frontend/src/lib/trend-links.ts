import { isNative } from "./capacitor-utils";

export function getTrendHref(id: string) {
  if (isNative()) {
    return `/trend?id=${encodeURIComponent(id)}`;
  }

  return `/trend/${id}`;
}
