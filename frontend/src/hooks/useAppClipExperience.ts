"use client";

import { useEffect, useState } from "react";

import {
  APP_CLIP_QUERY_PARAM,
  isAppClipSearchParam,
  isAppClipUserAgent,
} from "@/lib/app-clip";

export default function useAppClipExperience() {
  const [isAppClipExperience, setIsAppClipExperience] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hasAppClipParam = isAppClipSearchParam(
      searchParams.get(APP_CLIP_QUERY_PARAM)
    );
    const hasAppClipUserAgent = isAppClipUserAgent(navigator.userAgent);
    setIsAppClipExperience(hasAppClipParam || hasAppClipUserAgent);
  }, []);

  return isAppClipExperience;
}
