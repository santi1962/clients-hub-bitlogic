import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api-client";

/**
 * Fetches a protected file URL using the JWT access token and returns a
 * temporary blob URL safe for use in <img src> / <audio src>.
 * Revokes the blob URL on unmount to avoid memory leaks.
 */
export function useSecureUrl(url: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let revoked = false;
    let objectUrl: string | null = null;

    const fetchFile = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        // silently fail — the UI already handles missing files
      }
    };

    fetchFile();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlobUrl(null);
    };
  }, [url]);

  return blobUrl;
}
