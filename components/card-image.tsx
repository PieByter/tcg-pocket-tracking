"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "./icon";

export function CardImage({
  src,
  alt,
  className = "",
  sizes = "96px",
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`relative block overflow-hidden rounded-md bg-surface-container-high ${className}`}>
      {failed ? (
        <span className="grid h-full w-full place-items-center text-outline">
          <Icon name="package" className="h-5 w-5" />
        </span>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
