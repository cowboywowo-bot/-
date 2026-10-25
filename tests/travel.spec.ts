import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import seed from "../src/data/nagoya_trip_v1_2_seed.json" with { type: "json" };

test("Japan date controls Day 2 even while the device is still November 1", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-01T16:00:00Z") });
  await page.goto("/");
  await expect(page.locator(".journey-status")).toContainText("Day 2");
  await expect(page.locator(".journey-status")).toContainText("吉卜力公園");
  await expect(page.locator(".next-stop")).toContainText("10:00");
  await expect(page.locator(".next-stop")).toContainText("吉卜力大倉庫入場");
  await expect(page.locator(".next-stop")).toContainText(
    "是否持有有效票券尚未提供",
  );
});

test("pre-trip countdown and post-trip review are distinct", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-25T03:00:00Z") });
  await page.goto("/");
  await expect(page.locator(".journey-status")).toContainText("7");
  await expect(page.locator(".day-caption")).toContainText("11/01");
  await page.clock.setSystemTime(new Date("2026-11-07T03:00:00Z"));
  await page.reload();
  await expect(page.locator(".journey-status")).toContainText("旅程回顧");
});

test("all six days preserve the exact seed event order and timing", async ({
  page,
}) => {
  for (const day of seed.days) {
    await page.goto(`/itinerary/${day.date}`);
    await expect(page.locator("main .timeline-item")).toHaveCount(
      day.events.length,
    );
    expect(
      await page
        .locator("main .timeline-item")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-event"))),
    ).toEqual(day.events.map((e) => e.id));
    for (const event of day.events) {
      const card = page.locator(`[data-event="${event.id}"]`);
      await expect(card).toContainText(event.title);
      if (event.time) await expect(card).toContainText(event.time);
    }
  }
});

test("hotel arrival is estimated and airport arrival is separate from takeoff", async ({
  page,
}) => {
  await page.goto("/itinerary/2026-11-01");
  await expect(page.locator('[data-event="d1-hotel"]')).toContainText(
    "預估 18:00",
  );
  await page.goto("/itinerary/2026-11-06");
  await expect(page.locator('[data-event="d6-airport"]')).toContainText(
    "13:00",
  );
  await expect(page.locator('[data-event="d6-airport"]')).toContainText(
    "不是起飛時間",
  );
  await expect(page.locator('[data-event="d6-flight"]')).toContainText("16:40");
});

test("flights show airport-local times and hotel uses the provided URL and address", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/trip");
  const flights = page.locator(".flight-card");
  await expect(flights.nth(0)).toContainText("CX530");
  await expect(
    flights.nth(0).locator(".flight-route > div").first(),
  ).toContainText("TPE12:00台灣桃園台灣時間");
  await expect(
    flights.nth(0).locator(".flight-route > div").last(),
  ).toContainText("NGO15:35名古屋中部日本時間");
  await expect(flights.nth(1)).toContainText("CX531");
  await expect(
    flights.nth(1).locator(".flight-route > div").first(),
  ).toContainText("NGO16:40名古屋中部日本時間");
  await expect(
    flights.nth(1).locator(".flight-route > div").last(),
  ).toContainText("TPE19:10台灣桃園台灣時間");
  const hotel = seed.places.find((p) => p.id === seed.accommodation.placeId)!;
  await expect(page.locator(".hotel-card a.button.primary")).toHaveAttribute(
    "href",
    hotel.mapsUrl!,
  );
  await page.getByRole("button", { name: "複製地址", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已複製");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    hotel.address,
  );
});

test("clipboard denial offers selectable manual fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.goto("/trip");
  await page.getByRole("button", { name: "複製地址", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "手動複製文字" })).toHaveValue(
    seed.places[0].address!,
  );
  await expect(page.getByRole("status")).toContainText("複製失敗");
});

