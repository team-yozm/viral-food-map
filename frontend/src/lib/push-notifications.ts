/**
 * 네이티브 푸시 알림 초기화 (현재 비활성).
 *
 * Firebase 설정 완료 후 활성화 절차:
 * 1. npm install @capacitor/push-notifications
 * 2. google-services.json을 android/app/에 배치
 * 3. 아래 코드 주석 해제
 * 4. NativeInitializer.tsx에서 호출 주석 해제
 * 5. Supabase에 push_tokens 테이블 생성
 */
export async function initPushNotifications(): Promise<void> {
  // TODO: Firebase 설정 후 아래 주석 해제
  //
  // import { isNative, getPlatform } from "./capacitor-utils";
  // import { supabase } from "./supabase";
  //
  // if (!isNative()) return;
  // const { PushNotifications } = await import("@capacitor/push-notifications");
  // const permResult = await PushNotifications.checkPermissions();
  // if (permResult.receive === "prompt") {
  //   const reqResult = await PushNotifications.requestPermissions();
  //   if (reqResult.receive !== "granted") return;
  // } else if (permResult.receive !== "granted") {
  //   return;
  // }
  // await PushNotifications.register();
  // PushNotifications.addListener("registration", async (token) => {
  //   await supabase.from("push_tokens").upsert(
  //     { token: token.value, platform: getPlatform(), updated_at: new Date().toISOString() },
  //     { onConflict: "token" }
  //   );
  // });
  // PushNotifications.addListener("registrationError", (err) => console.warn(err));
  // PushNotifications.addListener("pushNotificationReceived", (n) => console.log(n));
  // PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
  //   const data = action.notification.data;
  //   if (data?.trend_id) window.location.href = `/trend/${data.trend_id}`;
  //   else if (data?.url) window.location.href = data.url;
  // });
}
