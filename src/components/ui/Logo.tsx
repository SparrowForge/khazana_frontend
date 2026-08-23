"use client";
import { useState } from "react";

type Shape = "unknown" | "wordmark" | "mark";

/**
 * The Khazana Mithai logo.
 *
 * Adapts to whatever `/logo.png` actually contains, measured from the loaded
 * image rather than assumed:
 *
 *  - a WIDE image (wider than 2:1) is the full wordmark — it already contains
 *    the "KHAZANA MITHAI" lettering, so it is shown on its own;
 *  - a SQUARE-ish image is just the motif, so the lettering is set in text
 *    beside it.
 *
 * Doing this by measurement means swapping the asset for the other version
 * needs no code change and can never render the wordmark squashed into a
 * square box.
 *
 * If the image is missing or fails to load, the lettering alone is shown — so
 * every screen keeps working, and keeps naming the company, whether or not the
 * asset has been dropped in, instead of showing a broken-image icon.
 *
 * A plain <img> rather than next/image: a small fixed-height static asset gives
 * the optimiser nothing to do, and `onError` provides the fallback for free.
 */
export default function Logo({
  className = "",
  /** Rendered height in px. Width follows the image's own aspect ratio. */
  size = 36,
  /** Force the lettering off, e.g. in a collapsed sidebar. */
  markOnly = false,
  /** Colour of the lettering. The image carries its own colours. */
  tone = "brand",
}: {
  className?: string;
  size?: number;
  markOnly?: boolean;
  tone?: "brand" | "light" | "dark";
}) {
  const [failed, setFailed] = useState(false);
  const [shape, setShape] = useState<Shape>("unknown");

  const textColor =
    tone === "light" ? "text-white" : tone === "dark" ? "text-gray-900" : "text-[#e8112d]";

  const wordmark = (
    <span
      className={`font-extrabold leading-none tracking-tight whitespace-nowrap ${textColor}`}
      style={{ fontSize: Math.round(size * 0.42) }}
    >
      KHAZANA MITHAI
    </span>
  );

  if (failed) {
    return <span className={`inline-flex items-center ${className}`}>{wordmark}</span>;
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Khazana Mithai"
      style={{ height: size, width: "auto" }}
      className="object-contain"
      onLoad={(e) => {
        const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
        // 2:1 is a comfortable divide: the wordmark is roughly 5:1, the motif
        // roughly 1:1, so nothing realistic sits near the boundary.
        if (h > 0) setShape(w / h > 2 ? "wordmark" : "mark");
      }}
      onError={() => setFailed(true)}
    />
  );

  // The lettering is added only for a square mark, and only until the image has
  // been measured — showing it next to a full wordmark would print the name twice.
  const showText = !markOnly && shape === "mark";

  return (
    <span className={`inline-flex items-center ${showText ? "gap-2.5" : ""} ${className}`}>
      {image}
      {showText && wordmark}
    </span>
  );
}
