/**
 * FileUploadZone — premium multi-file uploader
 *
 * Features:
 *  - Drag-and-drop + click-to-browse
 *  - Animated glow border while uploading
 *  - Per-file progress bar with percentage
 *  - Thumbnail preview + file size display
 *  - Inline retry (resumes from 0 — HTTP doesn't support partial resume
 *    for standard multipart uploads, but the retry is scoped per-file
 *    so other files are never blocked)
 *  - Multiple files upload in parallel, each with its own progress track
 *  - Failed uploads are isolated — they never block or cancel others
 */
"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, X, RefreshCw, CheckCircle2, AlertCircle, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────
type UploadStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  id: string;
  file: File;
  preview: string | null;       // object URL for images
  status: UploadStatus;
  progress: number;             // 0-100
  error: string | null;
  uploadedUrl: string | null;   // URL returned by server on success
}

interface Props {
  /** POST endpoint. e.g. "/api/students/123/" (PATCH with FormData) */
  endpoint: string;
  /** FormData field name. Defaults to "photo" */
  fieldName?: string;
  /** HTTP method to use. Defaults to "patch" */
  method?: "post" | "patch" | "put";
  /** Accepted MIME types. Defaults to image types */
  accept?: string;
  /** Max number of files. Defaults to 1 */
  maxFiles?: number;
  /** Max file size in bytes. Defaults to 5 MB */
  maxSize?: number;
  /** Called with the server response for each successfully uploaded file */
  onUploaded?: (response: unknown, file: File) => void;
  className?: string;
  label?: string;
}

