"use client";

import Image from "next/image";

import { shouldUseUnoptimizedImage } from "@/lib/image-optimization";
import type { NewProductListItem } from "@/lib/new-products";

interface NewProductCardProps {
  product: NewProductListItem;
}

export default function NewProductCard({ product }: NewProductCardProps) {
  const officialUrl = product.product_url || product.source?.site_url || null;
  const useUnoptimizedImage = shouldUseUnoptimizedImage(product.image_url);

  const body = (
    <>
      <div className="relative aspect-square w-full overflow-hidden bg-bg">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 512px) 50vw, 256px"
            unoptimized={useUnoptimizedImage}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent-soft text-3xl text-accent">
            ·
          </div>
        )}
        <span className="font-kicker absolute left-2 top-2 rounded px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.12em] text-white" style={{ background: "rgba(0,0,0,0.45)" }}>
          NEW
        </span>
        {product.is_limited ? (
          <span className="font-kicker absolute right-2 top-2 rounded bg-amber-400 px-1.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.1em] text-amber-950">
            한정
          </span>
        ) : null}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="font-kicker text-[10px] font-bold uppercase tracking-[0.06em] text-accent">
          {product.brand_label}
        </div>
        <div className="mt-1 line-clamp-2 text-[13px] font-bold leading-[1.3] tracking-[-0.01em] text-ink">
          {product.name}
        </div>
        <div className="mt-1 text-[10.5px] text-ink4">
          {product.sector_label}
          {product.category ? ` · ${product.category}` : ""}
        </div>
      </div>
    </>
  );

  const baseClass =
    "block overflow-hidden rounded-[16px] border border-line bg-surface transition-transform active:scale-[0.98]";

  if (officialUrl) {
    return (
      <a
        href={officialUrl}
        target="_blank"
        rel="noreferrer"
        className={baseClass}
      >
        {body}
      </a>
    );
  }

  return <article className={baseClass}>{body}</article>;
}
