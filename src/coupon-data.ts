export const COUPON_CATEGORIES = [
  "藥妝",
  "家電",
  "運動",
  "百貨",
  "其他",
] as const;
export type CouponCategory = (typeof COUPON_CATEGORIES)[number];
export interface SeedCoupon {
  id: string;
  name: string;
  category: CouponCategory;
  expiresOn: string | null;
  width: number;
  height: number;
  image: string;
}

const images = import.meta.glob<string>("./assets/coupons/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
});
const rows: [string, CouponCategory, string, number, number][] = [
  ["EDION 愛電王", "家電", "2027-12-31", 752, 1352],
  ["KoKuMiN 國民藥妝", "藥妝", "2026-12-31", 1024, 1536],
  ["SUGI 杉藥局｜購物優惠券", "藥妝", "2027-02-28", 751, 1186],
  ["鶴羽藥妝 TSURUHA", "藥妝", "2027-12-31", 2299, 4096],
  ["松本清 Matsumoto Kiyoshi", "藥妝", "2027-03-31", 2918, 4096],
  ["ココカラファイン Cocokara Fine", "藥妝", "2027-03-31", 1181, 1654],
  ["BicCamera／KOJIMA｜2027/04 版", "家電", "2027-04-30", 1837, 2578],
  ["BicCamera／KOJIMA｜2026/12 版", "家電", "2026-12-31", 1080, 1528],
  ["YAMADA 山田電機", "家電", "2027-03-31", 1112, 1687],
  ["SUGI 杉藥局｜專屬優惠券", "藥妝", "2027-02-28", 1080, 1440],
  ["Alpen Group 運動用品", "運動", "2027-06-30", 1080, 3440],
  ["大丸百貨／松坂屋", "百貨", "2027-08-31", 1080, 1783],
];

export const seedCoupons: SeedCoupon[] = rows.map(
  ([name, category, expiresOn, width, height], index) => {
    const id = `coupon-${String(index + 1).padStart(2, "0")}`;
    const image = images[`./assets/coupons/${id}.jpg`];
    if (!image) throw new Error(`Missing original coupon image: ${id}`);
    return { id, name, category, expiresOn, width, height, image };
  },
);
