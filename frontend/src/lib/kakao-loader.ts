const KAKAO_MAPS_SCRIPT_ID = "yomechu-kakao-sdk-maps";

let kakaoMapsPromise: Promise<void> | null = null;

function loadExternalScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(id) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${id}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${id}`)),
      { once: true }
    );
    document.head.appendChild(script);
  });
}

export function ensureKakaoMapsLoaded() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is not available."));
  }

  if (window.kakao?.maps) {
    return new Promise<void>((resolve) => {
      kakao.maps.load(() => resolve());
    });
  }

  if (kakaoMapsPromise) {
    return kakaoMapsPromise;
  }

  const kakaoMapKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  if (!kakaoMapKey) {
    return Promise.reject(new Error("Kakao Map key is missing."));
  }

  const mapsUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoMapKey}&autoload=false&libraries=services,clusterer`;

  kakaoMapsPromise = (async () => {
    await loadExternalScript(KAKAO_MAPS_SCRIPT_ID, mapsUrl);

    await new Promise<void>((resolve) => {
      kakao.maps.load(() => resolve());
    });
  })().catch((error) => {
    kakaoMapsPromise = null;
    throw error;
  });

  return kakaoMapsPromise;
}

export async function getAddressLabelFromCoords(lat: number, lng: number) {
  await ensureKakaoMapsLoaded();

  if (!window.kakao?.maps?.services) {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result, status) => {
      if (status !== kakao.maps.services.Status.OK || !result?.[0]) {
        resolve(null);
        return;
      }

      const roadAddress = result[0]?.road_address?.address_name;
      const jibunAddress = result[0]?.address?.address_name;
      resolve(roadAddress || jibunAddress || null);
    });
  });
}