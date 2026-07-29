import { useEffect, useState } from "react";
import { trimImageWhitespace } from "@/lib/trim-image";

export function TrimmedLogo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc(src);
    trimImageWhitespace(src).then((trimmed) => {
      if (!cancelled) setResolvedSrc(trimmed);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return <img src={resolvedSrc} alt={alt} className={className} />;
}
