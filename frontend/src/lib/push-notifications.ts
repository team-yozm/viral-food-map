import { isNative, getPlatform } from "./capacitor-utils";
import { supabase } from "./supabase";

/**
 * 네이티브 푸시 알림 초기화.
 * Firebase 설정(google-services.json / APNs)이 완료되어야 실제 동작.
 * Firebase 미설정 시 안전하게 스킵.
 */
export async function initPushNotifications(): Promise<void> {
  if (!isNative()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permResult = await PushNotifications.checkPermissions();
    if (permResult.receive === "prompt") {
      const reqResult = await PushNotifications.requestPermissions();
      if (reqResult.receive !== "granted") return;
    } else if (permResult.receive !== "granted") {
      return;
    }

    // register()에서 Firebase 미초기화 시 에러 발생 → catch로 안전 처리
    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      await supabase.from("push_tokens").upsert(
        {
          token: token.value,
          platform: getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("Push registration error:", err);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received:", notification);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data;
      if (data?.trend_id) {
        window.location.href = `/trend/${data.trend_id}`;
      } else if (data?.url) {
        window.location.href = data.url;
      }
    });
  } catch (e) {
    // Firebase 미설정(google-services.json 없음) 등 → 무시
    console.warn("Push notifications unavailable:", e);
  }
}
