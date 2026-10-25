import { writeFileSync } from "node:fs";
const base = process.env.SITE_BASE || "/";
if (!base.startsWith("/") || !base.endsWith("/"))
  throw new Error("SITE_BASE must begin and end with /");
writeFileSync(
  "dist/404.html",
  `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>返回旅程</title><script>
const base=${JSON.stringify(base)};
const route=location.pathname.slice(base.length-1)+location.search+location.hash;
location.replace(base+'?__route='+encodeURIComponent(route));
</script><p>正在開啟旅行手帳… <a href="${base}">回首頁</a></p></html>`,
);
writeFileSync("dist/_redirects", "/* /index.html 200\n");
writeFileSync("dist/.nojekyll", "");