test("five tabs route correctly and details return to the selected day and scroll", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主要導覽" });
  for (const [label, path] of [
    ["行程", "/itinerary/"],
    ["地圖", "/map"],
    ["美食", "/food"],
    ["旅程", "/trip"],
    ["首頁", "/"],
  ]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(new URL(page.url()).pathname.startsWith(path)).toBeTruthy();
  }
  await nav.getByRole("link", { name: "行程", exact: true }).click();
  await page.getByRole("button", { name: "11 月 4 日 星期三" }).click();
  await page.locator('[data-event="d4-dinner"] a h3').scrollIntoViewIfNeeded();
  const previousScroll = await page.evaluate(() => scrollY);
  expect(previousScroll).toBeGreaterThan(200);
  await page.locator('[data-event="d4-dinner"] a h3').click();
  await expect(page).toHaveURL(/\/place\/kamimura-bbq$/);
  await page.getByRole("button", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/itinerary\/2026-11-04$/);
  await expect(
    page.getByRole("button", { name: "11 月 4 日 星期三" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - previousScroll),
  ).toBeLessThan(3);
});

test("favorites and event completion persist through reload and remain independent", async ({
  page,
}) => {
  await page.goto("/itinerary/2026-11-03");
  const card = page.locator('[data-event="d3-castle"]');
  await card.getByRole("button", { name: "收藏名古屋城", exact: true }).click();
  await card
    .getByRole("checkbox", { name: "完成名古屋城", exact: true })
    .check();
  await page.reload();
  await expect(
    card.getByRole("button", { name: "取消收藏名古屋城", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    card.getByRole("checkbox", { name: "完成名古屋城", exact: true }),
  ).toBeChecked();
  await page.goto("/favorites");
  await expect(page.locator(".place-card")).toContainText("名古屋城");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText("收藏，從一個小心動開始")).toBeVisible();
});

test("food wishlist and eaten status are separate, searchable and persistent", async ({
  page,
}) => {
  await page.goto("/food");
  await expect(page.locator(".place-card")).toHaveCount(5);
  await expect(page.locator(".place-card").first()).toContainText("訂位未確認");
  await page.getByRole("button", { name: "料理種類", exact: true }).click();
  await expect(page.locator(".food-card")).toHaveCount(
    seed.foodCandidates.length,
  );
  await page.getByRole("searchbox").fill("鰻魚");
  await expect(page.locator(".food-card")).toHaveCount(1);
  await page.getByRole("button", { name: "收藏鰻魚飯", exact: true }).click();
  await page.getByRole("checkbox", { name: "吃過鰻魚飯", exact: true }).check();
  await page.getByRole("searchbox").clear();
  await page.getByRole("button", { name: "想吃清單", exact: true }).click();
  await expect(page.locator(".food-card")).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "吃過鰻魚飯", exact: true }),
  ).toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: "想吃清單", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "吃過鰻魚飯", exact: true }),
  ).toBeChecked();
});

test("checklist can be added, edited, checked and deleted; notes persist", async ({
  page,
}) => {
  await page.goto("/trip");
  await page
    .getByRole("textbox", { name: "新增旅前清單項目" })
    .fill("行動電源");
  await page.getByRole("button", { name: "加入清單", exact: true }).click();
  await page
    .getByRole("textbox", { name: "編輯清單項目：行動電源", exact: true })
    .fill("充飽的行動電源");
  await page.getByRole("checkbox", { name: "已備妥充飽的行動電源" }).check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "已備妥充飽的行動電源" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "刪除充飽的行動電源" }).click();
  await expect(
    page.getByRole("checkbox", { name: "已備妥充飽的行動電源" }),
  ).toHaveCount(0);
  await page.goto("/place/nagoya-castle");
  await page
    .getByRole("textbox", { name: "留一點給自己的筆記" })
    .fill("帶相機，慢慢散步。");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "留一點給自己的筆記" }),
  ).toHaveValue("帶相機，慢慢散步。");
});

