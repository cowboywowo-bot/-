import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import sources from "../docs/coupon-sources.json" with { type: "json" };

const couponFile = (n: string) =>
  fileURLToPath(new URL(`../src/assets/coupons/${n}.jpg`, import.meta.url));
const firstCard = (page: Page) => page.locator('[data-coupon="coupon-01"]');
async function editFirst(page: Page) {
  await page.goto("/coupons");
  await firstCard(page)
    .getByRole("button", { name: "編輯名稱／換圖", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "編輯優惠券", exact: true }),
  ).toBeVisible();
}
async function save(page: Page) {
  await page.getByRole("button", { name: "儲存優惠券", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("homepage exposes a prominent first-screen coupon link and all 12 original images remain intact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/");
  const link = page.locator(".coupon-home-link");
  await expect(link).toHaveAttribute("href", "/coupons");
  await expect(link).toContainText("12 張券");
  const rectangle = await link.boundingBox();
  expect(rectangle && rectangle.y + rectangle.height).toBeLessThan(750);
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "優惠券，隨手就能用",
  );
  await expect(page.locator(".coupon-card")).toHaveCount(12);
  await expect(firstCard(page)).toContainText("EDION 愛電王");
  await expect(page.locator('[data-coupon="coupon-12"]')).toContainText(
    "大丸百貨／松坂屋",
  );
  for (const source of sources) {
    const data = readFileSync(couponFile(source.id));
    expect(createHash("sha256").update(data).digest("hex")).toBe(source.sha256);
  }
});

test("search, categories and same-store versions make the intended coupon easy to select", async ({
  page,
}) => {
  await page.goto("/coupons");
  await page.getByRole("button", { name: "藥妝", exact: true }).click();
  await expect(page.locator(".coupon-card")).toHaveCount(6);
  await page.getByRole("searchbox").fill("松本清");
  await expect(page.locator(".coupon-card")).toHaveCount(1);
  await page.getByRole("searchbox").clear();
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("searchbox").fill("biccamera");
  await expect(page.locator(".coupon-card")).toHaveCount(2);
  await expect(page.locator(".coupon-card").nth(0)).toContainText("2027/04 版");
  await expect(page.locator(".coupon-card").nth(1)).toContainText("2026/12 版");
  await page.getByRole("searchbox").fill("沒有這家店");
  await expect(
    page.getByText("沒有符合的優惠券", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "顯示全部優惠券", exact: true })
    .click();
  await expect(page.locator(".coupon-card")).toHaveCount(12);
});

