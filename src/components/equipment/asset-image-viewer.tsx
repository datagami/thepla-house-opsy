"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AssetImageViewerProps {
  src: string;
  alt: string;
  /** Classes for the clickable thumbnail (size, rounding, flex, …). */
  className?: string;
}

/**
 * A thumbnail that opens the image full-size in a dialog on click — same pattern as the
 * user profile photo viewer. Use for the asset photo on the equipment detail page.
 */
export function AssetImageViewer({ src, alt, className }: AssetImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View photo of ${alt}`}
        className={cn(
          "block cursor-zoom-in overflow-hidden transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-0 bg-black/90 p-2 [&>button]:rounded-full [&>button]:bg-white/10 [&>button]:p-1 [&>button]:text-white [&>button]:opacity-100 [&>button]:hover:bg-white/20">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[80vh] w-full rounded object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
