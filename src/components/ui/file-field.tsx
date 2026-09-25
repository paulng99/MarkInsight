"use client";

import { useId, useState, type ChangeEvent, type DragEvent } from "react";
import { Icon } from "./icons";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drop-zone styled file input. Stays a real <input type="file"> so it works
 * inside a plain <form> + FormData without extra wiring.
 */
export function FileField({
  name = "file",
  accept,
  required,
  multiple = false,
  title,
  hint,
  selectedLabel,
  compact = false,
  resetKey,
}: {
  name?: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  title: string;
  hint?: string;
  selectedLabel: string;
  compact?: boolean;
  /** Change this value to clear the displayed selection (e.g. after form.reset()). */
  resetKey?: string | number;
}) {
  const id = useId();
  const [files, setFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [active, setActive] = useState(false);
  const [lastReset, setLastReset] = useState(resetKey);

  if (resetKey !== lastReset) {
    setLastReset(resetKey);
    setFiles([]);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setFiles(
      [...(e.target.files ?? [])].map((file) => ({ name: file.name, size: file.size })),
    );
  }

  function onDrag(e: DragEvent, state: boolean) {
    e.preventDefault();
    setActive(state);
  }

  return (
    <div
      className={`dropzone ${compact ? "!py-4" : ""}`}
      data-active={active || undefined}
      onDragEnter={(e) => onDrag(e, true)}
      onDragOver={(e) => onDrag(e, true)}
      onDragLeave={(e) => onDrag(e, false)}
      onDrop={() => setActive(false)}
    >
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        multiple={multiple}
        onChange={onChange}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <span className="icon-tile pointer-events-none !h-11 !w-11 !rounded-2xl">
        {files.length > 0 ? <Icon.FileText size={20} /> : <Icon.Upload size={20} />}
      </span>
      {files.length > 0 ? (
        <p className="pointer-events-none text-sm font-semibold text-[var(--ink)]">
          <span className="text-[var(--muted)]">{selectedLabel}: </span>
          {files.length === 1
            ? files[0]?.name
            : files.map((file) => file.name).join(", ")}
          <span className="ml-1.5 text-xs font-medium text-[var(--muted)]">
            ({formatBytes(files.reduce((sum, file) => sum + file.size, 0))})
          </span>
        </p>
      ) : (
        <label htmlFor={id} className="pointer-events-none text-sm font-semibold text-[var(--ink)]">
          {title}
        </label>
      )}
      {hint ? (
        <p id={`${id}-hint`} className="pointer-events-none text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