test("the viewer displays original pixels, zooms without cropping, switches coupons and closes with Escape", async ({
  page,
}) => {
  await page.goto("/coupons");
  await firstCard(page)
    .getByRole("button", { name: "出示優惠券", exact: true })
    .click();
  await expect(page.locator("#coupon-viewer-title")).toHaveText("EDION 愛電王");
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".coupon-original-paper img",
    ) as HTMLImageElement;
    return img?.naturalWidth === 752 && img.naturalHeight === 1352;
  });
  await page.getByRole("button", { name: "放大優惠券", exact: true }).click();
  await expect(page.locator(".coupon-zoom-controls")).toContainText("150%");
  expect(
    await page
      .locator(".coupon-image-scroll")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBeTruthy();
  await page.getByRole("button", { name: "適合寬度", exact: true }).click();
  await expect(page.locator(".coupon-zoom-controls")).toContainText("100%");
  await expect(
    page.getByRole("link", { name: "下載優惠券原圖" }),
  ).toHaveAttribute("href", /coupon-01-.*\.jpg/);
  await page.getByRole("button", { name: "下一張", exact: true }).click();
  await expect(page.locator("#coupon-viewer-title")).toHaveText(
    "KoKuMiN 國民藥妝",
  );
  await page.getByRole("button", { name: "上一張", exact: true }).click();
  await expect(page.locator("#coupon-viewer-title")).toHaveText("EDION 愛電王");
  await expect(
    page.getByRole("button", { name: "上一張", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("name, category and expiry edits persist locally while other browsers retain the supplied defaults", async ({
  page,
  browser,
}) => {
  await editFirst(page);
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("我的 EDION 電器優惠券");
  await page.getByLabel("分類", { exact: true }).selectOption("其他");
  await page.getByLabel("券面有效期限（選填）").fill("2028-01-31");
  await save(page);
  await page.reload();
  await expect(firstCard(page)).toContainText("我的 EDION 電器優惠券");
  await expect(firstCard(page)).toContainText("2028/01/31");
  await expect(firstCard(page).locator(".pill")).toHaveText("其他");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("http://127.0.0.1:4173/coupons");
  await expect(firstCard(otherPage)).toContainText("EDION 愛電王");
  await expect(firstCard(otherPage)).not.toContainText("我的 EDION");
  await other.close();
});

test("replacement images keep their exact bytes and full resolution and clear the previous image's expiry", async ({
  page,
}) => {
  await editFirst(page);
  await page
    .getByLabel("選擇優惠券圖片", { exact: true })
    .setInputFiles(couponFile("coupon-04"));
  await expect(
    page.getByText("已更換圖片，請重新確認名稱與券面效期。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("券面有效期限（選填）")).toHaveValue("");
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("我的鶴羽新券");
  await save(page);
  await page.reload();
  await expect(firstCard(page)).toContainText("我的鶴羽新券");
  await expect(firstCard(page)).toContainText("效期請查看券面");
  await firstCard(page)
    .getByRole("button", { name: "出示優惠券", exact: true })
    .click();
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".coupon-original-paper img",
    ) as HTMLImageElement;
    return img?.naturalWidth === 2299 && img.naturalHeight === 4096;
  });
  const digest = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("nagoya-v1.2:coupons", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
    const entry = await new Promise<{ image: Blob }>((resolve, reject) => {
      const request = db
        .transaction("edits")
        .objectStore("edits")
        .get("coupon-01");
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      await entry.image.arrayBuffer(),
    );
    db.close();
    return Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  });
  expect(digest).toBe(
    sources.find((source) => source.id === "coupon-04")!.sha256,
  );
});

test("restoring an edited coupon recovers the original without deleting photo journal memories", async ({
  page,
}) => {
  await page.goto("/favorites");
  await page.getByRole("button", { name: "新增照片", exact: true }).click();
  await page
    .getByLabel("選擇收藏照片", { exact: true })
    .setInputFiles(couponFile("coupon-01"));
  await page
    .getByRole("textbox", { name: "這張照片的小故事" })
    .fill("照片手帳要繼續保留。");
  await page.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await expect(page.locator(".journal-entry")).toHaveCount(1);
  await editFirst(page);
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("改過名稱");
  await save(page);
  await firstCard(page)
    .getByRole("button", { name: "還原改過名稱原始優惠券", exact: true })
    .click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(firstCard(page)).toContainText("改過名稱");
  await firstCard(page)
    .getByRole("button", { name: "還原改過名稱原始優惠券", exact: true })
    .click();
  await page.getByRole("button", { name: "確認還原", exact: true }).click();
  await page.reload();
  await expect(firstCard(page)).toContainText("EDION 愛電王");
  await expect(firstCard(page)).toContainText("2027/12/31");
  await page.goto("/favorites");
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "照片手帳要繼續保留。",
  );
});

test("a custom coupon requires name and image, updates home count and can be removed", async ({
  page,
}) => {
  await page.goto("/coupons");
  await page.getByRole("button", { name: "新增優惠券", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "儲存優惠券", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("自選咖啡店優惠券");
  await expect(
    page.getByRole("button", { name: "儲存優惠券", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("選擇優惠券圖片", { exact: true })
    .setInputFiles(couponFile("coupon-02"));
  await save(page);
  await expect(page.locator(".coupon-card")).toHaveCount(13);
  await page.reload();
  await expect(page.locator(".coupon-card")).toHaveCount(13);
  await page.getByRole("button", { name: "返回首頁", exact: true }).click();
  await expect(page.locator(".coupon-home-link")).toContainText("13 張券");
  await page.locator(".coupon-home-link").click();
  const card = page
    .locator(".coupon-card")
    .filter({ hasText: "自選咖啡店優惠券" });
  await card
    .getByRole("button", { name: "刪除自選咖啡店優惠券", exact: true })
    .click();
  await page.getByRole("button", { name: "確認刪除", exact: true }).click();
  await page.reload();
  await expect(page.locator(".coupon-card")).toHaveCount(12);
});

test("invalid or oversized uploads have clear errors and cancellation never changes the defaults", async ({
  page,
}) => {
  await page.goto("/coupons");
  await page.getByRole("button", { name: "新增優惠券", exact: true }).click();
  const input = page.getByLabel("選擇優惠券圖片", { exact: true });
  await input.setInputFiles({
    name: "wrong.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a photo"),
  });
  await expect(page.locator(".coupon-form-error")).toContainText(
    "JPG、PNG 或 WebP",
  );
  await input.setInputFiles({
    name: "large.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(15 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".coupon-form-error")).toContainText("15 MB");
  await input.setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not a jpeg"),
  });
  await expect(page.locator(".coupon-form-error")).toContainText(
    "無法讀取這張圖片",
  );
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.reload();
  await expect(page.locator(".coupon-card")).toHaveCount(12);
});

test("quota failures keep the coupon edit open and retry only commits after storage succeeds", async ({
  page,
}) => {
  await editFirst(page);
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("不能遺失的名稱");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    (window as unknown as { restorePut: () => void }).restorePut = () => {
      IDBObjectStore.prototype.put = put;
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "儲存優惠券", exact: true }).click();
  await expect(page.locator(".coupon-form-error")).toContainText(
    "這次變更尚未儲存",
  );
  await expect(
    page.getByRole("textbox", { name: "優惠券名稱", exact: true }),
  ).toHaveValue("不能遺失的名稱");
  await page.evaluate(() =>
    (window as unknown as { restorePut: () => void }).restorePut(),
  );
  await save(page);
  await page.reload();
  await expect(firstCard(page)).toContainText("不能遺失的名稱");
});

test("blocked personal storage still allows all supplied coupons to be shown", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("disabled", "SecurityError");
      },
    });
  });
  await page.goto("/coupons");
  await expect(page.locator(".coupon-storage-error")).toContainText(
    "原始優惠券仍可查看",
  );
  await expect(page.locator(".coupon-card")).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: "新增優惠券", exact: true }),
  ).toBeDisabled();
  await firstCard(page)
    .getByRole("button", { name: "出示優惠券", exact: true })
    .click();
  await expect(page.locator("#coupon-viewer-title")).toHaveText("EDION 愛電王");
});

