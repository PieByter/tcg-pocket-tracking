"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "./icon";

export function CardImage({
  src,
  alt,
  className = "",
  sizes = "96px",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  /** Preload untuk thumbnail di atas lipatan (LCP). */
  priority?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  return (
    <span className={`relative block overflow-hidden rounded-md bg-surface-container-high ${className}`}>
      {status === "failed" ? (
        <span className="grid h-full w-full place-items-center text-outline">
          <Icon name="package" className="h-5 w-5" />
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          decoding="async"
          draggable={false}
          className={`object-cover transition-opacity duration-300 ${
            status === "ready" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("failed")}
        />
      )}
      {status === "loading" && (
        <span className="absolute inset-0 animate-pulse bg-surface-container-highest" />
      )}
    </span>
  );
}
