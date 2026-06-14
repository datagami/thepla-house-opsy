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
 * A thumbnail that opens the image full-size in a clean, frameless lightbox on
 * click. shadcn/ui has no dedicated gallery component, so this builds on Dialog:
 * the image is the hero (contained, rounded), with a caption scrim and a sleek
 * close affordance. Clicking the dimmed backdrop or pressing Esc closes it.
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
        <DialogContent
          className={cn(
            // Frameless: shrink-wrap the image so the surrounding dim area stays
            // the overlay (click-outside-to-close still works).
            "w-auto max-w-[95vw] gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none",
            // Sleek round close button (the built-in DialogClose).
            "[&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-black/55 [&>button]:text-white [&>button]:opacity-100 [&>button]:backdrop-blur-sm [&>button]:ring-offset-0 [&>button]:transition-colors [&>button]:hover:bg-black/75 [&>button>svg]:h-[18px] [&>button>svg]:w-[18px]"
          )}
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <figure className="relative m-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[88dvh] w-auto max-w-[95vw] rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
            />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-3 pt-12 text-[13px] font-medium text-white">
              {alt}
            </figcaption>
          </figure>
        </DialogContent>
      </Dialog>
    </>
  );
}
