import { useCallback, useEffect, useRef, useState } from "react";

export const CAPTION_LIMIT = 200;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const DATABASE = "nagoya-v1.2:photo-journal";
const STORE = "entries";
const CHANGE_EVENT = "nagoya:photo-journal-changed";
const CHANNEL = "nagoya-photo-journal";

export interface PreparedPhoto {
  photo: Blob;
  width: number;
  height: number;
  fileName: string;
}
export interface PhotoEntry extends PreparedPhoto {
  id: string;
  caption: string;
  createdAt: number;
  updatedAt: number;
}
export interface PhotoJournalState {
  entries: PhotoEntry[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (
    photo: PreparedPhoto,
    caption: string,
    original?: PhotoEntry,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("zh-Hant", { granularity: "grapheme" })
    : null;
export function captionCharacters(value: string) {
  return segmenter
    ? Array.from(segmenter.segment(value), (part) => part.segment)
    : Array.from(value);
}
export const captionLength = (value: string) => captionCharacters(value).length;
export const limitCaption = (value: string) =>
  captionCharacters(value).slice(0, CAPTION_LIMIT).join("");

let database: Promise<IDBDatabase> | null = null;
function openDatabase(): Promise<IDBDatabase> {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE, 1);
    let abandoned = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        database = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      abandoned = true;
      reject(new Error("請先關閉其他開著手帳的分頁，再重新讀取照片。"));
    };
  }).catch((error) => {
    database = null;
    throw error;
  });
  return database;
}

async function readEntries(): Promise<PhotoEntry[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    transaction.oncomplete = () => {
      const entries: PhotoEntry[] = request.result;
      resolve(entries.sort((a, b) => b.createdAt - a.createdAt));
    };
    transaction.onabort = () => reject(transaction.error);
  });
}

async function writeEntry(entry: PhotoEntry | string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    if (typeof entry === "string") store.delete(entry);
    else store.put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  window.dispatchEvent(new Event(CHANGE_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(CHANNEL);
      channel.postMessage("changed");
      channel.close();
    } catch {
      /* Same-tab state still works if cross-tab messaging is unavailable. */
    }
  }
}

export function journalError(error: unknown, action = "儲存") {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "裝置儲存空間不足，請先刪除一些照片再試；這次內容尚未儲存。";
  }
  if (
    error instanceof DOMException &&
    ["SecurityError", "InvalidStateError", "UnknownError"].includes(error.name)
  ) {
    return "這個瀏覽器目前無法存取照片儲存空間，請確認未封鎖網站資料，或改用一般瀏覽模式。";
  }
  if (error instanceof Error && error.message.startsWith("請先關閉"))
    return error.message;
  return `${action}照片失敗，請重試。原有的紀錄仍保留在此瀏覽器。`;
}

export function usePhotoJournal(): PhotoJournalState {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const saved = await readEntries();
      if (mounted.current && current === generation.current) {
        setEntries(saved);
        setError("");
      }
    } catch (failure) {
      if (mounted.current && current === generation.current)
        setError(journalError(failure, "讀取"));
    } finally {
      if (mounted.current && current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const changed = () => {
      void refresh();
    };
    window.addEventListener(CHANGE_EVENT, changed);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel(CHANNEL);
    } catch {
      /* Storage remains usable when cross-tab messaging is blocked. */
    }
    if (channel) channel.onmessage = changed;
    return () => {
      mounted.current = false;
      window.removeEventListener(CHANGE_EVENT, changed);
      channel?.close();
    };
  }, [refresh]);
  const save = async (
    photo: PreparedPhoto,
    caption: string,
    original?: PhotoEntry,
  ) => {
    if (captionLength(caption) > CAPTION_LIMIT)
      throw new Error("Caption exceeds 200 characters");
    const now = Date.now();
    const entry: PhotoEntry = {
      ...photo,
      caption: caption.trim(),
      id: original?.id || crypto.randomUUID(),
      createdAt: original?.createdAt || now,
      updatedAt: now,
    };
    await writeEntry(entry);
    if (mounted.current) {
      setEntries((items) =>
        [entry, ...items.filter((item) => item.id !== entry.id)].sort(
          (a, b) => b.createdAt - a.createdAt,
        ),
      );
      setError("");
    }
  };
  const remove = async (id: string) => {
    await writeEntry(id);
    if (mounted.current)
      setEntries((items) => items.filter((item) => item.id !== id));
  };
  return { entries, loading, error, refresh, save, remove };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > MAX_PHOTO_BYTES) throw new Error("請選擇 15 MB 以內的照片。");
  const accepted = /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name);
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/heic",
    "image/heif",
  ];
  if (!accepted && !allowedTypes.includes(file.type))
    throw new Error("請選擇 JPG、PNG、WebP 等照片檔案。");
  let source: ImageBitmap | HTMLImageElement;
  let sourceUrl: string | undefined;
  try {
    if (typeof createImageBitmap === "function") {
      try {
        source = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
      } catch {
        source = await loadImage();
      }
    } else source = await loadImage();
  } catch {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    throw new Error("無法讀取這張照片；若為 HEIC，請先轉為 JPG／PNG 後再試。");
  }
  async function loadImage(): Promise<HTMLImageElement> {
    sourceUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = sourceUrl!;
    });
  }
  try {
    const originalWidth =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const originalHeight =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    if (!originalWidth || !originalHeight)
      throw new Error("無法讀取照片尺寸，請改選其他照片。");
    const ratio = Math.min(1, 1600 / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * ratio));
    const height = Math.max(1, Math.round(originalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器無法處理照片，請重試。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);
    const photo = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("照片處理失敗，請重試。")),
        "image/jpeg",
        0.88,
      );
    });
    return { photo, width, height, fileName: file.name };
  } finally {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if ("close" in source) source.close();
  }
}

export function usePhotoUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
