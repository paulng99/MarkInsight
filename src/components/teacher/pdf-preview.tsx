"use client";

import { useEffect, useRef, useState } from "react";

export function PdfPreview({
  src,
  loadingLabel,
  errorLabel,
}: {
  src: string;
  loadingLabel: string;
  errorLabel: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ url: src, withCredentials: true }).promise;
      if (cancelled) return;
      host.replaceChildren();
      const width = Math.max(host.clientWidth - 24, 320);
      for (let i = 1; i <= doc.numPages; i += 1) {
        if (cancelled) return;
        const page = await doc.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(1.8, width / base.width),
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "mx-auto mb-3 block max-w-full bg-white shadow-sm";
        host.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
      }
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="h-full overflow-auto bg-[var(--surface-muted)] p-4">
      {loading && !error ? (
        <p className="mb-3 text-sm text-[var(--muted)]">{loadingLabel}</p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-danger)]">{errorLabel}</p> : null}
      <div ref={hostRef} />
    </div>
  );
}
