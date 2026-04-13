"use client";

import Image from "next/image";
import type { NewProductListItem } from "@/lib/new-products-server";
import type { NewProductSourceType } from "@/lib/types";

interface NewProductCardProps {
  product: NewProductListItem;
}

const SOURCE_TYPE_LABELS: Record<NewProductSourceType, string> = {
  convenience: "편의점",
  franchise: "프랜차이즈",
};

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

export default function NewProductCard({ product }: NewProductCardProps) {
  const imageFallback = (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-[#8BACD8] text-4xl text-white">
      신
    </div>
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">
      <div className="relative h-52 w-full bg-gray-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 512px) 100vw, 512px"
            className="object-cover"
          />
        ) : (
          imageFallback
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
            {SOURCE_TYPE_LABELS[product.source_type]}
          </span>
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
            {product.brand}
          </span>
          {product.is_limited ? (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-amber-950">
              한정
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-xs font-medium text-white/75">
            {product.source?.title || product.brand}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">
            {product.name}
          </h2>
          {product.summary ? (
            <p className="mt-2 line-clamp-2 text-sm text-white/85">
              {product.summary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
            {product.date_label} {formatDateLabel(product.effective_at)}
          </span>
          {product.category ? (
            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">
              {product.category}
            </span>
          ) : null}
          <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">
            {product.channel}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {product.source?.title || product.brand}
            </p>
            <p className="truncate text-xs text-gray-400">
              {product.product_url || product.source?.site_url || "공식 링크 준비 중"}
            </p>
          </div>
          {product.product_url ? (
            <a
              href={product.product_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-600"
            >
              공식 링크
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
