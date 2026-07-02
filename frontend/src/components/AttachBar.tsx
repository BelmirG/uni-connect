"use client";

import { useRef, useState } from "react";
import { Plus, ImageIcon, FileText, X } from "lucide-react";
import type { FileAttachment } from "./FileUploader";

interface PendingItem {
  uid: string;
  kind: "image" | "file";
  localUrl?: string;
  name: string;
  uploading: boolean;
  imageUrl?: string;
  fileAttachment?: FileAttachment;
  error?: string;
}

interface Props {
  onChange: (imageUrls: string[], fileAttachments: FileAttachment[], uploading: boolean) => void;
  maxItems?: number;
}

export function AttachBar({ onChange, maxItems = 5 }: Props) {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function notify(next: PendingItem[]) {
    const imageUrls = next.filter((i) => i.imageUrl).map((i) => i.imageUrl!);
    const fileAttachments = next.filter((i) => i.fileAttachment).map((i) => i.fileAttachment!);
    const uploading = next.some((i) => i.uploading);
    onChange(imageUrls, fileAttachments, uploading);
  }

  async function handleFiles(files: File[], kind: "image" | "file") {
    setMenuOpen(false);
    const allowed = files.slice(0, maxItems - items.length);
    if (!allowed.length) return;

    const placeholders: PendingItem[] = allowed.map((f) => ({
      uid: `${Date.now()}-${Math.random()}`,
      kind,
      name: f.name,
      uploading: true,
      localUrl: kind === "image" ? URL.createObjectURL(f) : undefined,
    }));

    const next = [...items, ...placeholders];
    setItems(next);
    notify(next);

    await Promise.all(allowed.map(async (file, i) => {
      const uid = placeholders[i].uid;
      const fd = new FormData();
      fd.append("file", file);
      const endpoint = kind === "image" ? "/api/upload" : "/api/upload/file";
      try {
        const res = await fetch(endpoint, { method: "POST", credentials: "include", body: fd });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? "Upload failed");
        }
        const raw = await res.json() as { url?: string; name?: string; size?: number; mime_type?: string };
        setItems((prev) => {
          const updated = prev.map((p) =>
            p.uid !== uid ? p : kind === "image"
              ? { ...p, uploading: false, imageUrl: raw.url ?? "" }
              : { ...p, uploading: false, fileAttachment: { url: raw.url ?? "", name: raw.name ?? file.name, size: raw.size ?? file.size, mime_type: raw.mime_type ?? file.type } }
          );
          notify(updated);
          return updated;
        });
      } catch (err) {
        setItems((prev) => {
          const updated = prev.map((p) => p.uid !== uid ? p : { ...p, uploading: false, error: err instanceof Error ? err.message : "Failed" });
          notify(updated);
          return updated;
        });
      }
    }));
  }

  function remove(uid: string) {
    setItems((prev) => {
      const next = prev.filter((p) => p.uid !== uid);
      notify(next);
      return next;
    });
  }

  const canAdd = items.length < maxItems;

  return (
    <div className="flex flex-col gap-2">
      {/* Previews */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item.uid} className="relative flex-shrink-0">
              {item.kind === "image" ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low">
                  {item.localUrl && (
                    <img src={item.localUrl} alt={item.name} className="w-full h-full object-cover" />
                  )}
                  {item.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                      <span className="text-white text-[9px]">…</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-outline-variant bg-surface-container-low max-w-[140px]">
                  <FileText className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
                  <span className="text-xs text-on-surface truncate">{item.name}</span>
                  {item.uploading && <span className="text-[9px] text-on-surface-variant flex-shrink-0">…</span>}
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(item.uid)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-on-surface text-background flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* + button with menu */}
      {canAdd && (
        <div className="relative self-start">
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple className="hidden"
            onChange={(e) => { handleFiles(Array.from(e.target.files ?? []), "image"); if (photoRef.current) photoRef.current.value = ""; }} />
          <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.py,.js,.ts,.jsx,.tsx,.java,.c,.cpp,.h,.cs,.go,.rs,.rb,.php,.json,.yaml,.yml,.toml,.xml,.sh,.sql" multiple className="hidden"
            onChange={(e) => { handleFiles(Array.from(e.target.files ?? []), "file"); if (fileRef.current) fileRef.current.value = ""; }} />

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-8 h-8 rounded-full border border-outline-variant bg-surface flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[10]" />
              <div className="absolute bottom-[calc(100%+6px)] left-0 bg-surface border border-outline-variant rounded-2xl shadow-xl min-w-[130px] z-[20] overflow-hidden">
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                  Photo
                </button>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors border-t border-outline-variant/60">
                  <FileText className="w-3.5 h-3.5 text-orange-500" />
                  File
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