test("map filters and searches without inventing coordinates or addresses", async ({
  page,
}) => {
  await page.goto("/map");
  await expect(page.locator(".map-intro")).toContainText("沒有已驗證座標");
  await page.getByRole("button", { name: "11 月 2 日 星期一" }).click();
  await page.getByRole("button", { name: "餐廳", exact: true }).click();
  await expect(page.locator(".place-card")).toHaveCount(1);
  await expect(page.locator(".place-card")).toContainText("Misakiraj nonbe");
  await expect(page.locator(".place-card")).toContainText("詳細地址待確認");
  await expect(page.locator(".place-card a.text-link")).toHaveAttribute(
    "href",
    /https:\/\/www.google.com\/maps\/search\/\?api=1&query=/,
  );
  await page.getByRole("searchbox").fill("不存在");
  await expect(page.getByText("這裡還沒有符合的地方")).toBeVisible();
});

test("invalid dates, unknown places and unknown URLs have safe recovery", async ({
  page,
}) => {
  for (const [url, heading] of [
    ["/itinerary/2026-12-99", "這天不在旅行日期裡"],
    ["/place/not-a-place", "這個地方還沒收進手帳"],
    ["/unknown", "這條小路，還沒畫進地圖"],
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.locator(".empty-state a")).toBeVisible();
  }
});

test("corrupt browser state safely falls back and inaccessible storage is disclosed", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("nagoya-v1.2:favorites", "{broken-json");
    localStorage.setItem(
      "nagoya-v1.2:checklist",
      JSON.stringify([{ invalid: true }]),
    );
  });
  await page.goto("/trip");
  await expect(page.locator(".checklist-row")).toHaveCount(6);
  await page.goto("/favorites");
  await expect(page.getByText("收藏，從一個小心動開始")).toBeVisible();
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("disabled", "SecurityError");
      },
    });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("本機儲存不可用");
});

test("reference links and website sharing use safe, working controls", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/resources");
  await expect(page.locator(".resource-link")).toHaveCount(
    seed.resources.length,
  );
  const links = await page
    .locator('a[target="_blank"]')
    .evaluateAll((els) =>
      els.map((el) => ({
        href: (el as HTMLAnchorElement).href,
        rel: (el as HTMLAnchorElement).rel,
      })),
    );
  for (const link of links) {
    expect(link.href.startsWith("https://")).toBeTruthy();
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  }
  await page.getByRole("button", { name: "分享網站" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://127.0.0.1:4173/",
  );
});

test("cached app opens a deep route offline and keeps hotel address available", async ({
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
  await page.goto("/trip");
  await expect(page.locator(".connection-banner")).toContainText("離線中");
  await expect(page.locator(".hotel-card")).toContainText(
    seed.places[0].address!,
  );
  await expect(page.locator(".flight-card")).toHaveCount(2);
  await page.goto("/itinerary/2026-11-02");
  await expect(page.locator('[data-event="d2-warehouse"]')).toContainText(
    "10:00",
  );
  await context.setOffline(false);
});

for (const width of [360, 390, 430, 1024]) {
  test(`all main pages fit a ${width}px screen with usable bottom navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const url of [
      "/",
      "/itinerary/2026-11-02",
      "/map",
      "/food",
      "/trip",
      "/place/vessel-inn",
      "/resources",
      "/favorites",
    ]) {
      await page.goto(url);
      await expect(page.getByRole("navigation")).toBeVisible();
      const size = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      expect(size.content, url).toBeLessThanOrEqual(size.viewport);
      await expect(page.locator("body")).not.toContainText("已購票");
      await expect(page.locator("body")).not.toContainText("已預訂");
    }
    expect(errors).toEqual([]);
  });
}

test("keyboard focus and reduced motion work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "跳到主要內容" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect(
    await page
      .locator(".tab")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});

test("primary pages meet WCAG AA automated accessibility checks including contrast", async ({
  page,
}) => {
  for (const url of [
    "/",
    "/itinerary/2026-11-02",
    "/food",
    "/trip",
    "/map",
    "/place/ghibli-grand-warehouse",
    "/resources",
    "/favorites",
  ]) {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      url,
    ).toEqual([]);
  }
});

test("food categories and desktop layout keep readable contrast", async ({ page }) => {
  await page.goto('/food');
  await page.getByRole('button', { name: '料理種類', exact: true }).click();
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});
