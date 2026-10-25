import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";

const photo = fileURLToPath(
  new URL("../src/assets/nagoya-people.png", import.meta.url),
);
const replacement = fileURLToPath(
  new URL("../public/icons/icon-192.png", import.meta.url),
);

async function openEditor(page: Page) {
  await page.goto("/favorites");
  await page.getByRole("button", { name: "新增照片", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "新增照片收藏" }),
  ).toBeVisible();
}
async function choosePhoto(page: Page, path = photo) {
  await page.getByLabel("選擇收藏照片", { exact: true }).setInputFiles(path);
  await expect(
    page.getByRole("button", { name: "儲存收藏", exact: true }),
  ).toBeEnabled();
}
async function addEntry(
  page: Page,
  caption = "在名古屋電視塔前，把今天的好心情收起來。",
) {
  await openEditor(page);
  await choosePhoto(page);
  await page.getByRole("textbox", { name: "這張照片的小故事" }).fill(caption);
  await page.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".journal-entry")).toHaveCount(1);
}

test("photo and caption persist in IndexedDB, update home count and stay private to this browser", async ({
  page,
  browser,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
  });
  await addEntry(page);
  await page.reload();
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "在名古屋電視塔前，把今天的好心情收起來。",
  );
  await expect(page.locator(".journal-entry img")).toBeVisible();
  await page.waitForFunction(
    () =>
      (document.querySelector(".journal-entry img") as HTMLImageElement)
        ?.naturalWidth === 1254,
  );
  await page.getByRole("button", { name: "返回首頁", exact: true }).click();
  await expect(page.locator('.quick-card[href="/favorites"]')).toContainText(
    "1 張照片與回憶",
  );
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("http://127.0.0.1:4173/favorites");
  await expect(otherPage.locator(".journal-empty")).toBeVisible();
  await expect(otherPage.locator(".journal-entry")).toHaveCount(0);
  await other.close();
  expect(writes).toEqual([]);
});

test("200-character limit handles Chinese, emoji and composition without cutting characters", async ({
  page,
}) => {
  await openEditor(page);
  await choosePhoto(page);
  const caption = page.getByRole("textbox", { name: "這張照片的小故事" });
  await caption.fill("旅".repeat(201));
  await expect(caption).toHaveValue("旅".repeat(200));
  await expect(page.getByText("200 / 200 字", { exact: true })).toBeVisible();
  await expect(
    page.getByText("最多 200 字，已保留前 200 字。", { exact: true }),
  ).toBeVisible();
  const emoji = "👨‍👩‍👧‍👦";
  await caption.fill(emoji.repeat(200) + "多");
  await expect(caption).toHaveValue(emoji.repeat(200));
  await caption.dispatchEvent("compositionstart");
  await caption.fill("景".repeat(201));
  await expect(
    page.getByRole("button", { name: "儲存收藏", exact: true }),
  ).toBeDisabled();
  await caption.dispatchEvent("compositionend", { data: "景" });
  await expect(caption).toHaveValue("景".repeat(200));
  await page.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await page.reload();
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "景".repeat(200),
  );
});

test("editing replaces the photo and text while deletion requires confirmation", async ({
  page,
}) => {
  await addEntry(page);
  await page.getByRole("button", { name: "編輯照片與敘述" }).click();
  await page
    .getByLabel("選擇收藏照片", { exact: true })
    .setInputFiles(replacement);
  await expect(page.locator(".photo-processing")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "這張照片的小故事" })
    .fill("更新後的照片，繼續收集旅途的小風景。");
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await page.reload();
  await expect(page.locator(".journal-entry")).toHaveCount(1);
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "更新後的照片，繼續收集旅途的小風景。",
  );
  await page.waitForFunction(
    () =>
      (document.querySelector(".journal-entry img") as HTMLImageElement)
        ?.naturalWidth === 192,
  );
  await page.getByRole("button", { name: "刪除照片", exact: true }).click();
  await page.getByRole("button", { name: "保留照片", exact: true }).click();
  await expect(page.locator(".journal-entry")).toHaveCount(1);
  await page.getByRole("button", { name: "刪除照片", exact: true }).click();
  await page.getByRole("button", { name: "確認刪除", exact: true }).click();
  await page.reload();
  await expect(page.locator(".journal-entry")).toHaveCount(0);
  await expect(page.locator(".journal-empty")).toBeVisible();
});

test("cancelling a draft does not create a saved photo", async ({ page }) => {
  await openEditor(page);
  await choosePhoto(page);
  await page
    .getByRole("textbox", { name: "這張照片的小故事" })
    .fill("還沒決定要存的小故事");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.reload();
  await expect(page.locator(".journal-empty")).toBeVisible();
  await expect(page.locator(".journal-entry")).toHaveCount(0);
});

