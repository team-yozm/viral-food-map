import { NextResponse } from "next/server";

import { getNewProductsCatalogData } from "@/lib/new-products-server";

export const revalidate = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source =
    url.searchParams.get("source") === "convenience"
      ? "convenience"
      : "franchise";
  const data = await getNewProductsCatalogData(source);

  return NextResponse.json(data);
}
