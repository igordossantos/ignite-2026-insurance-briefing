import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateData, filterItems, selectGroup, restoreSelection, exportCsv, exportMarkdown } from "../src/logic.mjs";
import { sourceState } from "../tools/check-source.mjs";
import { fixture } from "./fixtures.mjs";

test("the published data is valid and does not invent news while the source is pending", async () => {
  const data = validateData(JSON.parse(await readFile(new URL("../data/announcements.json", import.meta.url), "utf8")));
  if (data.meta.sourceState === "pending") assert.equal(data.announcements.length, 0);
});
test("bulk theme selection selects every member, keeps existing selections and deduplicates overlaps", () => {
  const { announcements } = fixture();
  const first = selectGroup(announcements, new Set(["gamma"]), "themes", "copilot");
  assert.deepEqual([...first].sort(), ["alpha", "beta", "gamma"]);
  assert.equal(selectGroup(announcements, first, "themes", "fabric").size, 3);
});
test("story selection is independent of search and theme filters", () => {
  const { announcements } = fixture();
  assert.deepEqual(filterItems(announcements, { theme: "fabric", story: "claims", query: "beta" }).map(i => i.id), ["beta"]);
  assert.deepEqual([...selectGroup(announcements, new Set(), "stories", "claims")], ["alpha", "beta"]);
});
test("combined filters intersect, include customer relevance and selected-only membership", () => {
  const { announcements } = fixture();
  assert.equal(filterItems(announcements, { query: "RISK", theme: "fabric" }).length, 2);
  assert.deepEqual(filterItems(announcements, { selectedOnly: true }, new Set(["gamma"])).map(i => i.id), ["gamma"]);
  assert.equal(filterItems(announcements, { theme: "fabric", story: "claims", status: "GA" }).length, 0);
});
test("share selections are deduplicated and reject unknown IDs or malformed saved data", () => {
  const { announcements } = fixture();
  assert.deepEqual([...restoreSelection(["beta", "beta", "absent"], announcements)], ["beta"]);
  assert.equal(restoreSelection("alpha", announcements).size, 0);
});
test("CSV escapes quotes, multiline notes and spreadsheet formula injection", () => {
  const { announcements } = fixture();
  const csv = exportCsv([announcements[0]], { alpha: '=HYPERLINK("https://example.org")\nsecond line' }, "farmers");
  assert.ok(csv.includes(`"'=HYPERLINK(""https://example.org"")\nsecond line"`));
  assert.ok(csv.includes("Potential relevance: Farmers Insurance"));
  assert.ok(!csv.includes("Potential relevance: Zurich Insurance Group"));
});
test("Markdown exports chosen customer, evidence links and notes only for selected entries", () => {
  const { announcements } = fixture();
  const text = exportMarkdown([announcements[1]], { beta: "Review this", alpha: "Never export" }, "zurich");
  assert.ok(text.includes("Potential relevance for Zurich Insurance Group"));
  assert.ok(!text.includes("Potential relevance for Farmers Insurance"));
  assert.ok(text.includes("#beta"));
  assert.ok(text.includes("Review this"));
  assert.ok(!text.includes("Never export"));
});
test("valid populated fixture passes; fabricated pending-source data and empty complete coverage fail", () => {
  assert.ok(validateData(fixture()));
  const data = fixture(); data.meta.sourceState = "pending";
  assert.throws(() => validateData(data), /pending/);
  data.announcements = []; data.meta.sourceSections = []; data.meta.sourceState = "complete";
  assert.throws(() => validateData(data), /cannot be empty/);
});
test("unmapped source sections, omitted inventory sections and duplicate IDs fail validation", () => {
  const data = fixture(); data.meta.sourceSections.push("missing");
  assert.throws(() => validateData(data), /missing from catalog/);
  data.meta.sourceSections = [];
  assert.throws(() => validateData(data), /missing from source inventory/);
  data.announcements.push(data.announcements[0]);
  assert.throws(() => validateData(data), /duplicate/);
});
test("invalid sources, missing customer perspective, and unknown tags fail validation", () => {
  const data = fixture(); data.announcements[0].sources[0].url = "javascript:alert(1)";
  assert.throws(() => validateData(data), /sources/);
  const noSection = fixture(); noSection.announcements[0].sources[0].url = noSection.meta.sourceUrl;
  assert.throws(() => validateData(noSection), /section link/);
  const noCustomer = fixture(); delete noCustomer.announcements[0].relevance.zurich;
  assert.throws(() => validateData(noCustomer), /perspectives/);
  const noTheme = fixture(); noTheme.announcements[0].themes = ["unmapped"];
  assert.throws(() => validateData(noTheme), /themes/);
});
test("source check recognizes the holding page but never equates missing holding text with complete coverage", () => {
  assert.equal(sourceState("<h1>Microsoft Ignite 2026</h1><p>The Book of News will be available after the keynote.</p>"), "pending");
  assert.equal(sourceState("<h1>Microsoft Ignite 2026 Book of News</h1><h2>News</h2>"), "review-required");
  assert.throws(() => sourceState("<h1>Access denied</h1>"), /expected/);
});
test("built artifact is self-contained, embeds the real dataset, uses safe DOM rendering and has no unresolved markers", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(!html.includes("/*__"));
  assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/i.test(html));
  assert.ok(html.includes('id="catalog-data"'));
  assert.ok(!html.includes("Synthetic test"));
  assert.ok(!html.includes(".innerHTML"));
  assert.ok(html.includes("--cp-bg: #f7f4ef"));
  assert.ok(html.includes('get("scoutTheme")'));
  const actual = JSON.parse(html.match(/<script type="application\/json" id="catalog-data">([\s\S]*?)<\/script>/)[1]);
  const expected = JSON.parse(await readFile(new URL("../data/announcements.json", import.meta.url), "utf8"));
  assert.deepEqual(actual, expected);
});
