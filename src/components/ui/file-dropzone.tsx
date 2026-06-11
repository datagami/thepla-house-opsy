"use client";

import * as React from "react";
import { UploadCloud, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  /** Called with the validated files chosen (drop or browse). For single mode, the array has 0–1 items. */
  onFiles: (files: File[]) => void;
  /** Accept filter, e.g. "image/*", ".xlsx", "application/pdf,image/*". */
  accept?: string;
  /** Allow selecting more than one file. Default false. */
  multiple?: boolean;
  /** Per-file size cap in MB. Default 10. */
  maxSizeMB?: number;
  /** Currently selected file(s) to preview. */
  value?: File[] | null;
  /** Remove a picked file by index. */
  onRemoveFile?: (index: number) => void;
  /** Edit mode: URL of an already-saved file to show as the current value. */
  existingUrl?: string | null;
  /** Called when the user clears the existing (saved) file. */
  onRemoveExisting?: () => void;
  /** "image" shows thumbnails, "file" shows name chips, "auto" decides per file. Default "auto". */
  variant?: "image" | "file" | "auto";
  disabled?: boolean;
  /** Primary call-to-action line. */
  idleText?: React.ReactNode;
  /** Secondary hint line (e.g. "PNG/JPG up to 5MB"). */
  hint?: string;
  className?: string;
  id?: string;
}

/** True if `file` satisfies the `accept` string (mime globs like image/*, exact mimes, or .ext). */
export function fileMatchesAccept(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true;
  const tokens = accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return tokens.some((tok) => {
    if (tok.startsWith(".")) return name.endsWith(tok);
    if (tok.endsWith("/*")) return type.startsWith(tok.slice(0, -1)); // e.g. "image/"
    return type === tok;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file: File): boolean {
  return (file.type || "").startsWith("image/");
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(url);
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  maxSizeMB = 10,
  value,
  onRemoveFile,
  existingUrl,
  onRemoveExisting,
  variant = "auto",
  disabled = false,
  idleText,
  hint,
  className,
  id,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const files = React.useMemo(() => value ?? [], [value]);

  // Object URLs for image previews — created in a memo and revoked on change/unmount.
  const previews = React.useMemo(
    () =>
      files.map((f) => {
        const image = isImageFile(f);
        return { file: f, image, url: image ? URL.createObjectURL(f) : null };
      }),
    [files]
  );
  React.useEffect(
    () => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)),
    [previews]
  );

  const validate = React.useCallback(
    (incoming: File[]): File[] => {
      const max = maxSizeMB * 1024 * 1024;
      const ok: File[] = [];
      for (const f of incoming) {
        if (!fileMatchesAccept(f, accept)) {
          toast.error(`"${f.name}" is not an accepted file type`);
          continue;
        }
        if (f.size > max) {
          toast.error(`"${f.name}" is larger than ${maxSizeMB}MB`);
          continue;
        }
        ok.push(f);
      }
      return multiple ? ok : ok.slice(0, 1);
    },
    [accept, maxSizeMB, multiple]
  );

  const handleIncoming = React.useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const valid = validate(Array.from(list));
      if (valid.length > 0) onFiles(valid);
    },
    [validate, onFiles]
  );

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const showExisting = !!existingUrl && files.length === 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Drop area */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragActive(false);
          handleIncoming(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragActive ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        <div className="text-[13px] font-medium text-foreground">
          {idleText ?? (
            <>
              <span className="text-primary">Click to upload</span> or drag & drop
            </>
          )}
        </div>
        {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          handleIncoming(e.target.files);
          // reset so picking the same file again re-fires onChange
          e.target.value = "";
        }}
      />

      {/* Existing (saved) value */}
      {showExisting && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-2">
          {isImageUrl(existingUrl!) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={existingUrl!} alt="Current file" className="h-12 w-12 flex-none rounded object-cover" />
          ) : (
            <FileText className="h-5 w-5 flex-none text-muted-foreground" />
          )}
          <a
            href={existingUrl!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground hover:underline"
          >
            Current file
          </a>
          {onRemoveExisting && (
            <button
              type="button"
              onClick={onRemoveExisting}
              disabled={disabled}
              aria-label="Remove current file"
              className="flex-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Picked files */}
      {previews.length > 0 && (
        <div className={cn(variant === "image" ? "flex flex-wrap gap-2" : "space-y-2")}>
          {previews.map((p, i) => {
            const asImage = variant === "image" || (variant === "auto" && p.image);
            if (asImage && p.url) {
              return (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.file.name} className="h-16 w-16 rounded border object-cover" />
                  {onRemoveFile && (
                    <button
                      type="button"
                      onClick={() => onRemoveFile(i)}
                      disabled={disabled}
                      aria-label={`Remove ${p.file.name}`}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 text-muted-foreground shadow ring-1 ring-border hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            }
            return (
              <div key={i} className="flex items-center gap-2.5 rounded-md border bg-muted/30 p-2">
                <FileText className="h-5 w-5 flex-none text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{p.file.name}</div>
                  <div className="text-[11px] text-muted-foreground">{formatBytes(p.file.size)}</div>
                </div>
                {onRemoveFile && (
                  <button
                    type="button"
                    onClick={() => onRemoveFile(i)}
                    disabled={disabled}
                    aria-label={`Remove ${p.file.name}`}
                    className="flex-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
