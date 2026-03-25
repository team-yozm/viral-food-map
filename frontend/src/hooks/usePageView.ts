"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "yzm_visitor_id";

function getVisitorId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function usePageView() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string>("");

  useEffect(() => {
    if (pathname === lastTrackedPath.current) return;
    lastTrackedPath.current = pathname;

    const track = async () => {
      try {
        const visitorId = getVisitorId();

        let trendId: string | null = null;
        const trendMatch = pathname.match(/^\/trend\/([a-f0-9-]+)$/i);
        if (trendMatch) {
          trendId = trendMatch[1];
        }

        await supabase.from("page_views").insert({
          page_path: pathname,
          trend_id: trendId,
          visitor_id: visitorId,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        });
      } catch {
        // analytics should never break the app
      }
    };

    track();
  }, [pathname]);
}
