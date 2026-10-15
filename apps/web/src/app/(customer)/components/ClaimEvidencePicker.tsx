"use client";

import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";

const ACCEPT = "image/*,application/pdf,video/mp4";
const MAX_FILES = 5;
const MAX_BYTES = 12 * 1024 * 1024;

export type EvidenceFile = {
  id: string;
  file: File;
  previewUrl?: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowed(file: File) {
  const t = file.type;
  return t.startsWith("image/") || t === "application/pdf" || t === "video/mp4";
}

function fileKind(file: File): "image" | "pdf" | "video" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("video/")) return "video";
  return "other";
}

export function ClaimEvidencePicker({
  files,
  onChange,
  maxFiles = MAX_FILES,
}: {
  files: EvidenceFile[];
  onChange: (next: EvidenceFile[]) => void;
  maxFiles?: number;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    return () => {
      for (const f of files) {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      const room = maxFiles - files.length;
      if (room <= 0) {
        setHint(`You can add up to ${maxFiles} files.`);
        return;
      }
      const next: EvidenceFile[] = [...files];
      let skipped = 0;
      for (const file of incoming) {
        if (next.length >= maxFiles) break;
        if (!isAllowed(file) || file.size > MAX_BYTES) {
          skipped += 1;
          continue;
        }
        const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
        const kind = fileKind(file);
        const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
        next.push({ id, file, previewUrl });
      }
      if (skipped) setHint("Some files were skipped (type or size over 12 MB).");
      else setHint(null);
      onChange(next);
    },
    [files, maxFiles, onChange],
  );

  function removeAt(id: string) {
    const target = files.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((f) => f.id !== id));
    setHint(null);
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  const slotsLeft = maxFiles - files.length;

  return (
    <div className="as-evidence">
      <div
        className={`as-evidence-stage${dragging ? " is-dragging" : ""}${files.length ? " has-files" : ""}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="as-evidence-stage__glow" aria-hidden />
        <div className="as-evidence-stage__copy">
          <span className="as-evidence-stage__kicker">Evidence desk</span>
          <strong>Drop photos or a short clip here</strong>
          <p>
            Clear shots of the issue help us resolve faster. Images, PDF, or MP4 — up to {maxFiles}{" "}
            files, 12&nbsp;MB each.
          </p>
        </div>

        <div className="as-evidence-actions">
          <label htmlFor={inputId} className="as-evidence-browse">
            <span className="as-evidence-browse__icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 16V4m0 0 4 4m-4-4-4 4M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            Browse files
          </label>
          <span className="as-evidence-meta">
            {files.length}/{maxFiles} added
            {slotsLeft > 0 ? ` · ${slotsLeft} left` : " · full"}
          </span>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          className="as-evidence-input"
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {hint ? <p className="as-evidence-hint">{hint}</p> : null}

      {files.length > 0 ? (
        <ul className="as-evidence-mosaic" aria-label="Selected files">
          {files.map((item, index) => {
            const kind = fileKind(item.file);
            return (
              <li
                key={item.id}
                className={`as-evidence-tile as-evidence-tile--${kind}`}
                style={{ ["--as-tile-i" as string]: String(index) }}
              >
                <div className="as-evidence-tile__frame">
                  {kind === "image" && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="as-evidence-tile__img" />
                  ) : (
                    <div className="as-evidence-tile__badge" data-kind={kind}>
                      {kind === "pdf" ? "PDF" : kind === "video" ? "MP4" : "FILE"}
                    </div>
                  )}
                </div>
                <div className="as-evidence-tile__meta">
                  <span className="as-evidence-tile__name" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="as-evidence-tile__size">{formatBytes(item.file.size)}</span>
                </div>
                <button
                  type="button"
                  className="as-evidence-tile__remove"
                  onClick={() => removeAt(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="as-evidence-empty-hints" aria-hidden>
          <span>Serial / label</span>
          <span>Close-up of issue</span>
          <span>Wide context shot</span>
        </div>
      )}
    </div>
  );
}
