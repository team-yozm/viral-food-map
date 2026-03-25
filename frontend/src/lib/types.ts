export interface Trend {
  id: string;
  name: string;
  category: string;
  status: "rising" | "active" | "declining" | "inactive";
  detected_at: string;
  peak_score: number;
  search_volume_data: Record<string, number>;
  description: string | null;
  image_url: string | null;
  store_count?: number;
}

export interface Store {
  id: string;
  trend_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  place_url: string | null;
  rating: number | null;
  source: "kakao_api" | "naver_place" | "user_report";
  verified: boolean;
  last_updated: string;
}

export interface Report {
  id?: string;
  trend_id: string;
  store_name: string;
  address: string;
  lat?: number;
  lng?: number;
  note: string | null;
  status?: "pending" | "verified";
  created_at?: string;
}

export interface Keyword {
  id: string;
  keyword: string;
  category: string;
  is_active: boolean;
  last_checked: string | null;
  baseline_volume: number;
}
