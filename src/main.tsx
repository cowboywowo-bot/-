import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock3,
  Compass,
  Copy,
  ExternalLink,
  Heart,
  House,
  Info,
  Luggage,
  MapPin,
  Mountain,
  NotebookPen,
  Plane,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Ticket,
  Trash2,
  Utensils,
  WifiOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CheckItem, Food, Place, TripEvent } from "./models";
import {
  categoryLabels,
  eventTime,
  eventTimezone,
  findPlace,
  formatDate,
  hotel,
  isStringList,
  journey,
  loadStored,
  mapsUrl,
  placeDay,
  placeReferences,
  safeUrl,
  timeLabels,
  trip,
} from "./lib";
import Landscape from "./Landscape";
import heroImage from "./assets/nagoya-people.png";
import "./styles.css";

const defaultChecklist: CheckItem[] = [
  "護照",
  "機票",
  "飯店確認",
  "吉卜力票券確認",
  "eSIM / 網路",
  "交通／現金",
].map((label, i) => ({ id: `pack-${i}`, label, done: false }));
function isChecklist(v: unknown): v is CheckItem[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        x &&
        typeof x.id === "string" &&
        typeof x.label === "string" &&
        typeof x.done === "boolean",
    )
  );
}
function isNotes(v: unknown): v is Record<string, string> {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.values(v).every((x) => typeof x === "string")
  );
}
function useStored<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState(() => loadStored(key, fallback, validate));
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(`nagoya-v1.2:${key}`, JSON.stringify(value));
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, [key, value]);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === `nagoya-v1.2:${key}` || e.key === null)
        setValue(loadStored(key, fallback, validate));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key, fallback, validate]);
  return [value, setValue, available];
}
interface AppState {
  favorites: string[];
  progress: string[];
  checklist: CheckItem[];
  notes: Record<string, string>;
  setChecklist: Dispatch<SetStateAction<CheckItem[]>>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  toggleFavorite: (id: string) => void;
  toggleProgress: (id: string) => void;
  notify: (message: string) => void;
  storageAvailable: boolean;
}
const Context = createContext<AppState>(null!);
const useApp = () => useContext(Context);
const EMPTY_LIST: string[] = [];
const EMPTY_NOTES: Record<string, string> = {};
function Provider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites, a] = useStored(
    "favorites",
    EMPTY_LIST,
    isStringList,
  );
  const [progress, setProgress, b] = useStored(
    "progress",
    EMPTY_LIST,
    isStringList,
  );
  const [checklist, setChecklist, c] = useStored(
    "checklist",
    defaultChecklist,
    isChecklist,
  );
  const [notes, setNotes, d] = useStored("notes", EMPTY_NOTES, isNotes);
  const [toast, setToast] = useState({ message: "", id: 0 });
  useEffect(() => {
    const timer = window.setTimeout(
      () => setToast((t) => ({ ...t, message: "" })),
      2800,
    );
    return () => clearTimeout(timer);
  }, [toast.id]);
  const notify = (message: string) =>
    setToast((t) => ({ message, id: t.id + 1 }));
  const toggleFavorite = (id: string) => {
    setFavorites((items) =>
      items.includes(id) ? items.filter((x) => x !== id) : [...items, id],
    );
    notify(
      favorites.includes(id)
        ? "已取消收藏"
        : "已加入收藏，留給下一個喜歡的自己",
    );
  };
  const toggleProgress = (id: string) => {
    setProgress((items) =>
      items.includes(id) ? items.filter((x) => x !== id) : [...items, id],
    );
    notify(
      progress.includes(id) ? "已取消完成紀錄" : "已記錄完成，收下一段小回憶",
    );
  };
  return (
    <Context.Provider
      value={{
        favorites,
        progress,
        checklist,
        notes,
        setChecklist,
        setNotes,
        toggleFavorite,
        toggleProgress,
        notify,
        storageAvailable: a && b && c && d,
      }}
    >
      {children}
      <div
        className={`toast ${toast.message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        <CircleCheck size={18} />
        {toast.message}
      </div>
    </Context.Provider>
  );
}

const scrollPositions = new Map<string, number>();
function ScrollMemory() {
  const { key } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, scrollPositions.get(key) || 0);
    return () => {
      scrollPositions.set(key, window.scrollY);
    };
  }, [key]);
  return null;
}
function External({
  href,
  children,
  className = "",
}: {
  href?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const { notify } = useApp();
  const safe = safeUrl(href);
  if (!safe) return null;
  return (
    <a
      className={className}
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (!navigator.onLine) notify("離線中；請連上網路後開啟地圖或參考資料");
      }}
    >
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
function PlaceLink({
  place,
  children,
  className = "",
}: {
  place: Place;
  children: ReactNode;
  className?: string;
}) {
  const location = useLocation();
  return (
    <Link
      to={`/place/${place.id}`}
      state={{ backTo: location.pathname }}
      className={className}
    >
      {children}
    </Link>
  );
}
function Favorite({ id, label }: { id: string; label: string }) {
  const { favorites, toggleFavorite } = useApp();
  const active = favorites.includes(id);
  return (
    <button
      className={`icon-button favorite ${active ? "active" : ""}`}
      aria-label={`${active ? "取消收藏" : "收藏"}${label}`}
      aria-pressed={active}
      onClick={() => toggleFavorite(id)}
    >
      <Heart size={20} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <div className="title-row">
        <h1>{title}</h1>
        {children}
      </div>
      <p>{subtitle}</p>
    </div>
  );
}
function SectionTitle({
  children,
  to,
  label = "查看全部",
}: {
  children: ReactNode;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {label}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
function Notice({
  children,
  icon: Icon = Info,
  className = "",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={`notice ${className}`}>
      <Icon size={19} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
function Back({ fallback = "/itinerary" }: { fallback?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <button
      className="back-button"
      onClick={() =>
        location.state?.backTo ? navigate(-1) : navigate(fallback)
      }
    >
      <ArrowLeft size={18} />
      返回{location.state?.backTo ? "" : "行程"}
    </button>
  );
}
function DaySelector({
  selected,
  onSelect,
  includeAll = false,
}: {
  selected: string;
  onSelect: (date: string) => void;
  includeAll?: boolean;
}) {
  return (
    <div className="day-selector" aria-label="選擇行程日期">
      {includeAll && (
        <button
          className={`day-chip all ${selected === "all" ? "selected" : ""}`}
          aria-pressed={selected === "all"}
          onClick={() => onSelect("all")}
        >
          <span>全部</span>
          <strong>6 天</strong>
        </button>
      )}
      {trip.days.map((day, i) => (
        <button
          key={day.date}
          className={`day-chip ${selected === day.date ? "selected" : ""}`}
          onClick={() => onSelect(day.date)}
          aria-label={`11 月 ${i + 1} 日 星期${day.weekday}`}
          aria-pressed={selected === day.date}
        >
          <span>週{day.weekday}</span>
          <strong>{day.date.slice(8)}</strong>
          <span className="chip-dot" />
        </button>
      ))}
    </div>
  );
}
const eventIcons: Record<string, LucideIcon> = {
  flight: Plane,
  arrival: Luggage,
  hotel: House,
  meal: Utensils,
  attraction: Mountain,
  shopping: ShoppingBag,
};
function Timeline({ events }: { events: TripEvent[] }) {
  const { progress, toggleProgress } = useApp();
  return (
    <div className="timeline">
      {events.map((e) => {
        const Icon = eventIcons[e.type] || MapPin;
        const place = findPlace(e.placeId);
        const done = progress.includes(e.id);
        return (
          <article
            key={e.id}
            className={`timeline-item ${done ? "completed" : ""}`}
            data-event={e.id}
          >
            <div className="timeline-rail">
              <span className={`event-icon ${e.type}`}>
                <Icon size={18} />
              </span>
            </div>
            <div
              className={`event-card ${e.id === "d2-warehouse" ? "special" : ""}`}
            >
              <div className="event-meta">
                <strong>{eventTime(e)}</strong>
                <span>{timeLabels[e.timeStatus]}</span>
              </div>
              {e.time && (
                <span className="tiny timezone">{eventTimezone(e)}</span>
              )}
              <div className="event-heading">
                {place ? (
                  <PlaceLink place={place}>
                    <h3>{e.title}</h3>
                  </PlaceLink>
                ) : (
                  <h3>{e.title}</h3>
                )}
                {place && <Favorite id={place.id} label={place.name} />}
              </div>
              {e.id === "d2-warehouse" && (
                <p className="admission-note">
                  <Ticket size={16} />
                  指定入場時刻 · 票券持有狀態未確認
                </p>
              )}
              {e.note && <p className="event-note">{e.note}</p>}
              {e.type === "meal" && <p className="tiny">訂位未確認</p>}
              <div className="event-actions">
                {place && (
                  <External href={mapsUrl(place)} className="text-link">
                    <MapPin size={15} />
                    {place.mapsUrl ? "開啟 Google Maps" : "搜尋地點"}
                  </External>
                )}
                <label className="complete-control">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleProgress(e.id)}
                    aria-label={`完成${e.title}`}
                  />
                  <span>{done ? "已完成" : "完成"}</span>
                </label>
              </div>
              {!!e.references?.length && (
                <details className="references-inline">
                  <summary>參考資料 · {e.references.length}</summary>
                  {e.references.map((r, i) => (
                    <External key={r} href={r} className="reference-link">
                      參考連結 {i + 1}
                    </External>
                  ))}
                  <p className="tiny">
                    來源可能更新；無法開啟時請搜尋名稱或改看官方網站。
                  </p>
                </details>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
function PlaceCard({ place, date }: { place: Place; date?: string }) {
  const { progress, toggleProgress } = useApp();
  const eaten = progress.includes(`eaten:${place.id}`);
  const Icon =
    place.category === "food"
      ? Utensils
      : place.category === "hotel"
        ? House
        : place.category === "transport"
          ? Plane
          : Mountain;
  return (
    <article className="place-card">
      <div className={`place-symbol ${place.category}`}>
        <Icon size={25} />
      </div>
      <div className="place-content">
        <div className="place-top">
          <span className="eyebrow">
            {date
              ? `${formatDate(date)} · 晚餐`
              : categoryLabels[place.category]}
          </span>
          <Favorite id={place.id} label={place.name} />
        </div>
        <PlaceLink place={place}>
          <h3>
            {place.name}
            <ChevronRight size={17} />
          </h3>
        </PlaceLink>
        <p className="tiny">
          {place.category === "food" ? "訂位未確認 · " : ""}
          {place.address ||
            (place.mapsUrl ? "已有地圖連結" : "詳細地址待確認，提供地點搜尋")}
        </p>
        <div className="place-actions">
          <External href={mapsUrl(place)} className="text-link">
            <MapPin size={15} />
            {place.mapsUrl ? "開啟 Google Maps" : "搜尋地點"}
          </External>
          {place.category === "food" && (
            <label className="complete-control">
              <input
                type="checkbox"
                checked={eaten}
                onChange={() => toggleProgress(`eaten:${place.id}`)}
                aria-label={`吃過${place.name}`}
              />
              吃過
            </label>
          )}
        </div>
      </div>
    </article>
  );
}
function Home() {
  const { progress, favorites } = useApp();
  const status = journey();
  const day = status.day;
  const dayIndex = trip.days.indexOf(day) + 1;
  const upcoming = day.events.find((e) => !progress.includes(e.id));
  const nextPlace = upcoming && findPlace(upcoming.placeId);
  const completed = day.events.filter((e) => progress.includes(e.id)).length;
  return (
    <>
      <section className="hero">
        <img
          className="hero-photo"
          src={heroImage}
          alt="兩位旅人在名古屋電視塔前比出和平手勢的旅行插畫"
          width={1254}
          height={1254}
          fetchPriority="high"
          decoding="async"
        />
        <div className="hero-copy">
          <span className="eyebrow">A LITTLE JOURNEY, A LOT OF MEMORIES</span>
          <h1>
            名古屋慢旅日記<span className="hero-spark">✳</span>
          </h1>
          <p>把日子放慢，把喜歡的風景收進口袋。</p>
          <div className="trip-date">
            <CalendarDays size={15} />
            2026.11.01 — 11.06<span>6 天 5 夜</span>
          </div>
        </div>
      </section>
      <div className="journey-status">
        <span className="status-icon">
          <Sparkles size={20} />
        </span>
        <div>
          {status.before ? (
            <>
              <span>離出發還有</span>
              <strong>
                {status.countdown}
                <small>天，好期待這趟小旅行</small>
              </strong>
            </>
          ) : status.after ? (
            <>
              <span>把回憶好好收藏</span>
              <strong>
                旅程回顧<small>六天的風景，都在這裡</small>
              </strong>
            </>
          ) : (
            <>
              <span>今天是旅行的</span>
              <strong>
                Day {dayIndex}
                <small>{day.theme}</small>
              </strong>
            </>
          )}
        </div>
        <Link
          to={`/itinerary/${day.date}`}
          className="icon-button"
          aria-label="查看行程"
        >
          <ArrowRight size={21} />
        </Link>
      </div>
      <SectionTitle to={`/itinerary/${day.date}`} label="完整行程">
        {status.before
          ? "第一天的小計畫"
          : status.after
            ? "最後一天的回憶"
            : "今天，慢慢走"}
      </SectionTitle>
      <div className="day-caption">
        <span className="pill">DAY {dayIndex}</span>
        <strong>
          {formatDate(day.date)}（{day.weekday}）{day.theme}
        </strong>
        <span>
          {completed}/{day.events.length}
        </span>
      </div>
      <section className="next-stop">
        <div className="next-label">
          <span className="live-dot" />
          {status.after ? "尚未勾選的回憶" : "下一個尚未完成的行程"}
          <Compass size={17} />
        </div>
        {upcoming ? (
          <>
            <span className="next-time">
              {eventTime(upcoming)}
              <small>{eventTimezone(upcoming)}</small>
            </span>
            <h2>{upcoming.title}</h2>
            <p>
              {upcoming.timeStatus === "source_flight"
                ? "依航班表定時間，請留意航空公司最新通知。"
                : upcoming.note || "按自己的步調出發，完成後記得收下這段回憶。"}
            </p>
            {nextPlace ? (
              <External className="button primary" href={mapsUrl(nextPlace)}>
                <MapPin size={17} />
                {nextPlace.mapsUrl ? "開啟 Google Maps" : "搜尋下一站"}
              </External>
            ) : (
              <Link className="button primary" to="/trip">
                <Plane size={17} />
                查看航班資訊
                <ArrowRight size={17} />
              </Link>
            )}
          </>
        ) : (
          <>
            <h2>今天的風景，全部收好了。</h2>
            <p>慢下來休息一下，或者看看下一天的計畫。</p>
            <Link className="button primary" to="/itinerary">
              查看六日行程
              <ArrowRight size={17} />
            </Link>
          </>
        )}
      </section>
      <div className="quick-grid">
        {[
          {
            icon: CalendarDays,
            title: status.before ? "首日行程" : "今日行程",
            text: "照著自己的步調走",
            to: `/itinerary/${day.date}`,
          },
          {
            icon: Compass,
            title: "前往下一站",
            text: nextPlace ? "開啟地點搜尋" : "先看看交通資訊",
            to: nextPlace ? `/place/${nextPlace.id}` : "/trip",
          },
          {
            icon: House,
            title: "回到飯店",
            text: "安心休息的小基地",
            to: `/place/${hotel.id}`,
          },
          {
            icon: Heart,
            title: "我的收藏",
            text: `${favorites.length} 個想留住的地方`,
            to: "/favorites",
          },
        ].map(({ icon: Icon, title, text, to }) => (
          <Link to={to} key={title} className="quick-card">
            <span>
              <Icon size={21} />
            </span>
            <strong>{title}</strong>
            <small>{text}</small>
            <ArrowUpRight size={16} className="quick-arrow" />
          </Link>
        ))}
      </div>
      <SectionTitle>先放進口袋的提醒</SectionTitle>
      <Link className="reminder" to="/itinerary/2026-11-02">
        <span className="reminder-date">
          NOV<strong>02</strong>
        </span>
        <div>
          <strong>10:00 吉卜力大倉庫入場</strong>
          <p>入場時間已確認，請另行確認有效票券。</p>
        </div>
        <ChevronRight size={18} />
      </Link>
      <Link className="reminder" to="/itinerary/2026-11-06">
        <span className="reminder-date green">
          NOV<strong>06</strong>
        </span>
        <div>
          <strong>13:00 抵達中部國際機場</strong>
          <p>這是抵達機場時間；CX531 於 16:40 起飛。</p>
        </div>
        <ChevronRight size={18} />
      </Link>
      <div className="mini-timeline">
        <SectionTitle to={`/itinerary/${day.date}`}>行程小預覽</SectionTitle>
        <Timeline events={day.events.slice(0, 2)} />
      </div>
      <div className="closing-note">
        <Mountain size={23} />
        <p>
          旅行沒有標準答案，
          <br />
          喜歡的地方，就多停留一下。
        </p>
        <span>NAGOYA · AUTUMN 2026</span>
      </div>
    </>
  );
}
function Itinerary() {
  const { date } = useParams();
  const current = journey().day;
  const selected = date || current.date;
  const day = trip.days.find((d) => d.date === selected);
  const { progress } = useApp();
  const navigate = useNavigate();
  if (!day)
    return (
      <Empty
        title="這天不在旅行日期裡"
        text="這趟名古屋小旅行是 11/01～11/06，挑一天繼續看看吧。"
        to="/itinerary"
        label="回到六日行程"
      />
    );
  const completed = day.events.filter((e) => progress.includes(e.id)).length;
  return (
    <>
      <PageTitle
        eyebrow="THE DAILY PLAN"
        title="每天，都有小期待"
        subtitle="六天五夜，留一點時間給路上的驚喜。"
      />
      <DaySelector
        selected={selected}
        onSelect={(d) => navigate(`/itinerary/${d}`)}
      />
      <section className="day-overview">
        <span className="eyebrow">
          DAY {trip.days.indexOf(day) + 1} · {formatDate(day.date)}（
          {day.weekday}）
        </span>
        <h2>{day.theme}</h2>
        <div className="progress-row">
          <span>
            {completed} / {day.events.length} 段回憶已完成
          </span>
          <span>{Math.round((completed / day.events.length) * 100)}%</span>
        </div>
        <div className="progress-track">
          <span
            style={{ width: `${(completed / day.events.length) * 100}%` }}
          />
        </div>
      </section>
      <Timeline events={day.events} />
      <Notice>
        行程依原規劃順序呈現。交通與營業時間待核對；勾選只記錄個人進度，不代表預訂完成。
      </Notice>
    </>
  );
}
function MapPage() {
  const [date, setDate] = useState(journey().day.date);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const places = trip.places.filter(
    (p) =>
      (date === "all" ||
        p.id === hotel.id ||
        placeDay(p.id).some((d) => d.date === date)) &&
      (category === "all" || p.category === category) &&
      p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="FIND YOUR NEXT STOP"
        title="喜歡的地方，就出發"
        subtitle="不用記住每條路，把下一站交給地圖。"
      />
      <DaySelector selected={date} onSelect={setDate} includeAll />
      <section className="map-intro">
        <div className="map-grid-art" aria-hidden="true">
          <span className="map-pin one">
            <House size={19} />
          </span>
          <span className="map-pin two">
            <Mountain size={19} />
          </span>
          <span className="map-pin three">
            <Utensils size={19} />
          </span>
        </div>
        <div>
          <span className="eyebrow">YOUR POCKET MAP</span>
          <h2>地點清單 × Google Maps</h2>
          <p>
            開啟外部地圖查詢位置與路線。
            <br />
            目前沒有已驗證座標，不顯示地圖標記。
          </p>
        </div>
      </section>
      <External className="button hotel-shortcut" href={hotel.mapsUrl}>
        <House size={18} />
        回飯店 · 開啟 Google Maps
      </External>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="搜尋景點、餐廳或住宿"
      />
      <div className="filter-row" aria-label="地點類別">
        {[
          ["all", "全部"],
          ["attraction", "景點"],
          ["food", "餐廳"],
          ["hotel", "飯店"],
          ["shopping", "購物"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`filter ${category === id ? "selected" : ""}`}
            onClick={() => setCategory(id)}
            aria-pressed={category === id}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="results-label">
        找到 {places.length} 個地方<span>無即時定位或路線 ETA</span>
      </div>
      <div className="card-list">
        {places.map((p) => (
          <PlaceCard key={p.id} place={p} />
        ))}
      </div>
      {!places.length && (
        <Empty
          inline
          title="這裡還沒有符合的地方"
          text="試試其他日期、類別或關鍵字。"
        />
      )}
      <Notice>
        「搜尋地點」會開啟 Google Maps
        搜尋結果，位置尚待自行核對；地圖、影片需要網路。
      </Notice>
    </>
  );
}
function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={19} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
function FoodCard({ food }: { food: Food }) {
  const { progress, toggleProgress } = useApp();
  const done = progress.includes(`eaten:${food.id}`);
  return (
    <article className="food-card">
      <div className="food-illustration" aria-hidden="true">
        <svg width="86" height="72" viewBox="0 0 86 72" fill="none">
          <ellipse
            cx="43"
            cy="48"
            rx="31"
            ry="10"
            fill="#D6B891"
            opacity=".25"
          />
          <path
            d="M15 30h56c-2 21-12 29-28 29S18 51 15 30Z"
            fill="#F8F2DE"
            stroke="#AD8C6F"
            strokeWidth="2"
          />
          <ellipse cx="43" cy="30" rx="28" ry="9" fill="#C99761" />
          <path
            d="m26 27 8 6m4-9 8 8m4-8 9 6"
            stroke="#EEDAA0"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M35 16c-5-5 5-5 0-10m13 11c-5-5 5-5 0-10"
            stroke="#BFAA91"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m55 15 21-10m-17 15L81 9"
            stroke="#7F735F"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>名古屋の味</span>
      </div>
      <div className="food-card-body">
        <div className="place-top">
          <span className="eyebrow">想吃的料理</span>
          <Favorite id={food.id} label={food.title} />
        </div>
        <h3>{food.title}</h3>
        <p className="tiny">料理主題參考，非已核實店家</p>
        <div className="food-actions">
          <External href={food.referenceUrl} className="text-link">
            參考影片
          </External>
          <label className="complete-control">
            <input
              type="checkbox"
              checked={done}
              onChange={() => toggleProgress(`eaten:${food.id}`)}
              aria-label={`吃過${food.title}`}
            />
            吃過
          </label>
        </div>
      </div>
    </article>
  );
}
function FoodPage() {
  const [filter, setFilter] = useState("dinners");
  const [query, setQuery] = useState("");
  const { favorites } = useApp();
  const dinners = trip.days.flatMap((d) =>
    d.events
      .filter((e) => e.type === "meal")
      .map((e) => ({ place: findPlace(e.placeId)!, date: d.date })),
  );
  const filteredDinners = dinners.filter((d) =>
    d.place.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const foods = trip.foodCandidates.filter(
    (f) =>
      f.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter !== "wishlist" || favorites.includes(f.id)),
  );
  const wishedPlaces = trip.places.filter(
    (p) =>
      p.category === "food" &&
      favorites.includes(p.id) &&
      p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="GOOD FOOD, GOOD MOOD"
        title="把名古屋，吃進回憶裡"
        subtitle="一頓好吃的飯，也是旅行的重要風景。"
      />
      <div className="food-banner">
        <Utensils size={28} />
        <div>
          <strong>今天想吃什麼？</strong>
          <p>從味噌香氣，到居酒屋的暖暖燈光。</p>
        </div>
        <span aria-hidden="true">いただきます</span>
      </div>
      <div className="segmented">
        {[
          ["dinners", "行程晚餐"],
          ["wishlist", "想吃清單"],
          ["categories", "料理種類"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={filter === id ? "selected" : ""}
            aria-pressed={filter === id}
          >
            {label}
          </button>
        ))}
      </div>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="搜尋餐廳或想吃的料理"
      />
      {filter === "dinners" ? (
        <>
          <p className="results-label">
            五個夜晚，五種滋味<span>訂位狀態皆未確認</span>
          </p>
          <div className="card-list">
            {filteredDinners.map((d) => (
              <PlaceCard key={d.date} place={d.place} date={d.date} />
            ))}
          </div>
          {!filteredDinners.length && (
            <Empty inline title="沒有找到這道滋味" text="換個關鍵字試試看。" />
          )}
        </>
      ) : (
        <>
          {filter === "wishlist" && (
            <div className="card-list">
              {wishedPlaces.map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </div>
          )}
          <div className="food-grid">
            {foods.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
          {!foods.length && !wishedPlaces.length && (
            <Empty
              inline
              title={
                filter === "wishlist" ? "把心動的料理收進來" : "沒有符合的料理"
              }
              text={
                filter === "wishlist"
                  ? "點一下餐廳或料理旁的愛心，就能放進想吃清單。"
                  : "換個關鍵字試試看。"
              }
            />
          )}
        </>
      )}
      <Notice>
        影片是料理與旅遊參考，不代表已確認店家、地址或預訂；若連結失效，可依料理名稱自行搜尋。
      </Notice>
    </>
  );
}
function CopyButton({
  value,
  label = "複製地址",
}: {
  value: string;
  label?: string;
}) {
  const { notify } = useApp();
  const [manual, setManual] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      notify("已複製");
      setManual(false);
    } catch {
      notify("複製失敗，請長按下方文字手動複製");
      setManual(true);
    }
  }
  useEffect(() => {
    if (manual) {
      input.current?.focus();
      input.current?.select();
    }
  }, [manual]);
  return (
    <>
      <button className="button secondary" onClick={copy}>
        <Copy size={16} />
        {label}
      </button>
      {manual && (
        <label className="manual-copy">
          長按或選取後複製
          <textarea
            ref={input}
            readOnly
            value={value}
            aria-label="手動複製文字"
          />
        </label>
      )}
    </>
  );
}
function HotelInfo() {
  return (
    <section className="hotel-card">
      <div className="hotel-top">
        <span className="hotel-icon">
          <House size={26} />
        </span>
        <div>
          <span className="eyebrow">OUR LITTLE BASE</span>
          <h2>這幾天，我們住這裡</h2>
        </div>
      </div>
      <h3>{hotel.name}</h3>
      <p className="hotel-dates">
        {formatDate(trip.accommodation.checkInDate)} 入住{" "}
        <ArrowRight size={14} /> {formatDate(trip.accommodation.checkOutDate)}{" "}
        退房 · 5 晚
      </p>
      <p className="address">{hotel.address}</p>
      <div className="button-stack">
        <External href={hotel.mapsUrl} className="button primary">
          <MapPin size={17} />
          開啟 Google Maps
        </External>
        <CopyButton value={hotel.address!} />
        <External href={hotel.websiteUrl} className="text-link">
          飯店官方網站
        </External>
      </div>
      <div className="hotel-schedule">
        <p>
          <Clock3 size={16} />
          <strong>11/01 預估 18:00 抵達</strong>
        </p>
        <p>
          <Clock3 size={16} />
          <strong>11/06 10:00 退房</strong>
        </p>
        <span className="tiny">抵達時間為預估，請依入境與交通調整。</span>
      </div>
    </section>
  );
}
function Checklist() {
  const { checklist, setChecklist, notify } = useApp();
  const [newItem, setNewItem] = useState("");
  function add() {
    const label = newItem.trim();
    if (!label) return;
    setChecklist((items) => [
      ...items,
      { id: crypto.randomUUID(), label, done: false },
    ]);
    setNewItem("");
    notify("已加入旅前清單");
  }
  return (
    <section className="checklist card">
      <div className="section-title">
        <h2>出發前，再看一眼</h2>
        <span className="tiny">
          {checklist.filter((x) => x.done).length}/{checklist.length}
        </span>
      </div>
      {checklist.map((item) => (
        <div
          key={item.id}
          className={`checklist-row ${item.done ? "checked" : ""}`}
        >
          <input
            type="checkbox"
            checked={item.done}
            onChange={() =>
              setChecklist((items) =>
                items.map((x) =>
                  x.id === item.id ? { ...x, done: !x.done } : x,
                ),
              )
            }
            aria-label={`已備妥${item.label}`}
          />
          <input
            className="check-label"
            value={item.label}
            maxLength={80}
            onChange={(e) =>
              setChecklist((items) =>
                items.map((x) =>
                  x.id === item.id ? { ...x, label: e.target.value } : x,
                ),
              )
            }
            aria-label={`編輯清單項目：${item.label}`}
            onBlur={() =>
              setChecklist((items) => items.filter((x) => x.label.trim()))
            }
          />
          <button
            className="icon-button"
            aria-label={`刪除${item.label}`}
            onClick={() => {
              setChecklist((items) => items.filter((x) => x.id !== item.id));
              notify("已移除清單項目");
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <form
        className="add-item"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="還有什麼想帶的？"
          aria-label="新增旅前清單項目"
          maxLength={80}
        />
        <button
          className="icon-button"
          type="submit"
          aria-label="加入清單"
          disabled={!newItem.trim()}
        >
          <Plus size={21} />
        </button>
      </form>
      <p className="tiny">可直接編輯項目名稱。勾選不代表網站已核驗票證。</p>
    </section>
  );
}
function TripPage() {
  const localTime = (v: string) => v.slice(11, 16);
  const airportNames: Record<string, string> = {
    TPE: "台灣桃園",
    NGO: "名古屋中部",
  };
  return (
    <>
      <PageTitle
        eyebrow="ALL THE LITTLE DETAILS"
        title="安心出發的小事"
        subtitle="航班、住宿與行李，重要的事都放在一起。"
      />
      <SectionTitle>飛往喜歡的日子</SectionTitle>
      <div className="flights">
        {trip.flights.map((f, i) => (
          <section key={f.id} className="flight-card">
            <div className="flight-top">
              <span className="pill">
                {i === 0 ? "去程" : "回程"} · {formatDate(f.date)}
              </span>
              <span>
                {f.airline} · {f.flightNo}
              </span>
            </div>
            <div className="flight-route">
              <div>
                <span>{f.from}</span>
                <strong>{localTime(f.departureLocal)}</strong>
                <p>{airportNames[f.from]}</p>
                <small>{f.from === "TPE" ? "台灣時間" : "日本時間"}</small>
              </div>
              <div className="flight-line">
                <Plane size={22} />
                <span />
                直飛
              </div>
              <div>
                <span>{f.to}</span>
                <strong>{localTime(f.arrivalLocal)}</strong>
                <p>{airportNames[f.to]}</p>
                <small>{f.to === "TPE" ? "台灣時間" : "日本時間"}</small>
              </div>
            </div>
            <p className="flight-foot">航班表定參考 · 未串接即時航班動態</p>
          </section>
        ))}
      </div>
      <Notice icon={Plane} className="warm">
        <strong>11/06 13:00 是抵達機場</strong>
        <br />
        回程 CX531 於 16:40 日本時間起飛，兩者為不同事件。
      </Notice>
      <HotelInfo />
      <Checklist />
      <Link className="resource-entry" to="/resources">
        <span>
          <BookOpen size={23} />
        </span>
        <div>
          <strong>旅行參考小書籤</strong>
          <p>入境教學、交通、景點與影片</p>
        </div>
        <ChevronRight size={20} />
      </Link>
      <section className="privacy-note">
        <ShieldCheck size={20} />
        <div>
          <strong>只留回憶，不收集個資</strong>
          <p>
            不需登入；收藏、完成紀錄與筆記只保存在這個瀏覽器，不會同步到其他人的裝置。請勿在筆記輸入護照、票券
            QR、信用卡或訂房代碼。
          </p>
        </div>
      </section>
      <InstallGuide />
    </>
  );
}
function PlacePage() {
  const { id } = useParams();
  const place = findPlace(id || null);
  const { notes, setNotes, progress, toggleProgress } = useApp();
  if (!place)
    return (
      <Empty
        title="這個地方還沒收進手帳"
        text="請回到行程，找找下一個想去的地方。"
        to="/itinerary"
        label="回到行程"
      />
    );
  const days = placeDay(place.id);
  const references = placeReferences(place.id);
  const events = trip.days.flatMap((d) =>
    d.events.filter((e) => e.placeId === place.id),
  );
  const visited = progress.includes(`visited:${place.id}`);
  return (
    <>
      <Back />
      <section className="place-detail">
        <div className={`detail-art ${place.category}`}>
          <Landscape small />
          <span className="art-caption">A PLACE TO REMEMBER</span>
        </div>
        <div className="detail-heading">
          <span className="eyebrow">{categoryLabels[place.category]}</span>
          <Favorite id={place.id} label={place.name} />
        </div>
        <h1>{place.name}</h1>
        <div className="detail-dates">
          {days.map((d) => (
            <Link key={d.date} className="pill" to={`/itinerary/${d.date}`}>
              {formatDate(d.date)} · DAY {trip.days.indexOf(d) + 1}
            </Link>
          ))}
        </div>
        {events
          .filter((e) => e.time)
          .map((e) => (
            <p className="detail-time" key={e.id}>
              <Clock3 size={17} />
              <strong>{eventTime(e)}</strong>
              <span>{timeLabels[e.timeStatus]}</span>
            </p>
          ))}
        {place.id === "ghibli-grand-warehouse" && (
          <Notice icon={Ticket} className="warm">
            11/02 10:00
            指定入場時刻已確認；票券持有狀態未確認，請出發前另行核對。
          </Notice>
        )}
        {place.category === "food" && (
          <Notice>訂位未確認；店家地址與營業時間仍需核對。</Notice>
        )}
        {place.address ? (
          <p className="address">{place.address}</p>
        ) : (
          <p className="detail-description">
            詳細地址尚未確認。下方提供地圖搜尋，請核對搜尋結果後再前往；此處不提供即時距離或交通時間。
          </p>
        )}
        <div className="button-stack">
          <External className="button primary" href={mapsUrl(place)}>
            <MapPin size={18} />
            {place.mapsUrl ? "開啟 Google Maps" : "地圖搜尋此地點"}
          </External>
          {place.address && <CopyButton value={place.address} />}
          <External className="button secondary" href={place.websiteUrl}>
            <ExternalLink size={16} />
            查看官方網站
          </External>
          <button
            className={`button secondary ${visited ? "done-button" : ""}`}
            aria-pressed={visited}
            onClick={() => toggleProgress(`visited:${place.id}`)}
          >
            <CircleCheck size={18} />
            {visited ? "已記錄走訪" : "記錄已走訪"}
          </button>
        </div>
      </section>
      {!!references.length && (
        <section className="card detail-references">
          <h2>出發前，看看這些</h2>
          {references.map((r, i) => (
            <External key={r} className="resource-link" href={r}>
              <BookOpen size={18} />
              <span>
                參考資料 {i + 1}
                <small>{new URL(r).hostname}</small>
              </span>
            </External>
          ))}
          <p className="tiny">若參考連結無法開啟，請搜尋名稱或改看官方網站。</p>
        </section>
      )}
      <section className="card notes">
        <label htmlFor="place-note">
          <NotebookPen size={19} />
          <strong>留一點給自己的筆記</strong>
        </label>
        <textarea
          id="place-note"
          rows={4}
          maxLength={2000}
          placeholder="想帶的東西、想吃的料理、路上的小發現…"
          value={notes[place.id] || ""}
          onChange={(e) =>
            setNotes((v) => ({ ...v, [place.id]: e.target.value }))
          }
        />
        <p className="tiny">
          自動保存在此瀏覽器 · 不與其他人同步 · 請勿填入敏感個資
        </p>
      </section>
    </>
  );
}
function Resources() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const resources = trip.resources.filter(
    (r) => (kind === "all" || r.kind === kind) && r.title.includes(query),
  );
  return (
    <>
      <Back fallback="/trip" />
      <PageTitle
        eyebrow="A FEW USEFUL BOOKMARKS"
        title="旅行參考小書籤"
        subtitle="出發前多看一眼，路上就多一點從容。"
      />
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="搜尋參考資料"
      />
      <div className="filter-row">
        {[
          ["all", "全部"],
          ["official", "官方"],
          ["video", "影片"],
          ["article", "文章"],
        ].map(([id, label]) => (
          <button
            className={`filter ${kind === id ? "selected" : ""}`}
            key={id}
            onClick={() => setKind(id)}
            aria-pressed={kind === id}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="resource-list card">
        {resources.map((r) => (
          <External className="resource-link" key={r.id} href={r.url}>
            <span className="resource-symbol">
              {r.kind === "video" ? (
                <Plane size={20} />
              ) : (
                <BookOpen size={20} />
              )}
            </span>
            <span>
              {r.title}
              <small>
                {r.kind === "official"
                  ? "官方網站"
                  : r.kind === "video"
                    ? "影片參考"
                    : "文章參考"}{" "}
                · {new URL(r.url).hostname}
              </small>
            </span>
          </External>
        ))}
      </div>
      {!resources.length && (
        <Empty
          inline
          title="沒有找到這份資料"
          text="換一個關鍵字或類別試試。"
        />
      )}
      <Notice>
        外部資料可能更新或失效；無法開啟時，可依標題搜尋或查閱官方網站。網站不會產生或保存官方入境
        QR Code，地圖與影片需網路。
      </Notice>
    </>
  );
}
function Favorites() {
  const { favorites } = useApp();
  const places = trip.places.filter((p) => favorites.includes(p.id));
  const foods = trip.foodCandidates.filter((p) => favorites.includes(p.id));
  return (
    <>
      <Back fallback="/" />
      <PageTitle
        eyebrow="THE LITTLE THINGS YOU LOVE"
        title="把喜歡的，好好收藏"
        subtitle="心動的風景和滋味，下次就不會忘記。"
      />
      {places.length + foods.length > 0 ? (
        <>
          <p className="results-label">
            {places.length + foods.length} 個口袋收藏
            <span>只保存在此瀏覽器</span>
          </p>
          <div className="card-list">
            {places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </div>
          <div className="food-grid">
            {foods.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
        </>
      ) : (
        <Empty
          inline
          title="收藏，從一個小心動開始"
          text="在行程、地點或美食旁點愛心，把喜歡的地方放進口袋。"
          to="/itinerary"
          label="看看六日行程"
        />
      )}
    </>
  );
}
function Empty({
  title,
  text,
  to,
  label,
  inline = false,
}: {
  title: string;
  text: string;
  to?: string;
  label?: string;
  inline?: boolean;
}) {
  return (
    <section className={`empty-state ${inline ? "inline" : ""}`}>
      <span>
        <Compass size={31} />
      </span>
      <h1>{title}</h1>
      <p>{text}</p>
      {to && (
        <Link to={to} className="button secondary">
          {label}
          <ArrowRight size={17} />
        </Link>
      )}
    </section>
  );
}
function InstallGuide() {
  return (
    <details className="install-guide">
      <summary>
        <Smartphone size={19} />
        把旅行手帳放進手機主畫面
        <ChevronRight size={16} />
      </summary>
      <div>
        <p>
          <strong>iPhone / iPad：</strong>使用 Safari
          開啟網址，點「分享」→「加入主畫面」。
        </p>
        <p>
          <strong>Android：</strong>使用 Chrome
          開啟，點選選單的「安裝應用程式」或「新增至主畫面」（依瀏覽器顯示）。
        </p>
        <p>
          首次連網載入並完成快取後，行程與飯店地址可離線閱讀；地圖、影片與外部網站仍需網路。
        </p>
      </div>
    </details>
  );
}
function ShareButton() {
  const { notify } = useApp();
  const [show, setShow] = useState(false);
  const url = window.location.origin + import.meta.env.BASE_URL;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (show) dialog.current?.showModal();
    else dialog.current?.close();
  }, [show]);
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: trip.metadata.tripName,
          text: "把喜歡的風景收進口袋，一起去名古屋。",
          url,
        });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("已複製分享網址，知道網址就能使用");
    } catch {
      setShow(true);
    }
  }
  return (
    <>
      <button className="icon-button" onClick={share} aria-label="分享網站">
        <Share2 size={19} />
      </button>
      <dialog
        ref={dialog}
        onClose={() => setShow(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setShow(false);
        }}
      >
        <div className="dialog-title">
          <h2>一起去名古屋</h2>
          <button
            className="icon-button"
            onClick={() => setShow(false)}
            aria-label="關閉分享視窗"
          >
            <X size={20} />
          </button>
        </div>
        <p>長按或選取網址複製，分享給同行的人。</p>
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="網站分享網址"
        />
        <p className="tiny">
          不需登入；每人的收藏與完成紀錄各自保存在自己的瀏覽器。
        </p>
      </dialog>
    </>
  );
}
function Shell() {
  const [online, setOnline] = useState(navigator.onLine);
  const { storageAvailable, notify } = useApp();
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => notify("離線快取未完成，請保持連線並重新整理後再試"),
  });
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const location = useLocation();
  useEffect(() => {
    const prefix = location.pathname.startsWith("/place/")
      ? findPlace(location.pathname.split("/")[2])?.name
      : (
          {
            "/": "六天五夜的小旅行",
            "/map": "口袋地圖",
            "/food": "美食清單",
            "/trip": "旅程資訊",
            "/resources": "參考資料",
            "/favorites": "我的收藏",
          } as Record<string, string>
        )[location.pathname] || "六日行程";
    document.title = `${prefix || "旅行手帳"} · 名古屋慢旅手帳`;
  }, [location.pathname]);
  return (
    <>
      <ScrollMemory />
      <a className="skip-link" href="#main">
        跳到主要內容
      </a>
      <div className="desktop-note">
        <Mountain size={25} />
        <span>
          NAGOYA
          <br />
          <small>AUTUMN JOURNAL, 2026</small>
        </span>
        <p>
          走慢一點，
          <br />
          讓風景多留一會兒。
        </p>
      </div>
      <div className="app-shell">
        <header className="site-header">
          <Link to="/" className="brand">
            <span>
              <Mountain size={22} />
            </span>
            <div>
              名古屋慢旅手帳<small>NAGOYA SLOW DAYS</small>
            </div>
          </Link>
          <div className="header-actions">
            <span className="header-month">NOV, 2026</span>
            <ShareButton />
          </div>
        </header>
        {!online && (
          <div className="connection-banner" role="status">
            <WifiOff size={16} />
            離線中；已快取行程可讀，地圖／影片需網路
          </div>
        )}
        {!storageAvailable && (
          <div className="connection-banner" role="alert">
            本機儲存不可用；本次操作可能無法在重整後保留。
          </div>
        )}
        {needRefresh && (
          <div className="update-banner" role="status">
            有更新的旅行手帳
            <button onClick={() => updateServiceWorker(true)}>立即更新</button>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/itinerary"
              element={
                <Navigate to={`/itinerary/${journey().day.date}`} replace />
              }
            />
            <Route path="/itinerary/:date" element={<Itinerary />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/food" element={<FoodPage />} />
            <Route path="/trip" element={<TripPage />} />
            <Route path="/place/:id" element={<PlacePage />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route
              path="*"
              element={
                <Empty
                  title="這條小路，還沒畫進地圖"
                  text="找不到這個頁面，我們回到熟悉的旅程吧。"
                  to="/"
                  label="回到手帳首頁"
                />
              }
            />
          </Routes>
        </main>
        <footer className="page-footer">
          <Mountain size={15} />
          <span>名古屋慢旅手帳 · 2026 秋</span>
          <small>
            {offlineReady
              ? "已完成離線快取 · 外部連結需網路"
              : "小小的手帳，裝滿大大的期待"}
          </small>
        </footer>
        <nav className="bottom-tabs" aria-label="主要導覽">
          {[
            { to: "/", icon: House, title: "首頁" },
            { to: "/itinerary", icon: CalendarDays, title: "行程" },
            { to: "/map", icon: MapPin, title: "地圖" },
            { to: "/food", icon: Utensils, title: "美食" },
            { to: "/trip", icon: Luggage, title: "旅程" },
          ].map(({ to, icon: Icon, title }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => (isActive ? "tab active" : "tab")}
            >
              <span>
                <Icon size={21} />
              </span>
              <strong>{title}</strong>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Provider>
      <Shell />
    </Provider>
  </BrowserRouter>,
);
