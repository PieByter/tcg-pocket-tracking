"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";

export function ResetClock({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(initialMinutes);

  useEffect(() => {
    const timer = setInterval(() => {
      setMinutes((value) => (value <= 0 ? 24 * 60 - 1 : value - 1));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-label-md text-on-surface-variant">
      <Icon name="clock" className="h-3.5 w-3.5 text-outline" />
      Reset hari: {String(hours).padStart(2, "0")}:{String(rest).padStart(2, "0")}
    </span>
  );
}
