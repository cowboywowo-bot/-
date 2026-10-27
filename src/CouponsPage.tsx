import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ImagePlus,
  Info,
  Maximize,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Ticket,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { COUPON_CATEGORIES } from "./coupon-data";
import type { CouponCategory } from "./coupon-data";
import { couponError, prepareCouponImage, useCouponUrl } from "./coupons";
import type { Coupon, CouponDraft, CouponImage, CouponWallet } from "./coupons";
import { jpDate } from "./lib";
import "./coupons.css";

interface Props {
  wallet: CouponWallet;
  notify: (message: string) => void;
}
export default function CouponsPage({ wallet, notify }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ coupon?: Coupon } | null>(null);
  const [confirm, setConfirm] = useState<Coupon | null>(null);
  const filtered = wallet.entries.filter(
    (coupon) =>
      (category === "全部" || coupon.category === category) &&
      coupon.name
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const viewer = wallet.entries.find((coupon) => coupon.id === viewerId);
  const viewerList =
    viewer && filtered.some((coupon) => coupon.id === viewer.id)
      ? filtered
      : wallet.entries;
  return (
    <section className="coupon-wallet" aria-label="優惠券清單">
      <div className="coupon-wallet-top">
        <label className="search-field">
          <Search size={19} />
          <input
            type="search"
            aria-label="搜尋店家或優惠券名稱"
            placeholder="搜尋店家／券名"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className="button primary"
          disabled={wallet.loading || !!wallet.error}
          onClick={() => setEditor({})}
        >
          <Plus size={17} />
          新增優惠券
        </button>
      </div>
      <div className="filter-row coupon-filters" aria-label="優惠券分類">
        {["全部", ...COUPON_CATEGORIES].map((label) => (
          <button
            key={label}
            className={`filter ${category === label ? "selected" : ""}`}
            aria-pressed={category === label}
            onClick={() => setCategory(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="coupon-use-note">
        <Info size={18} />
        <p>
          請在結帳前出示，並核對券面效期、適用門市與商品。實際優惠以券面及店家規則為準。
        </p>
      </div>
      {wallet.error && (
        <div className="coupon-storage-error" role="alert">
          <p>{wallet.error}</p>
          <button
            className="button secondary"
            onClick={() => wallet.refresh()}
            disabled={wallet.loading}
          >
            <RefreshCw size={16} />
            重新讀取個人編輯
          </button>
        </div>
      )}
      <div className="coupon-grid">
        {filtered.map((coupon) => (
          <article
            className="coupon-card"
            key={coupon.id}
            data-coupon={coupon.id}
          >
            <button
              className="coupon-thumbnail"
              aria-label={`出示${coupon.name}`}
              onClick={() => setViewerId(coupon.id)}
              disabled={wallet.loading}
            >
              <CouponPicture coupon={coupon} />
            </button>
            <div className="coupon-card-body">
              <div className="coupon-tags">
                <span className="pill">{coupon.category}</span>
                {coupon.edited ? (
                  <span className="coupon-edited">個人編輯</span>
                ) : (
                  !coupon.isDefault && (
                    <span className="coupon-edited">自行新增</span>
                  )
                )}
              </div>
              <h2>{coupon.name}</h2>
              <Expiry coupon={coupon} />
              <button
                className="button primary coupon-show"
                onClick={() => setViewerId(coupon.id)}
                disabled={wallet.loading}
              >
                <Ticket size={16} />
                出示優惠券
              </button>
              <div className="coupon-card-actions">
                <button
                  className="coupon-edit"
                  onClick={() => setEditor({ coupon })}
                  disabled={wallet.loading || !!wallet.error}
                >
                  <Pencil size={15} />
                  編輯名稱／換圖
                </button>
                {(coupon.edited || !coupon.isDefault) && (
                  <button
                    className="icon-button"
                    onClick={() => setConfirm(coupon)}
                    disabled={wallet.loading || !!wallet.error}
                    aria-label={
                      coupon.isDefault
                        ? `還原${coupon.name}原始優惠券`
                        : `刪除${coupon.name}`
                    }
                  >
                    {coupon.isDefault ? (
                      <RotateCcw size={17} />
                    ) : (
                      <Trash2 size={17} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="coupon-empty">
          <Ticket size={34} />
          <h2>沒有符合的優惠券</h2>
          <p>換個店家名稱，或切回全部分類看看。</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setCategory("全部");
            }}
          >
            顯示全部優惠券
          </button>
        </div>
      )}
      <p className="coupon-local-note">
        這裡的 12
        張原始優惠券可直接查看。名稱、更換圖片與自行新增的券只儲存在此瀏覽器，不會同步給其他人。
      </p>
      {viewer && (
        <CouponViewer
          coupon={viewer}
          list={viewerList}
          onSelect={setViewerId}
          onClose={() => setViewerId(null)}
        />
      )}
      {editor && (
        <CouponEditor
          original={editor.coupon}
          onClose={() => setEditor(null)}
          onSave={async (draft) => {
            await wallet.save(draft, editor.coupon);
            setEditor(null);
            notify(editor.coupon ? "優惠券名稱與圖片已儲存" : "已新增優惠券");
          }}
        />
      )}
      {confirm && (
        <CouponConfirm
          coupon={confirm}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await wallet.resetOrRemove(confirm.id);
            setConfirm(null);
            notify(
              confirm.isDefault ? "已還原原始優惠券" : "已刪除自行新增的優惠券",
            );
          }}
        />
      )}
    </section>
  );
}

function Expiry({ coupon }: { coupon: Coupon }) {
  const expired = coupon.expiresOn && coupon.expiresOn < jpDate();
  return (
    <p className={`coupon-expiry ${expired ? "past" : ""}`}>
      {coupon.expiresOn
        ? `${expired ? "券面日期已過" : "券面效期至"} ${coupon.expiresOn.replaceAll("-", "/")}`
        : "效期請查看券面"}
    </p>
  );
}
function CouponPicture({
  coupon,
  onFailure,
}: {
  coupon: Coupon;
  onFailure?: () => void;
}) {
  const url = useCouponUrl(coupon.source);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (failed)
    return (
      <div className="coupon-image-error" role="alert">
        圖片無法載入，請連線後重新開啟優惠券。
      </div>
    );
  return url ? (
    <img
      src={url}
      alt={`${coupon.name}優惠券原圖`}
      width={coupon.width}
      height={coupon.height}
      loading={onFailure ? "eager" : "lazy"}
      onError={() => {
        setFailed(true);
        onFailure?.();
      }}
    />
  ) : (
    <span className="coupon-image-pending">正在讀取圖片…</span>
  );
}
function CouponModal({
  className,
  titleId,
  onClose,
  busy = false,
  children,
}: {
  className: string;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={className}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      {children}
    </dialog>
  );
}
function CouponViewer({
  coupon,
  list,
  onSelect,
  onClose,
}: {
  coupon: Coupon;
  list: Coupon[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const url = useCouponUrl(coupon.source);
  const index = list.findIndex((item) => item.id === coupon.id);
  useEffect(() => {
    setZoom(100);
    setFailed(false);
    scroll.current?.scrollTo(0, 0);
  }, [coupon.id]);
  return (
    <CouponModal
      className="coupon-viewer"
      titleId="coupon-viewer-title"
      onClose={onClose}
    >
      <header className="coupon-viewer-header">
        <div>
          <span>出示給店員 · 可捲動查看完整券面</span>
          <h2 id="coupon-viewer-title">{coupon.name}</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="關閉優惠券"
        >
          <X size={23} />
        </button>
      </header>
      <div
        ref={scroll}
        className="coupon-image-scroll"
        tabIndex={0}
        role="region"
        aria-label="優惠券券面，可捲動及放大"
      >
        <div className="coupon-original-paper" style={{ width: `${zoom}%` }}>
          <CouponPicture
            key={`${coupon.id}-${attempt}`}
            coupon={coupon}
            onFailure={() => setFailed(true)}
          />
        </div>
      </div>
      <footer className="coupon-viewer-controls">
        <div className="coupon-viewer-navigation">
          <button
            className="button secondary"
            disabled={index <= 0}
            onClick={() => onSelect(list[index - 1].id)}
          >
            <ArrowLeft size={16} />
            上一張
          </button>
          <span aria-live="polite">
            {index + 1} / {list.length}
          </span>
          <button
            className="button secondary"
            disabled={index >= list.length - 1}
            onClick={() => onSelect(list[index + 1].id)}
          >
            下一張
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="coupon-zoom-controls">
          <button
            className="icon-button"
            disabled={zoom <= 100}
            onClick={() => setZoom((value) => Math.max(100, value - 50))}
            aria-label="縮小優惠券"
          >
            <ZoomOut size={21} />
          </button>
          <span aria-live="polite">{zoom}%</span>
          <button
            className="icon-button"
            disabled={zoom >= 300}
            onClick={() => setZoom((value) => Math.min(300, value + 50))}
            aria-label="放大優惠券"
          >
            <ZoomIn size={21} />
          </button>
          <button
            className="coupon-fit"
            onClick={() => {
              setZoom(100);
              scroll.current?.scrollTo(0, 0);
            }}
          >
            <Maximize size={16} />
            適合寬度
          </button>
          {url && (
            <a
              className="icon-button"
              href={url}
              download={`${coupon.name.replace(/[\\/:*?"<>|]/g, "-")}.${coupon.source instanceof Blob ? (coupon.source.type === "image/png" ? "png" : coupon.source.type === "image/webp" ? "webp" : "jpg") : "jpg"}`}
              aria-label="下載優惠券原圖"
            >
              <Download size={21} />
            </a>
          )}
          {failed && (
            <button
              className="icon-button"
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
              aria-label="重新載入優惠券圖片"
            >
              <RefreshCw size={20} />
            </button>
          )}
        </div>
      </footer>
    </CouponModal>
  );
}
function CouponEditor({
  original,
  onClose,
  onSave,
}: {
  original?: Coupon;
  onClose: () => void;
  onSave: (draft: CouponDraft) => Promise<void>;
}) {
  const [name, setName] = useState(original?.name || "");
  const [category, setCategory] = useState<CouponCategory>(
    original?.category || "其他",
  );
  const [expiresOn, setExpiresOn] = useState(original?.expiresOn || "");
  const [replacement, setReplacement] = useState<CouponImage>();
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const url = useCouponUrl(replacement?.image ?? original?.source);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const hasImage = !!replacement || !!original;
  async function choose(file?: File) {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const image = await prepareCouponImage(file);
      if (alive.current) {
        setReplacement(image);
        setExpiresOn("");
      }
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : "無法讀取優惠券圖片。",
        );
    } finally {
      if (alive.current) setProcessing(false);
    }
  }
  async function save() {
    if (!name.trim() || !hasImage || saving || processing) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        name,
        category,
        expiresOn: expiresOn || null,
        replacement,
      });
    } catch (failure) {
      if (alive.current) {
        setError(couponError(failure));
        setSaving(false);
      }
    }
  }
  return (
    <CouponModal
      className="coupon-editor"
      titleId="coupon-editor-title"
      onClose={onClose}
      busy={saving}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="dialog-title">
          <h2 id="coupon-editor-title">
            {original ? "編輯優惠券" : "新增優惠券"}
          </h2>
          <button
            type="button"
            className="icon-button"
            disabled={saving}
            onClick={onClose}
            aria-label="關閉優惠券編輯"
          >
            <X size={21} />
          </button>
        </div>
        <p className="coupon-editor-note">
          只變更這個瀏覽器的券夾，原始圖檔不會被覆寫。
        </p>
        <div className="coupon-edit-preview">
          {url ? (
            <img src={url} alt="優惠券圖片預覽" />
          ) : (
            <>
              <ImagePlus size={32} />
              <span>選擇清楚、完整的優惠券圖檔</span>
            </>
          )}
        </div>
        <input
          hidden
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="選擇優惠券圖片"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="button secondary coupon-upload-button"
          onClick={() => fileInput.current?.click()}
          disabled={saving || processing}
        >
          <ImagePlus size={18} />
          {processing
            ? "讀取圖片中…"
            : hasImage
              ? "更換優惠券圖片"
              : "選擇優惠券圖片"}
        </button>
        <p className="coupon-image-hint">
          JPG／PNG／WebP，每張上限 15 MB；保留原始解析度與條碼。
        </p>
        <div className="coupon-field">
          <label htmlFor="coupon-name">優惠券名稱</label>
          <input
            id="coupon-name"
            autoComplete="off"
            maxLength={80}
            required
            placeholder="例如：松本清購物優惠券"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={saving}
          />
        </div>
        <div className="coupon-field-pair">
          <div className="coupon-field">
            <label htmlFor="coupon-category">分類</label>
            <select
              id="coupon-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as CouponCategory)
              }
              disabled={saving}
            >
              {COUPON_CATEGORIES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="coupon-field">
            <label htmlFor="coupon-expiry">券面有效期限（選填）</label>
            <input
              id="coupon-expiry"
              type="date"
              value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        {replacement && (
          <p className="coupon-image-hint" role="status">
            已更換圖片，請重新確認名稱與券面效期。
          </p>
        )}
        {error && (
          <p className="coupon-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="coupon-editor-actions">
          <button
            type="button"
            className="button secondary"
            disabled={saving}
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!name.trim() || !hasImage || saving || processing}
          >
            <Check size={18} />
            {saving ? "儲存中…" : "儲存優惠券"}
          </button>
        </div>
      </form>
    </CouponModal>
  );
}
function CouponConfirm({
  coupon,
  onClose,
  onConfirm,
}: {
  coupon: Coupon;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <CouponModal
      className="coupon-confirm"
      titleId="coupon-confirm-title"
      onClose={onClose}
      busy={busy}
    >
      <h2 id="coupon-confirm-title">
        {coupon.isDefault
          ? "還原這張原始優惠券？"
          : "刪除這張自行新增的優惠券？"}
      </h2>
      <p>
        {coupon.isDefault
          ? "此瀏覽器的名稱、換圖與效期編輯會移除，回到附件原始版本。"
          : "會從此瀏覽器移除圖片與名稱；其他原始優惠券會保留。"}
      </p>
      <strong>{coupon.name}</strong>
      {error && (
        <p className="coupon-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="coupon-editor-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } catch (failure) {
              setError(couponError(failure));
              setBusy(false);
            }
          }}
        >
          {busy ? "處理中…" : coupon.isDefault ? "確認還原" : "確認刪除"}
        </button>
      </div>
    </CouponModal>
  );
}
