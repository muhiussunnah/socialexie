"use client";

import { useRef, useState } from "react";
import { Film, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MediaItem {
  id: string;
  name: string;
  kind: "image" | "video";
  /** Object URL owned by the composer, revoked when the item is dropped. */
  url: string;
}

export function MediaDropzone({
  items,
  onAdd,
  onRemove,
  className,
}: {
  items: readonly MediaItem[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(list: FileList | null) {
    if (!list || list.length === 0) return;
    onAdd(Array.from(list));
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-signal bg-signal-soft"
            : "border-line-strong bg-surface-2 hover:border-signal",
        )}
      >
        <ImagePlus
          className={cn(
            "mx-auto size-5",
            dragging ? "text-signal" : "text-subtle",
          )}
        />
        <p className="mt-2 text-[13px]">
          Drop images or video here, or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-signal underline-offset-2 hover:underline"
          >
            browse files
          </button>
        </p>
        <p className="mt-1 text-[11.5px] text-subtle">
          Nothing uploads until you publish — these are local previews.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="sr-only"
          onChange={(event) => {
            accept(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {items.map((item) => (
            <li
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-3"
            >
              {item.kind === "image" ? (
                // Blob URLs from the local file picker cannot go through the
                // image optimiser, so this stays a plain element.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.name}
                  className="size-full object-cover"
                />
              ) : (
                <>
                  <video
                    src={item.url}
                    muted
                    playsInline
                    className="size-full object-cover"
                  />
                  <Film className="absolute top-1.5 left-1.5 size-3.5 text-white drop-shadow" />
                </>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-overlay text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
