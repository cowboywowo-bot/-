import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  CAPTION_LIMIT,
  captionLength,
  journalError,
  limitCaption,
  preparePhoto,
  usePhotoUrl,
} from "./photo-journal";
import type {
  PhotoEntry,
  PhotoJournalState,
  PreparedPhoto,
} from "./photo-journal";
import "./photo-journal.css";

interface Props {
  journal: PhotoJournalState;
  notify: (message: string) => void;
}

export default function PhotoJournal({ journal, notify }: Props) {
  const [editor, setEditor] = useState<{ entry?: PhotoEntry } | null>(null);
  const [deleting, setDeleting] = useState<PhotoEntry | null>(null);
  return (
    <section className="photo-journal" aria-label="照片手帳">
      <div className="journal-toolbar">
        <div>
          <h2>把這一刻，留在手帳裡</h2>
          <p>一張照片，搭配最多 200 字的小故事。</p>
        </div>
        <button
          className="button primary"
          onClick={() => setEditor({})}
          disabled={journal.loading || !!journal.error}
        >
          <Plus size={18} />
          新增照片
        </button>
      </div>
      <div className="journal-local-note">
        <LockKeyhole size={17} />
        <p>
          照片與敘述只保存在這個瀏覽器，不會公開或同步給其他人。清除網站資料會移除紀錄。
        </p>
      </div>
      {journal.error ? (
        <div className="journal-error" role="alert">
          <p>{journal.error}</p>
          <button
            className="button secondary"
            onClick={() => journal.refresh()}
            disabled={journal.loading}
          >
            <RefreshCw size={16} />
            重新讀取
          </button>
        </div>
      ) : journal.loading && !journal.entries.length ? (
        <p className="journal-loading" role="status">
          正在讀取照片手帳…
        </p>
      ) : journal.entries.length ? (
        <div className="journal-entries">
          {journal.entries.map((entry) => (
            <PhotoCard
              key={entry.id}
              entry={entry}
              onEdit={() => setEditor({ entry })}
              onDelete={() => setDeleting(entry)}
            />
          ))}
        </div>
      ) : (
        <div className="journal-empty">
          <span>
            <Camera size={33} />
          </span>
          <h2>從一張照片，收藏一段回憶</h2>
          <p>
            上傳沿途的風景、美食或合照，
            <br />
            再寫下當下想記住的小事。
          </p>
          <button className="button secondary" onClick={() => setEditor({})}>
            <ImagePlus size={18} />
            加入第一張照片
          </button>
        </div>
      )}
      {editor && (
        <PhotoEditor
          original={editor.entry}
          onClose={() => setEditor(null)}
          onSave={async (photo, caption) => {
            await journal.save(photo, caption, editor.entry);
            setEditor(null);
            notify(editor.entry ? "照片與敘述已更新" : "已收藏照片與回憶");
          }}
        />
      )}
      {deleting && (
        <DeletePhoto
          entry={deleting}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            await journal.remove(deleting.id);
            setDeleting(null);
            notify("已刪除這則照片收藏");
          }}
        />
      )}
    </section>
  );
}

function PhotoCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: PhotoEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const url = usePhotoUrl(entry.photo);
  return (
    <article className="journal-entry">
      <figure>
        {url && (
          <img
            src={url}
            width={entry.width}
            height={entry.height}
            alt="收藏的旅行照片"
            loading="lazy"
          />
        )}
        <figcaption>
          {entry.caption || (
            <span className="journal-no-caption">一張值得收藏的旅行照片。</span>
          )}
        </figcaption>
      </figure>
      <div className="journal-entry-footer">
        <time dateTime={new Date(entry.createdAt).toISOString()}>
          收藏於 {new Date(entry.createdAt).toLocaleDateString("zh-TW")}
        </time>
        <div>
          <button
            className="icon-button"
            onClick={onEdit}
            aria-label="編輯照片與敘述"
          >
            <Pencil size={18} />
          </button>
          <button
            className="icon-button"
            onClick={onDelete}
            aria-label="刪除照片"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

function PhotoEditor({
  original,
  onClose,
  onSave,
}: {
  original?: PhotoEntry;
  onClose: () => void;
  onSave: (photo: PreparedPhoto, caption: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const selection = useRef(0);
  const mounted = useRef(true);
  const [photo, setPhoto] = useState<PreparedPhoto | undefined>(original);
  const [caption, setCaption] = useState(original?.caption || "");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [limited, setLimited] = useState(false);
  const url = usePhotoUrl(photo?.photo);
  const count = captionLength(caption);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      mounted.current = false;
      selection.current++;
      document.body.style.overflow = previous;
      element?.close();
    };
  }, []);
  const changeCaption = (value: string) => {
    setCaption(composing.current ? value : limitCaption(value));
    setLimited(!composing.current && captionLength(value) > CAPTION_LIMIT);
  };
  async function choose(file: File | undefined) {
    if (!file) return;
    const current = ++selection.current;
    setProcessing(true);
    setError("");
    try {
      const prepared = await preparePhoto(file);
      if (mounted.current && current === selection.current) setPhoto(prepared);
    } catch (failure) {
      if (mounted.current && current === selection.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "無法讀取這張照片，請重新選擇。",
        );
    } finally {
      if (mounted.current && current === selection.current)
        setProcessing(false);
    }
  }
  async function save() {
    if (
      !photo ||
      processing ||
      saving ||
      count > CAPTION_LIMIT ||
      composing.current
    )
      return;
    setSaving(true);
    setError("");
    try {
      await onSave(photo, caption);
    } catch (failure) {
      if (mounted.current) {
        setError(journalError(failure));
        setSaving(false);
      }
    }
  }
  const accept =
    "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif";
  return (
    <dialog
      ref={dialog}
      className="photo-editor"
      aria-labelledby="photo-editor-title"
      onCancel={(event) => {
        if (saving) event.preventDefault();
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="dialog-title">
          <h2 id="photo-editor-title">
            {original ? "編輯照片收藏" : "新增照片收藏"}
          </h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={saving}
            aria-label="關閉照片編輯"
          >
            <X size={20} />
          </button>
        </div>
        <p className="photo-editor-intro">留住一張照片，也留住當時的心情。</p>
        <div className={`photo-preview ${url ? "has-photo" : ""}`}>
          {url ? (
            <img src={url} alt="待儲存的收藏照片" />
          ) : (
            <>
              <ImagePlus size={34} />
              <span>選一張想收藏的照片</span>
            </>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={accept}
          hidden
          aria-label="選擇收藏照片"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          aria-label="拍攝收藏照片"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="photo-source-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => fileInput.current?.click()}
            disabled={saving || processing}
          >
            <ImagePlus size={17} />
            {photo ? "更換照片" : "選擇照片"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => cameraInput.current?.click()}
            disabled={saving || processing}
          >
            <Camera size={17} />
            拍照
          </button>
        </div>
        <p className="photo-format-note">
          每張上限 15 MB；會縮圖儲存。HEIC 支援依瀏覽器而定。
        </p>
        {processing && (
          <p className="photo-processing" role="status">
            正在處理照片…
          </p>
        )}
        <div className="caption-label">
          <label htmlFor="photo-caption">這張照片的小故事</label>
          <span id="photo-caption-count" aria-live="polite">
            {count} / {CAPTION_LIMIT} 字
          </span>
        </div>
        <textarea
          id="photo-caption"
          rows={4}
          value={caption}
          placeholder="今天看見了什麼、吃到了什麼，或想記住的心情…"
          aria-describedby="photo-caption-count photo-caption-hint"
          aria-invalid={count > CAPTION_LIMIT}
          disabled={saving}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            changeCaption(event.currentTarget.value);
          }}
          onChange={(event) => changeCaption(event.target.value)}
        />
        <p id="photo-caption-hint" className="photo-caption-hint">
          敘述可留白；包含標點與換行，最多 200 字。
        </p>
        {limited && (
          <p className="photo-limit-notice" role="status">
            最多 200 字，已保留前 200 字。
          </p>
        )}
        {error && (
          <p className="photo-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="photo-editor-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!photo || processing || saving || count > CAPTION_LIMIT}
          >
            <Check size={18} />
            {saving ? "儲存中…" : original ? "儲存變更" : "儲存收藏"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function DeletePhoto({
  entry,
  onClose,
  onDelete,
}: {
  entry: PhotoEntry;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="delete-photo-dialog"
      aria-labelledby="delete-photo-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2 id="delete-photo-title">刪除這則照片收藏？</h2>
      <p>照片與這則敘述會一起從此瀏覽器移除。</p>
      {entry.caption && <blockquote>{entry.caption}</blockquote>}
      {error && (
        <p role="alert" className="photo-form-error">
          {error}
        </p>
      )}
      <div className="photo-editor-actions">
        <button className="button secondary" onClick={onClose} disabled={busy}>
          保留照片
        </button>
        <button
          className="button delete-confirm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onDelete();
            } catch (failure) {
              setError(journalError(failure, "刪除"));
              setBusy(false);
            }
          }}
        >
          {busy ? "刪除中…" : "確認刪除"}
        </button>
      </div>
    </dialog>
  );
}
