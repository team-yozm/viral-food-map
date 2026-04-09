import { getPlatform, isNative } from "./capacitor-utils";

interface Position {
  lat: number;
  lng: number;
}

// --- 모듈 레벨 캐시 ---
let cachedPosition: Position | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30초: fresh
const STALE_TTL_MS = 120_000; // 2분: 사용 가능하지만 stale
const NATIVE_RECOVERY_TIMEOUT_MS = 5000;
const NATIVE_PERMISSION_SETTLE_MS: Record<"android" | "ios", number> = {
  android: 900,
  ios: 700,
};
const NATIVE_RECOVERY_RETRY_DELAY_MS: Record<"android" | "ios", number> = {
  android: 1200,
  ios: 900,
};

// 동시 요청 중복 방지
let inflightRequest: Promise<Position> | null = null;

function updateCache(pos: Position) {
  cachedPosition = pos;
  cacheTimestamp = Date.now();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function invalidateLocationCache() {
  cachedPosition = null;
  cacheTimestamp = 0;
}

/**
 * 네이티브에서는 Capacitor Geolocation, 웹에서는 navigator.geolocation 사용.
 * - 30초 내 캐시 반환 (GPS 재요청 없음)
 * - 기본 enableHighAccuracy: false (셀/WiFi 우선, 0.2~1.5초)
 * - enableHighAccuracy: true 시 저정밀 즉시 반환 → 고정밀 백그라운드 업그레이드
 */
export async function getCurrentPosition(
  options?: { timeout?: number; enableHighAccuracy?: boolean; maxCacheAge?: number }
): Promise<Position> {
  const maxCacheAge = options?.maxCacheAge ?? CACHE_TTL_MS;

  // 1. 캐시 히트 시 즉시 반환
  if (cachedPosition && (Date.now() - cacheTimestamp) <= maxCacheAge) {
    return cachedPosition;
  }

  // 2. 이미 진행 중인 요청이 있으면 대기
  if (inflightRequest) {
    return inflightRequest;
  }

  // 3. 새 요청 실행
  inflightRequest = doGetPosition(options).finally(() => {
    inflightRequest = null;
  });

  return inflightRequest;
}

async function doGetPosition(
  options?: { timeout?: number; enableHighAccuracy?: boolean }
): Promise<Position> {
  const timeout = options?.timeout ?? 5000;
  const wantHighAccuracy = options?.enableHighAccuracy ?? false;

  if (isNative()) {
    return doGetPositionNative(timeout, wantHighAccuracy);
  }
  return doGetPositionWeb(timeout, wantHighAccuracy);
}

async function doGetPositionNative(
  timeout: number,
  wantHighAccuracy: boolean
): Promise<Position> {
  const { Geolocation } = await import("@capacitor/geolocation");
  const platform = getPlatform();
  const permissionSettleDelay =
    platform === "android" || platform === "ios"
      ? NATIVE_PERMISSION_SETTLE_MS[platform]
      : 0;
  const recoveryRetryDelay =
    platform === "android" || platform === "ios"
      ? NATIVE_RECOVERY_RETRY_DELAY_MS[platform]
      : 0;

  const readNativePosition = async (requestOptions: {
    enableHighAccuracy: boolean;
    timeout: number;
  }): Promise<Position> => {
    const pos = await Geolocation.getCurrentPosition(requestOptions);
    const result = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    updateCache(result);
    return result;
  };

  const refreshCacheInBackground = (refreshTimeout: number) => {
    Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: refreshTimeout,
    })
      .then((hiPos) => {
        updateCache({ lat: hiPos.coords.latitude, lng: hiPos.coords.longitude });
      })
      .catch(() => {});
  };

  // 권한 확인 → 필요 시 요청
  let perm = await Geolocation.checkPermissions();
  let requestedPermission = false;
  if (perm.location === "prompt" || perm.location === "prompt-with-rationale") {
    requestedPermission = true;
    perm = await Geolocation.requestPermissions();
  }
  if (perm.location === "denied") {
    throw new Error("PERMISSION_DENIED");
  }

  // 권한 허용 직후에는 위치 제공자가 준비될 시간을 조금 줍니다.
  if (requestedPermission && permissionSettleDelay > 0) {
    await sleep(permissionSettleDelay);
  }

  try {
    // Phase 1: 저정밀 빠른 위치 (셀/WiFi)
    const result = await readNativePosition({
      enableHighAccuracy: wantHighAccuracy,
      timeout: wantHighAccuracy ? Math.max(timeout, NATIVE_RECOVERY_TIMEOUT_MS) : Math.min(timeout, 3000),
    });

    // Phase 2: 백그라운드에서 고정밀(GPS) 위치 업그레이드
    if (!wantHighAccuracy) {
      refreshCacheInBackground(timeout);
    }

    return result;
  } catch (error) {
    if (recoveryRetryDelay <= 0) {
      throw error;
    }

    await sleep(recoveryRetryDelay);

    return readNativePosition({
      enableHighAccuracy: true,
      timeout: Math.max(timeout, NATIVE_RECOVERY_TIMEOUT_MS),
    });
  }
}

function doGetPositionWeb(
  timeout: number,
  wantHighAccuracy: boolean
): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GEOLOCATION_NOT_SUPPORTED"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const result = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        updateCache(result);
        resolve(result);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error("PERMISSION_DENIED"));
        else if (err.code === err.TIMEOUT) reject(new Error("TIMEOUT"));
        else reject(new Error("POSITION_UNAVAILABLE"));
      },
      {
        enableHighAccuracy: wantHighAccuracy,
        timeout,
        maximumAge: 30000,
      }
    );
  });
}
