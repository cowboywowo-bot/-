import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { seedCoupons } from "./coupon-data";
import type { CouponCategory } from "./coupon-data";
import { usePhotoUrl } from "./photo-journal";

export interface CouponImage {
  image: Blob;
  width: number;
  height: number;
  fileName: string;
}
export interface CouponEdit {
  id: string;
  name: string;
  category: CouponCategory;
  expiresOn: string | null;
  image?: Blob;
  width: number;
  height: number;
  fileName?: string;
  createdAt: number;
}
export interface Coupon {
  id: string;
  name: string;
  category: CouponCategory;
  expiresOn: string | null;
  source: string | Blob;
  width: number;
  height: number;
  isDefault: boolean;
  edited: boolean;
}
export interface CouponDraft {
  name: string;
  category: CouponCategory;
  expiresOn: string | null;
  replacement?: CouponImage;
}
export interface CouponWallet {
  entries: Coupon[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (draft: CouponDraft, original?: Coupon) => Promise<void>;
  resetOrRemove: (id: string) => Promise<void>;
}

const DATABASE = "nagoya-v1.2:coupons";
const STORE = "edits";
const EVENT = "nagoya:coupons-changed";
let opening: Promise<IDBDatabase> | null = null;
function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE, 1);
    let abandoned = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      if (abandoned) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      db.onclose = () => {
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      abandoned = true;
      reject(new Error("請先關閉其他優惠券分頁，再重新讀取。"));
    };
  }).catch((error) => {
    opening = null;
    throw error;
  });
  return opening;
}
async function readEdits(): Promise<CouponEdit[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).getAll();
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
}
async function writeEdit(edit: CouponEdit | string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    if (typeof edit === "string") store.delete(edit);
    else store.put(edit);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
  window.dispatchEvent(new Event(EVENT));
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(EVENT);
      channel.postMessage("changed");
      channel.close();
    }
  } catch {
    /* A single tab can still edit when messaging is unavailable. */
  }
}
export function couponError(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError")
    return "裝置空間不足，這次變更尚未儲存。請釋放一些空間後再試。";
  if (error instanceof Error && error.message.startsWith("請先關閉"))
    return error.message;
  return "無法存取個人優惠券，請確認瀏覽器允許儲存網站資料後重試。原始優惠券仍可查看。";
}
export function useCoupons(): CouponWallet {
  const [edits, setEdits] = useState<CouponEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const stored = await readEdits();
      if (mounted.current && current === generation.current) {
        setEdits(stored);
        setError("");
      }
    } catch (failure) {
      if (mounted.current && current === generation.current)
        setError(couponError(failure));
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
    window.addEventListener(EVENT, changed);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel(EVENT);
    } catch {
      /* Optional cross-tab updates. */
    }
    if (channel) channel.onmessage = changed;
    return () => {
      mounted.current = false;
      window.removeEventListener(EVENT, changed);
      channel?.close();
    };
  }, [refresh]);
  const entries = useMemo<Coupon[]>(() => {
    const resolved = seedCoupons.map((seed) => {
      const edit = edits.find((entry) => entry.id === seed.id);
      return {
        id: seed.id,
        name: edit?.name ?? seed.name,
        category: edit?.category ?? seed.category,
        expiresOn: edit ? edit.expiresOn : seed.expiresOn,
        source: edit?.image ?? seed.image,
        width: edit?.width ?? seed.width,
        height: edit?.height ?? seed.height,
        isDefault: true,
        edited: !!edit,
      };
    });
    return [
      ...resolved,
      ...edits
        .filter(
          (edit) =>
            !seedCoupons.some((seed) => seed.id === edit.id) &&
            edit.image instanceof Blob,
        )
        .map((edit) => ({
          id: edit.id,
          name: edit.name,
          category: edit.category,
          expiresOn: edit.expiresOn,
          source: edit.image!,
          width: edit.width,
          height: edit.height,
          isDefault: false,
          edited: false,
        })),
    ];
  }, [edits]);
  const save = async (draft: CouponDraft, original?: Coupon) => {
    if (!draft.name.trim() || draft.name.trim().length > 80)
      throw new Error("Invalid coupon name");
    if (!original && !draft.replacement)
      throw new Error("A coupon image is required");
    const previous = edits.find((edit) => edit.id === original?.id);
    const edit: CouponEdit = {
      id: original?.id || `user-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      category: draft.category,
      expiresOn: draft.expiresOn || null,
      image: draft.replacement?.image ?? previous?.image,
      width: draft.replacement?.width ?? original!.width,
      height: draft.replacement?.height ?? original!.height,
      fileName: draft.replacement?.fileName ?? previous?.fileName,
      createdAt: previous?.createdAt ?? Date.now(),
    };
    await writeEdit(edit);
    if (mounted.current) {
      setEdits((items) => [
        ...items.filter((item) => item.id !== edit.id),
        edit,
      ]);
      setError("");
    }
  };
  const resetOrRemove = async (id: string) => {
    await writeEdit(id);
    if (mounted.current)
      setEdits((items) => items.filter((item) => item.id !== id));
  };
  return { entries, loading, error, refresh, save, resetOrRemove };
}

export function useCouponUrl(source: string | Blob | undefined) {
  const local = usePhotoUrl(source instanceof Blob ? source : undefined);
  return typeof source === "string" ? source : local;
}
export async function prepareCouponImage(file: File): Promise<CouponImage> {
  if (file.size > 15 * 1024 * 1024)
    throw new Error("請選擇 15 MB 以內的優惠券圖片。");
  if (
    (file.type &&
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)) ||
    !/\.(jpe?g|png|webp)$/i.test(file.name)
  )
    throw new Error("請選擇 JPG、PNG 或 WebP 圖檔。");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error("Invalid image dimensions");
    return {
      image: file.slice(0, file.size, file.type),
      width: image.naturalWidth,
      height: image.naturalHeight,
      fileName: file.name,
    };
  } catch {
    throw new Error(
      "無法讀取這張圖片，請重新選擇清楚的 JPG、PNG 或 WebP 優惠券。",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