test("every original coupon and personal edits remain available offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.goto("/coupons");
  await firstCard(page)
    .getByRole("button", { name: "出示優惠券", exact: true })
    .click();
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index];
    await page.waitForFunction(({ width, height }) => {
      const img = document.querySelector(
        ".coupon-original-paper img",
      ) as HTMLImageElement;
      return (
        img?.complete &&
        img.naturalWidth === width &&
        img.naturalHeight === height
      );
    }, source);
    if (index < sources.length - 1)
      await page.getByRole("button", { name: "下一張", exact: true }).click();
  }
  await page.getByRole("button", { name: "關閉優惠券", exact: true }).click();
  await firstCard(page)
    .getByRole("button", { name: "編輯名稱／換圖", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("離線也能改名");
  await save(page);
  await page.reload();
  await expect(firstCard(page)).toContainText("離線也能改名");
  await context.setOffline(false);
});

test("coupon edits synchronize between tabs without changing unrelated defaults", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.goto("/coupons");
  await editFirst(page);
  await page
    .getByRole("textbox", { name: "優惠券名稱", exact: true })
    .fill("兩個分頁的新名稱");
  await save(page);
  await expect(firstCard(other)).toContainText("兩個分頁的新名稱");
  await expect(other.locator(".coupon-card")).toHaveCount(12);
  await expect(other.locator('[data-coupon="coupon-02"]')).toContainText(
    "KoKuMiN 國民藥妝",
  );
});

test("mobile list, fullscreen viewer and editor stay accessible and inside the viewport", async ({
  page,
}) => {
  for (const width of [360, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/coupons");
    await expect(page.locator(".coupon-card")).toHaveCount(12);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    if (width === 390) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.failureSummary),
        })),
      ).toEqual([]);
    }
    await firstCard(page)
      .getByRole("button", { name: "出示優惠券", exact: true })
      .click();
    const viewer = page.getByRole("dialog");
    const box = await viewer.boundingBox();
    expect(box?.height).toBe(844);
    expect(box?.width).toBe(width);
    if (width === 390) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.failureSummary),
        })),
      ).toEqual([]);
    }
    await page.keyboard.press("Escape");
    await firstCard(page)
      .getByRole("button", { name: "編輯名稱／換圖", exact: true })
      .click();
    expect(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBeTruthy();
    if (width === 390) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.failureSummary),
        })),
      ).toEqual([]);
    }
    await page.getByRole("button", { name: "取消", exact: true }).click();
  }
});