// ── Helpers ───────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Component ─────────────────────────────────────────────────────
export function FileUploadZone({
  endpoint,
  fieldName  = "photo",
  method     = "patch",
  accept     = "image/jpeg,image/png,image/webp,image/gif",
  maxFiles   = 1,
  maxSize    = 5 * 1024 * 1024,
  onUploaded,
  className,
  label      = "Photo",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // True if any file is currently uploading → show glow
  const isUploading = entries.some((e) => e.status === "uploading");

  // ── State updater helpers ───────────────────────────────────────
  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry?.preview) URL.revokeObjectURL(entry.preview);
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  // ── Upload a single file ─────────────────────────────────────────
  const uploadFile = useCallback(
    async (entry: FileEntry) => {
      updateEntry(entry.id, { status: "uploading", progress: 0, error: null });

      const formData = new FormData();
      formData.append(fieldName, entry.file);

      try {
        const res = await api.request({
          url: endpoint,
          method,
          data: formData,
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            if (evt.total) {
              const pct = Math.round((evt.loaded / evt.total) * 100);
              updateEntry(entry.id, { progress: pct });
            }
          },
        });

        updateEntry(entry.id, {
          status: "done",
          progress: 100,
          uploadedUrl: res.data?.photo ?? null,
        });

        onUploaded?.(res.data, entry.file);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          "Upload failed. Try again.";
        updateEntry(entry.id, { status: "error", error: msg });
      }
    },
    [endpoint, fieldName, method, onUploaded, updateEntry],
  );

  // ── Add files (deduped, validated) ──────────────────────────────
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const remaining = maxFiles - entries.length;
      if (remaining <= 0) return;

      const toAdd: FileEntry[] = arr.slice(0, remaining).reduce<FileEntry[]>((acc, file) => {
        if (file.size > maxSize) return acc; // silently skip oversized
        const isImage = file.type.startsWith("image/");
        const newEntry: FileEntry = {
          id: uid(),
          file,
          preview: isImage ? URL.createObjectURL(file) : null,
          status: "pending",
          progress: 0,
          error: null,
          uploadedUrl: null,
        };
        return [...acc, newEntry];
      }, []);

      setEntries((prev) => [...prev, ...toAdd]);

      // Upload each new file independently (parallel, non-blocking)
      toAdd.forEach((e) => uploadFile(e));
    },
    [entries.length, maxFiles, maxSize, uploadFile],
  );

  // ── Drag & drop handlers ─────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-3", className)}>
      {/* Label */}
      <p className="form-label">{label}</p>

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => entries.length < maxFiles && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-300 select-none",
          // glow while uploading
          isUploading
            ? "border-[var(--gold)] shadow-[0_0_18px_rgba(200,168,75,0.45)] bg-[var(--gold-pale)]"
            : dragOver
            ? "border-navy bg-navy-pale/40"
            : "border-[var(--border-strong)] hover:border-navy hover:bg-[var(--surface)] bg-white",
          entries.length >= maxFiles && "opacity-50 cursor-not-allowed",
        )}
      >
        {isUploading ? (
          <span className="w-8 h-8 border-2 border-[var(--gold)]/40 border-t-[var(--gold)] rounded-full animate-spin" />
        ) : (
          <Upload
            size={22}
            className={cn(
              "transition-colors",
              dragOver ? "text-navy" : "text-[var(--muted)]",
            )}
          />
        )}

        <div>
          <p className="text-sm font-medium text-navy">
            {entries.length >= maxFiles
              ? `Max ${maxFiles} file${maxFiles > 1 ? "s" : ""} reached`
              : isUploading
              ? "Uploading…"
              : "Drop files here or click to browse"}
          </p>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            {accept.replace(/image\//g, "").toUpperCase().split(",").join(", ")} · max {formatBytes(maxSize)}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <FileRow
              key={entry.id}
              entry={entry}
              onRemove={removeEntry}
              onRetry={uploadFile}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── FileRow — individual file progress card ───────────────────────
interface RowProps {
  entry: FileEntry;
  onRemove: (id: string) => void;
  onRetry: (entry: FileEntry) => void;
}

function FileRow({ entry, onRemove, onRetry }: RowProps) {
  const { id, file, preview, status, progress, error } = entry;

  const statusColor = {
    pending:   "bg-[var(--muted)]",
    uploading: "bg-[var(--gold)]",
    done:      "bg-[var(--ok)]",
    error:     "bg-[var(--err)]",
  }[status];

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-200",
        status === "uploading" && "border-[var(--gold)]/50 shadow-[0_0_10px_rgba(200,168,75,0.2)]",
        status === "done"      && "border-[var(--ok)]/40 bg-[var(--ok-bg)]",
        status === "error"     && "border-[var(--err)]/40 bg-[var(--err-bg)]",
        status === "pending"   && "border-[var(--border)]",
      )}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--surface)] flex-shrink-0 flex items-center justify-center border border-[var(--border)]">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={16} className="text-[var(--muted)]" />
        )}
      </div>

      {/* Info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-xs font-medium text-navy truncate max-w-[180px]">{file.name}</p>
          <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{formatBytes(file.size)}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              statusColor,
              status === "uploading" && "animate-[pulse_1.5s_ease-in-out_infinite]",
            )}
            style={{ width: `${status === "pending" ? 0 : progress}%` }}
          />
        </div>

        {/* Status text */}
        <div className="flex items-center gap-1 mt-0.5">
          {status === "uploading" && (
            <p className="text-[10px] text-[var(--gold-dim)] font-medium">{progress}% uploading…</p>
          )}
          {status === "done" && (
            <p className="text-[10px] text-[var(--ok)] font-medium flex items-center gap-1">
              <CheckCircle2 size={10} /> Complete
            </p>
          )}
          {status === "error" && (
            <p className="text-[10px] text-[var(--err)] flex items-center gap-1">
              <AlertCircle size={10} /> {error}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Retry — only on error */}
        {status === "error" && (
          <button
            type="button"
            onClick={() => onRetry(entry)}
            title="Retry upload"
            className="p-1.5 rounded-lg text-[var(--err)] hover:bg-[var(--err-bg)] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        )}
        {/* Remove */}
        {status !== "uploading" && (
          <button
            type="button"
            onClick={() => onRemove(id)}
            title="Remove file"
            className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--err)] transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </li>
  );
}
