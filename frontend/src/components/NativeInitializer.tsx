"use client";

import { useEffect } from "react";

// TODO: Firebase 설정(google-services.json) 완료 후 아래 주석 해제
// import { initPushNotifications } from "@/lib/push-notifications";

export default function NativeInitializer() {
  useEffect(() => {
    // Firebase 미설정 시 PushNotifications.register()가
    // 네이티브 레벨에서 크래시를 일으키므로, 설정 전까지 비활성화.
    // initPushNotifications().catch(() => {});
  }, []);
  return null;
}
