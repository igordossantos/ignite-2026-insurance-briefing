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
  const context = await browser.newContext({ reducedMotion: "reduce", colorScheme: "dark", viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(30_000);
  context.setDefaultNavigationTimeout(30_000);
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(baseUrl);
  assert.equal(await page.locator(".announcement").count(), actual.announcements.length);
  assert.doesNotMatch(await page.content(), /\b(?:farmers|zurich)\b/i);
  assert.equal(await page.locator("img").count(), 0);
  assert.equal(await page.locator("#theme").inputValue(), "pink");
  assert.deepEqual(await page.locator("#theme option").allTextContents(), ["Pink theme", "Blue theme"]);
  assert.deepEqual(await page.locator("#audience option").allTextContents(), ["Both perspectives", "Claims & service", "Risk & governance"]);
  for (const paletteName of ["pink", "blue"]) {
    await page.locator("#theme").selectOption(paletteName);
    assert.equal(await page.locator("html").getAttribute("data-palette"), paletteName);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    const palette = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const color = key => style.getPropertyValue(`--cp-${key}`).trim();
      const luminance = hex => {
        const values = hex.slice(1).match(/../g).map(value => {
          const channel = parseInt(value, 16) / 255;
          return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
        });
        return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
      };
      return {
        accent: color("accent"), background: color("bg"),
        contrasts: [["text", "bg"], ["text-muted", "bg"], ["accent", "surface"], ["link", "surface"], ["accent-fg", "accent"]].map(pair => {
          const values = pair.map(key => luminance(color(key))).sort((a, b) => b - a);
          return (values[0] + .05) / (values[1] + .05);
        })
      };
    });
    assert.equal(palette.accent, paletteName === "pink" ? "#9d245b" : "#005ca9");
    assert.equal(palette.background, paletteName === "pink" ? "#fcebf4" : "#ffffff");
    assert.ok(palette.contrasts.every(ratio => ratio >= 4.5), `${paletteName} text contrast must meet WCAG AA`);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(baseUrl);
  assert.equal(await page.locator("#theme").inputValue(), "blue");
  assert.equal(await page.locator(".announcement").count(), actual.announcements.length);
  console.log("PASS no company names or artwork, neutral palettes/perspectives, AA text contrast, mobile layout and remembered palette");
  assert.deepEqual(await page.locator("main > section").evaluateAll(sections => sections.map(section => section.id)),
    ["top", "keynote", "overview", "matters", "catalog", "sources"]);
  const disclosures = page.locator(".section-disclosure, details.story-section");
  const expectedSections = [
    ["top", true], ["keynote", true], ["overview", false], ["matters", true],
    ["insurance-stories", false], ["technology-story-section", false],
    ["catalog", true], ["discussion", true], ["sources", true]
  ];
  assert.deepEqual(await disclosures.evaluateAll(elements => elements.map(disclosure => ({
    id: disclosure.id || disclosure.closest("section").id,
    open: disclosure.open,
    href: disclosure.querySelector(":scope > summary .section-link").getAttribute("href")
  }))), expectedSections.map(([id, open]) => ({ id, open, href: `#${id}` })));
  for (const [index, [, open]] of expectedSections.entries()) {
    const summary = disclosures.nth(index).locator(":scope > summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.equal(await disclosures.nth(index).getAttribute("open"), open ? null : "");
    await page.keyboard.press("Space");
    assert.equal(await disclosures.nth(index).getAttribute("open"), open ? "" : null);
  }
  for (const [index, [id]] of expectedSections.entries()) {
    await page.goto(new URL(`?theme=blue#${id}`, baseUrl).href);
    assert.equal(await disclosures.nth(index).getAttribute("open"), "");
    assert.equal(await page.locator(`.section-link[href="#${id}"]`).isVisible(), true);
    assert.equal(await page.locator("#theme").inputValue(), "blue");
  }
  await page.locator("#sources > details > summary").click();
  await page.locator('.section-link[href="#sources"]').click();
  assert.equal(await page.locator("#sources > details").getAttribute("open"), "", "A permalink must reopen its target even when the fragment has not changed");
  await page.goto(baseUrl);
  await page.locator("#matters > details > summary").click();
  await page.evaluate(() => { location.hash = "technology-story-section"; });
  await page.locator("#technology-stories").waitFor({ state: "visible" });
  assert.equal(await page.locator("#matters > details").getAttribute("open"), "");
  assert.equal(await page.locator("#insurance-stories").getAttribute("open"), null);
  await page.goto(baseUrl);
  const catalogDisclosure = page.locator("#catalog > .wrap > details.section-disclosure");
  console.log("PASS requested section order, collapsed defaults, keyboard toggles, all nine direct links and reopening collapsed ancestors");
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
  assert.match(await blogTopic.locator(".relevance").innerText(), /Claims & service/);
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
  assert.equal(await page.locator("#stories").isVisible(), true);
  assert.equal(await page.locator("#technology-stories").isVisible(), false);
  await page.locator("#technology-story-section > summary").click();
  assert.equal(await page.locator("#technology-stories").isVisible(), true);
  await page.locator("#insurance-stories > summary").click();
  assert.equal(await page.locator("#stories").isVisible(), false);
  assert.equal(await page.locator("#technology-stories").isVisible(), true);
  await page.locator("#technology-story-section > summary").click();
  assert.equal(await page.locator("#technology-stories").isVisible(), false);
  await page.locator("#technology-story-section > summary").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#technology-stories").isVisible(), true);
  await catalogDisclosure.locator(":scope > summary").click();
  assert.equal(await catalogDisclosure.getAttribute("open"), null);
  for (const theme of actual.themes) {
    const story = page.locator("#technology-stories .story").filter({ has: page.getByRole("heading", { name: theme.name, exact: true }) });
    await story.getByRole("button", { name: "Browse theme", exact: true }).click();
    assert.equal(await catalogDisclosure.getAttribute("open"), "");
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

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const linkedUrl = new URL(baseUrl);
  linkedUrl.search = "?theme=pink&topic=copilot&tracking=not-shared";
  linkedUrl.hash = "catalog";
  await page.goto(linkedUrl.href);
  assert.equal(await page.locator("#theme").inputValue(), "pink", "URL palette must override saved blue");
  assert.equal(await page.locator("#selection-count").innerText(), "(0)");
  assert.equal(await page.locator("#share-theme").isEnabled(), true);
  assert.deepEqual(await page.locator(".announcement").evaluateAll(cards => cards.map(card => card.id)),
    actual.announcements.filter(item => item.themes.includes("copilot")).map(item => item.id));
  await page.locator("#share-theme").click();
  const themeShare = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  assert.equal(themeShare.search, "?theme=pink&topic=copilot");
  assert.equal(themeShare.hash, "#catalog");
  const recipientContext = await browser.newContext({ reducedMotion: "reduce" });
  recipientContext.setDefaultTimeout(30_000);
  const recipient = await recipientContext.newPage();
  recipient.on("pageerror", error => errors.push(error.message));
  try {
    await recipient.goto(themeShare.href);
    assert.equal(await recipient.locator("#theme").inputValue(), "pink");
    assert.equal(await recipient.locator("#selected-only").getAttribute("aria-pressed"), "false");
    assert.equal(await recipient.locator("#selection-count").innerText(), "(0)");
    assert.deepEqual(await recipient.locator(".announcement").evaluateAll(cards => cards.map(card => card.id)),
      actual.announcements.filter(item => item.themes.includes("copilot")).map(item => item.id));
    await recipient.locator('nav a[href="#sources"]').click();
    await recipient.locator("#theme").selectOption("blue");
    await recipient.locator('button[data-theme="fabric"]').click();
    assert.equal(new URL(recipient.url()).search, "?theme=blue&topic=fabric");
    assert.equal(new URL(recipient.url()).hash, "#sources");
    await recipient.goBack();
    assert.equal(await recipient.locator("#theme").inputValue(), "pink");
    assert.equal(await recipient.locator('button[data-theme="copilot"]').getAttribute("aria-pressed"), "true");
    await recipient.goForward();
    assert.equal(await recipient.locator("#theme").inputValue(), "blue");
    assert.deepEqual(await recipient.locator(".announcement").evaluateAll(cards => cards.map(card => card.id)),
      actual.announcements.filter(item => item.themes.includes("fabric")).map(item => item.id));
    await recipient.getByRole("button", { name: "Reset filters", exact: true }).click();
    assert.equal(new URL(recipient.url()).search, "?theme=blue");
    assert.equal(await recipient.locator(".announcement").count(), actual.announcements.length);
    await recipient.goto(new URL("?theme=unknown&topic=unknown", baseUrl).href);
    assert.equal(await recipient.locator("#theme").inputValue(), "blue");
    assert.equal(await recipient.locator(".announcement").count(), actual.announcements.length);
    assert.match(await recipient.locator("#message").innerText(), /Unknown color theme.*Unknown announcement theme/);
  } finally {
    await recipientContext.close();
  }
  await page.locator("#theme").selectOption("blue");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.get("tracking"), "not-shared");
  assert.equal(new URL(page.url()).hash, "#catalog");
  console.log("PASS fresh-recipient theme links, URL precedence, exact topic membership, clean copied URLs, history, reset and invalid-value warnings");

  const synthetic = html.replace(/(<script type="application\/json" id="catalog-data">)[\s\S]*?(<\/script>)/,
    (_, open, close) => open + JSON.stringify(fixture()).replaceAll("<", "\\u003c") + close);
  const briefingUrl = url => url.origin === new URL(baseUrl).origin && url.pathname === new URL(baseUrl).pathname;
  await page.route(briefingUrl, route => route.fulfill({ contentType: "text/html", body: synthetic }));
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
  await page.locator("#audience").selectOption("operations");
  assert.equal(await page.locator("#beta details").getAttribute("open"), "");
  await page.locator("#audience").selectOption("both");
  await page.getByRole("textbox", { name: "Discussion notes: Synthetic test beta", exact: true }).fill("Private test note");
  await page.reload();
  assert.equal(await page.locator("#selection-count").innerText(), "(2)");
  assert.equal(await page.locator("#theme").inputValue(), "blue");
  await page.locator("#theme").selectOption("pink");
  assert.equal(await page.locator("#selection-count").innerText(), "(2)");
  await page.locator("#beta summary").click();
  assert.equal(await page.getByRole("textbox", { name: "Discussion notes: Synthetic test beta", exact: true }).inputValue(), "Private test note");
  await page.locator("#audience").selectOption("operations");
  assert.ok(!(await page.locator(".announcement .relevance").first().innerText()).includes("Risk & governance"));
  await page.locator("#table-view").click();
  assert.equal(await page.locator("#table tbody tr").count(), 3);
  assert.match(await page.locator("#table").innerText(), /Private test note/);
  await page.locator("#selected-only").click();
  assert.equal(await page.locator("#table tbody tr").count(), 2);
  console.log("PASS story selection independent of search, persisted notes/selections, customer perspective and table");

  await page.locator("#discussion > details > summary").click();
  await catalogDisclosure.locator(":scope > summary").click();
  await page.locator('#selection-dock a[href="#discussion"]').click();
  assert.equal(await catalogDisclosure.getAttribute("open"), "");
  assert.equal(await page.locator("#discussion > details").getAttribute("open"), "");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#export-csv").click()]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8");
  assert.match(csv, /Private test note/);
  assert.match(csv, /Synthetic test alpha/);
  assert.ok(!csv.includes("Synthetic test gamma"));
  await page.locator('button[data-theme="copilot"]').click();
  await page.locator("#share").click();
  const share = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(!share.includes("Private"));
  assert.match(share, /selected=alpha%2Cbeta/);
  assert.equal(new URL(share).search, "?theme=pink&topic=copilot");
  await page.unroute(briefingUrl);
  await page.route("**/*", route => {
    if (new URL(route.request().url()).origin === new URL(baseUrl).origin) return route.fulfill({ contentType: "text/html", body: synthetic });
    return route.continue();
  });
  await page.goto(share);
  await page.locator("#cards .announcement").first().waitFor();
  assert.equal(await page.locator(".announcement").count(), 2);
  assert.equal(await page.locator("#selected-only").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#selection-dock").isVisible(), true);
  assert.equal(await page.locator("#theme").inputValue(), "pink");
  assert.equal(await page.locator('button[data-theme="copilot"]').getAttribute("aria-pressed"), "true");
  await page.evaluate(() => new Promise(resolve => {
    window.addEventListener("hashchange", () => resolve(), { once: true });
    location.hash = "selected=alpha%2Cbeta%2Calpha";
  }));
  assert.equal(await page.locator('button[data-theme="copilot"]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".announcement").count(), 2);
  await page.locator('button[data-theme=""]').click();
  await page.locator("#dock-selected").click();
  assert.equal(await page.locator(".announcement").count(), 3);
  await page.locator("#dock-selected").click();
  assert.equal(await page.locator(".announcement").count(), 2);
  const intersectedShare = new URL(share);
  intersectedShare.searchParams.set("topic", "fabric");
  await page.goto(intersectedShare.href);
  assert.deepEqual(await page.locator(".announcement").evaluateAll(cards => cards.map(card => card.id)), ["beta"]);
  assert.equal(await page.locator("#selection-count").innerText(), "(2)");
  await page.goto(new URL("#selected=alpha%2Cbeta", baseUrl).href);
  assert.equal(await page.locator(".announcement").count(), 2);
  assert.equal(await page.locator('button[data-theme=""]').getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#selected-only").getAttribute("aria-pressed"), "true");
  console.log("PASS CSV download contents, private-note-free theme/selection links and restored selected-only view");

  const openBeforePrint = await page.locator(".announcement details[open]").count();
  await catalogDisclosure.locator(":scope > summary").click();
  const sectionsBeforePrint = await disclosures.evaluateAll(elements => elements.map(element => element.open));
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  assert.equal(await catalogDisclosure.getAttribute("open"), "");
  assert.equal(await page.locator(".announcement details[open]").count(), 2);
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".toolbar").isVisible(), false);
  assert.equal(await page.locator("#cards").isVisible(), true);
  assert.equal(await page.locator(".print-note").filter({ hasText: "Private test note" }).isVisible(), true);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  assert.equal(await page.locator(".announcement details[open]").count(), openBeforePrint);
  assert.deepEqual(await disclosures.evaluateAll(elements => elements.map(element => element.open)), sectionsBeforePrint);
  await page.locator('nav a[href="#catalog"]').click();
  assert.equal(await catalogDisclosure.getAttribute("open"), "");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.locator("#theme").selectOption("blue");
  assert.equal(await page.locator("html").getAttribute("data-palette"), "blue");
  await page.locator("#present").click();
  assert.equal(await page.locator("#overview").isVisible(), false);
  const offlineContext = await browser.newContext({ offline: true });
  const offlinePage = await offlineContext.newPage();
  offlinePage.on("pageerror", error => errors.push(error.message));
  try {
    const fileUrl = new URL("../index.html", import.meta.url);
    fileUrl.search = "?theme=blue&topic=fabric";
    await offlinePage.goto(fileUrl.href);
    assert.equal(await offlinePage.locator("#theme").inputValue(), "blue");
    assert.equal(await offlinePage.locator(".announcement").count(), actual.announcements.filter(item => item.themes.includes("fabric")).length);
    await offlinePage.locator("#theme").selectOption("pink");
    assert.equal(new URL(offlinePage.url()).searchParams.get("theme"), "pink");
  } finally {
    await offlineContext.close();
  }
  assert.deepEqual(errors, []);
  console.log("PASS print notes, populated mobile layout, theme/presenter controls, offline file URLs and no browser errors");
} finally {
  await browser.close();
}