test("invalid, oversized and undecodable images have clear errors and cannot be saved", async ({
  page,
}) => {
  await openEditor(page);
  const input = page.getByLabel("選擇收藏照片", { exact: true });
  await input.setInputFiles({
    name: "not-a-photo.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.locator(".photo-form-error")).toContainText(
    "請選擇 JPG、PNG、WebP",
  );
  await input.setInputFiles({
    name: "large.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(15 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".photo-form-error")).toContainText("15 MB");
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("broken PNG"),
  });
  await expect(page.locator(".photo-form-error")).toContainText(
    "無法讀取這張照片",
  );
  await expect(
    page.getByRole("button", { name: "儲存收藏", exact: true }),
  ).toBeDisabled();
});

test("large photos are resized for persistent storage", async ({ page }) => {
  await openEditor(page);
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1600;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = "#8DC9D9";
    drawing.fillRect(0, 0, 2400, 1600);
    drawing.fillStyle = "#334D56";
    drawing.fillRect(900, 500, 600, 600);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("選擇收藏照片", { exact: true })
    .setInputFiles({
      name: "large-camera-photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(encoded, "base64"),
    });
  await expect(
    page.getByRole("button", { name: "儲存收藏", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => {
    const image = document.querySelector(
      ".journal-entry img",
    ) as HTMLImageElement;
    return image?.naturalWidth === 1600 && image.naturalHeight === 1067;
  });
});

test("storage quota errors keep the draft and allow retry without false success", async ({
  page,
}) => {
  await openEditor(page);
  await choosePhoto(page);
  await page
    .getByRole("textbox", { name: "這張照片的小故事" })
    .fill("儲存失敗也不能弄丟這段文字。");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { restorePut: () => void }).restorePut = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await expect(page.locator(".photo-form-error")).toContainText(
    "裝置儲存空間不足",
  );
  await expect(
    page.getByRole("textbox", { name: "這張照片的小故事" }),
  ).toHaveValue("儲存失敗也不能弄丟這段文字。");
  await expect(
    page.getByRole("dialog", { name: "新增照片收藏" }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { restorePut: () => void }).restorePut(),
  );
  await page.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await expect(page.locator(".journal-entry")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "儲存失敗也不能弄丟這段文字。",
  );
});

test("blocked IndexedDB shows a recoverable error without breaking the itinerary", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new DOMException("disabled", "SecurityError");
      },
    });
  });
  await page.goto("/favorites");
  await expect(page.locator(".journal-error")).toContainText(
    "無法存取照片儲存空間",
  );
  await expect(
    page.getByRole("button", { name: "新增照片", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "行程", exact: true })
    .click();
  await expect(page.locator(".timeline-item")).toHaveCount(4);
});

test("saved photos and captions remain readable and editable offline", async ({
  page,
  context,
}) => {
  await addEntry(page, "離線也能翻看的回憶。");
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
  await page.reload();
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "離線也能翻看的回憶。",
  );
  await page.waitForFunction(
    () =>
      (document.querySelector(".journal-entry img") as HTMLImageElement)
        ?.naturalWidth === 1254,
  );
  await page.getByRole("button", { name: "編輯照片與敘述" }).click();
  await page
    .getByRole("textbox", { name: "這張照片的小故事" })
    .fill("離線寫下的新心情。");
  await page.getByRole("button", { name: "儲存變更", exact: true }).click();
  await page.reload();
  await expect(page.locator(".journal-entry figcaption")).toHaveText(
    "離線寫下的新心情。",
  );
  await context.setOffline(false);
});

test("two tabs share updates without overwriting other photo entries", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.goto("/favorites");
  await addEntry(page, "第一個分頁的照片。");
  await expect(other.locator(".journal-entry")).toHaveCount(1);
  await other.getByRole("button", { name: "新增照片", exact: true }).click();
  await choosePhoto(other);
  await other
    .getByRole("textbox", { name: "這張照片的小故事" })
    .fill("第二個分頁的照片。");
  await other.getByRole("button", { name: "儲存收藏", exact: true }).click();
  await expect(page.locator(".journal-entry")).toHaveCount(2);
  await expect(other.locator(".journal-entry")).toHaveCount(2);
});

test("photo forms and saved cards work at mobile widths and meet automated WCAG AA checks", async ({
  page,
}) => {
  await addEntry(page, "長文字測試，願每一個喜歡的瞬間都能留下來。".repeat(7));
  for (const width of [360, 390, 430, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.getByRole("button", { name: "編輯照片與敘述" }).click();
    const dialog = page.getByRole("dialog", { name: "編輯照片收藏" });
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBeTruthy();
    if (width === 360) {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.failureSummary),
        })),
      ).toEqual([]);
    }
    await page.getByRole("button", { name: "取消", exact: true }).click();
  }
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.failureSummary),
    })),
  ).toEqual([]);
});
