import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";
import { fixture } from "./fixtures.mjs";

const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch({
  executablePath, headless: true,
  args: ["--disable-gpu", "--disable-frame-rate-limit"]
});
const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8086/";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const actual = JSON.parse(await readFile(new URL("../data/announcements.json", import.meta.url), "utf8"));
const blog = JSON.parse(await readFile(new URL("../data/blog.json", import.meta.url), "utf8"));
const errors = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(30_000);
  context.setDefaultNavigationTimeout(30_000);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseUrl);
  assert.equal(await page.locator(".announcement").count(), actual.announcements.length);
  const announcementLinks = await page.locator(".announcement").evaluateAll(cards => cards.map(card => {
    const title = card.querySelector("h3 a"), announcement = card.querySelector(":scope > a");
    return {
      title: title?.getAttribute("href"), announcement: announcement?.getAttribute("href"),
      label: announcement?.textContent, target: announcement?.target, rel: announcement?.rel,
      visible: Boolean(announcement?.getClientRects().length)
    };
  }));
  assert.deepEqual(announcementLinks, actual.announcements.map(item => ({
    title: item.sources[0].url, announcement: item.sources[0].url,
    label: "Read announcement (opens in new tab)", target: "_blank", rel: "noopener noreferrer", visible: true
  })));
  const firstAnnouncementUrl = actual.announcements[0].sources[0].url;
  // Verify the popup destination without depending on the external publisher's load time.
  await context.route(firstAnnouncementUrl.split("#")[0], route =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Announcement destination</title>" }));
  const [announcementPage] = await Promise.all([
    context.waitForEvent("page"),
    page.locator(".announcement > a").first().click()
  ]);
  await announcementPage.waitForURL(url => url.hash === new URL(actual.announcements[0].sources[0].url).hash);
  await announcementPage.close();
  await context.unroute(firstAnnouncementUrl.split("#")[0]);
  console.log("PASS all 59 tiles have visible exact announcement links and open details in a new tab");
  assert.match(await page.locator("#source-notice").innerText(), /59\/59 numbered/);
  assert.equal(await page.locator("#keynote").isVisible(), true);
  assert.equal(await page.locator("#blog-source a").getAttribute("href"), blog.url);
  assert.deepEqual(await page.locator("#blog-links li a").evaluateAll(links => links.map(link => ({
    url: link.href, target: link.target, rel: link.rel
  }))), blog.links.map(link => ({ url: link.url, target: "_blank", rel: "noopener noreferrer" })));
  assert.equal(await page.locator("#blog-topics .blog-topic").count(), blog.topics.length);
  const mappedSections = new Set(blog.topics.flatMap(topic => topic.sections));
  assert.deepEqual(await page.locator(".announcement").evaluateAll((cards, url) =>
    cards.filter(card => [...card.querySelectorAll("details a")].some(link => link.href === url)).map(card => card.id), blog.url),
  actual.announcements.filter(item => mappedSections.has(item.section)).map(item => item.id));
  const blogTopic = page.locator("#blog-topics .blog-topic").first();
  await blogTopic.locator("summary").click();
  assert.match(await blogTopic.locator(".relevance").innerText(), /Farmers Insurance/);
  assert.deepEqual(await blogTopic.locator("details ul a").evaluateAll(links => links.map(link => link.href)),
    blog.topics[0].sections.map(section => actual.announcements.find(item => item.section === section).sources[0].url));
  await blogTopic.locator("summary").click();
  assert.match(await page.locator("#blog-topics").innerText(), /private preview/);
  assert.match(await page.locator("#blog-links").innerText(), /2026-10-27/);
  console.log("PASS six keynote topics, all five direct links, dated background and mapped announcement/export sources");
  assert.equal(await page.locator("#select-shown").isDisabled(), false);
  assert.equal(await page.locator("#stories .story").count(), actual.stories.length);
  assert.deepEqual(await page.locator("#technology-stories .story").evaluateAll(cards => cards.map(card => ({
    name: card.querySelector("h3").textContent, count: card.querySelector(".count").textContent
  }))), actual.themes.map(theme => ({
    name: theme.name,
    count: `${String(actual.announcements.filter(item => item.themes.includes(theme.id)).length).padStart(2, "0")} ANNOUNCEMENTS`
  })));
  await page.locator("#insurance-stories > summary").click();
  assert.equal(await page.locator("#stories").isVisible(), false);
  assert.equal(await page.locator("#technology-stories").isVisible(), true);
  await page.locator("#technology-story-section > summary").click();
  assert.equal(await page.locator("#technology-stories").isVisible(), false);
  await page.locator("#insurance-stories > summary").click();
  assert.equal(await page.locator("#stories").isVisible(), true);
  assert.equal(await page.locator("#technology-stories").isVisible(), false);
  await page.locator("#technology-story-section > summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#technology-stories").isVisible(), true);
  for (const theme of actual.themes) {
    const story = page.locator("#technology-stories .story").filter({ has: page.getByRole("heading", { name: theme.name, exact: true }) });
    await story.getByRole("button", { name: "Browse theme", exact: true }).click();
    assert.deepEqual(await page.locator(".announcement").evaluateAll(cards => cards.map(card => card.id)),
      actual.announcements.filter(item => item.themes.includes(theme.id)).map(item => item.id));
    assert.equal(await page.locator(`button[data-theme="${theme.id}"]`).getAttribute("aria-pressed"), "true");
  }
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  console.log("PASS independent story-section collapse, keyboard expansion and exact browsing for every technology theme");
  await page.locator('button[data-theme="copilot"]').click();
  await page.locator("#query").fill("no-such-announcement");
  assert.equal(await page.locator(".announcement").count(), 0);
  await page.locator("#technology-stories .story").filter({ has: page.getByRole("heading", { name: "Copilot", exact: true }) })
    .getByRole("button", { name: "Select theme", exact: true }).click();
  const expected = new Set(actual.announcements.filter(item => item.themes.includes("copilot")).map(item => item.id));
  assert.equal(await page.locator("#selection-count").innerText(), `(${expected.size})`);
  await page.locator('button[data-theme="fabric"]').click();
  await page.locator("#technology-stories .story").filter({ has: page.getByRole("heading", { name: "Fabric", exact: true }) })
    .getByRole("button", { name: "Select theme", exact: true }).click();
  for (const item of actual.announcements.filter(item => item.themes.includes("fabric"))) expected.add(item.id);
  assert.equal(await page.locator("#selection-count").innerText(), `(${expected.size})`);
  assert.equal(await page.locator('button[data-theme="fabric"]').getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  const checked = await page.locator(".announcement input:checked").evaluateAll(inputs => inputs.map(input => input.id.slice("select-".length)));
  assert.deepEqual(checked.sort(), [...expected].sort());
  await page.locator("#clear").click();
  assert.equal(await page.locator('button[data-theme=""]').getAttribute("aria-pressed"), "true");
  await page.locator("#query").fill("FuzzyBM25");
  assert.equal(await page.locator(".announcement").count(), 1);
  await page.locator("#expand-all").click();
  assert.equal(await page.locator(".announcement details[open]").count(), 1);
  assert.match(await page.locator(".announcement").innerText(), /six named bullets/);
  await page.locator("#collapse-all").click();
  assert.equal(await page.locator(".announcement details[open]").count(), 0);
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.locator("#workload").selectOption("Security");
  assert.equal(await page.locator(".announcement").count(), actual.announcements.filter(item => item.workload === "Security").length);
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  console.log("PASS all 59 real entries, exact Copilot/Fabric bulk membership, detailed search, workload, expand/collapse and mobile layout");

  const synthetic = html.replace(/(<script type="application\/json" id="catalog-data">)[\s\S]*?(<\/script>)/,
    (_, open, close) => open + JSON.stringify(fixture()).replaceAll("<", "\\u003c") + close);
  await page.route(baseUrl, route => route.fulfill({ contentType: "text/html", body: synthetic }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  assert.equal(await page.locator(".announcement").count(), 3);
  await page.locator('button[data-theme="copilot"]').click();
  await page.locator("#query").fill("beta");
  assert.equal(await page.locator(".announcement").count(), 1);
  await page.locator("#select-theme").click();
  assert.equal(await page.locator("#selection-count").innerText(), "(2)");
  await page.locator('button[data-theme="fabric"]').click();
  await page.locator("#select-theme").click();
  assert.equal(await page.locator("#selection-count").innerText(), "(3)");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.locator("#clear").click();
  await page.locator("#undo").click();
  assert.equal(await page.locator("#selection-count").innerText(), "(3)");
  console.log("PASS filtered bulk-theme selection, overlapping groups, clear and undo");

  await page.locator("#clear").click();
  await page.locator("#story").selectOption("claims");
  await page.locator("#query").fill("beta");
  await page.locator("#select-story").click();
  assert.equal(await page.locator("#selection-count").innerText(), "(2)");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await page.locator("#selected-only").click();
  assert.equal(await page.locator(".announcement").count(), 2);
  await page.locator("#beta summary").click();
  await page.locator("#audience").selectOption("farmers");
  assert.equal(await page.locator("#beta details").getAttribute("open"), "");
  await page.locator("#audience").selectOption("both");
  await page.getByRole("textbox", { name: "Discussion notes: Synthetic test beta", exact: true }).fill("Private test note");
  await page.reload();
  assert.equal(await page.locator("#selection-count").innerText(), "(2)");
  await page.locator("#beta summary").click();
  assert.equal(await page.getByRole("textbox", { name: "Discussion notes: Synthetic test beta", exact: true }).inputValue(), "Private test note");
  await page.locator("#audience").selectOption("farmers");
  assert.ok(!(await page.locator(".announcement .relevance").first().innerText()).includes("Zurich"));
  await page.locator("#table-view").click();
  assert.equal(await page.locator("#table tbody tr").count(), 3);
  assert.match(await page.locator("#table").innerText(), /Private test note/);
  await page.locator("#selected-only").click();
  assert.equal(await page.locator("#table tbody tr").count(), 2);
  console.log("PASS story selection independent of search, persisted notes/selections, customer perspective and table");

  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export-csv").click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  assert.match(csv, /Private test note/);
  assert.match(csv, /Synthetic test alpha/);
  assert.ok(!csv.includes("Synthetic test gamma"));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#share").click();
  const share = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(!share.includes("Private"));
  assert.match(share, /selected=alpha%2Cbeta/);
  await page.unroute(baseUrl);
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(baseUrl).origin) return route.fulfill({ contentType: "text/html", body: synthetic });
    return route.continue();
  });
  await page.goto(share);
  await page.locator("#cards .announcement").first().waitFor();
  assert.equal(await page.locator(".announcement").count(), 2);
  assert.equal(await page.locator("#selected-only").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#selection-dock").isVisible(), true);
  await page.locator("#dock-selected").click();
  assert.equal(await page.locator(".announcement").count(), 3);
  await page.locator("#dock-selected").click();
  assert.equal(await page.locator(".announcement").count(), 2);
  console.log("PASS CSV download contents, ID-only share link and restored selected-only view");

  const openBeforePrint = await page.locator(".announcement details[open]").count();
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  assert.equal(await page.locator(".announcement details[open]").count(), 2);
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".toolbar").isVisible(), false);
  assert.equal(await page.locator(".print-note").filter({ hasText: "Private test note" }).isVisible(), true);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.equal(await page.locator(".announcement details[open]").count(), openBeforePrint);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.locator("#theme").click();
  const theme = await page.locator("html").getAttribute("data-theme");
  assert.ok(["dark", "light"].includes(theme));
  await page.locator("#present").click();
  assert.equal(await page.locator("#overview").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log("PASS print notes, populated mobile layout, theme/presenter controls and no browser errors");
} finally {
  await browser.close();
}
