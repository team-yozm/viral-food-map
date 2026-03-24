"use client";

import { useEffect, useRef, useState } from "react";
import type { Store } from "@/lib/types";

interface KakaoMapProps {
  stores: Store[];
  center?: { lat: number; lng: number };
  level?: number;
  className?: string;
}

export default function KakaoMap({
  stores,
  center = { lat: 37.5665, lng: 126.978 },
  level = 5,
  className = "map-container",
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.kakao?.maps) return;
    kakao.maps.load(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    const newMap = new kakao.maps.Map(mapRef.current, {
      center: new kakao.maps.LatLng(center.lat, center.lng),
      level,
    });
    setMap(newMap);
  }, [loaded, center.lat, center.lng, level]);

  useEffect(() => {
    if (!map || stores.length === 0) return;

    const markers: kakao.maps.Marker[] = [];
    const bounds = new kakao.maps.LatLngBounds();
    let openInfoWindow: kakao.maps.InfoWindow | null = null;

    stores.forEach((store) => {
      const position = new kakao.maps.LatLng(store.lat, store.lng);
      bounds.extend(position);

      const marker = new kakao.maps.Marker({ position, map });

      const infoContent = `
        <div style="padding:8px 12px;min-width:150px;font-size:13px;line-height:1.4;">
          <strong>${store.name}</strong><br/>
          <span style="color:#666;font-size:11px;">${store.address}</span>
          ${store.phone ? `<br/><span style="color:#FF6B35;font-size:11px;">📞 ${store.phone}</span>` : ""}
        </div>
      `;

      const infoWindow = new kakao.maps.InfoWindow({
        content: infoContent,
        removable: true,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        if (openInfoWindow) openInfoWindow.close();
        infoWindow.open(map, marker);
        openInfoWindow = infoWindow;
      });

      markers.push(marker);
    });

    if (stores.length > 1) {
      map.setBounds(bounds);
    }

    const clusterer = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 6,
    });
    clusterer.addMarkers(markers);

    return () => {
      clusterer.clear();
      markers.forEach((m) => m.setMap(null));
    };
  }, [map, stores]);

  if (!process.env.NEXT_PUBLIC_KAKAO_MAP_KEY) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`}>
        <p className="text-gray-400 text-sm">카카오맵 API 키가 필요합니다</p>
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
}
