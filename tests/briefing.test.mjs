import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateData, filterItems, selectGroup, restoreSelection, exportCsv, exportMarkdown } from "../src/logic.mjs";
import { sourceState } from "../tools/check-source.mjs";
import { fixture } from "./fixtures.mjs";

test("the complete catalog matches every independently captured numbered source and contents entry", async () => {
  const data = validateData(JSON.parse(await readFile(new URL("../data/announcements.json", import.meta.url), "utf8")));
  const inventory = JSON.parse(await readFile(new URL("../data/source-inventory.json", import.meta.url), "utf8"));
  assert.equal(data.meta.sourceState, "complete");
  assert.equal(inventory.sections.length, 59);
  assert.deepEqual(data.meta.sourceSections, inventory.sections.map(item => item.number));
  assert.deepEqual([...inventory.numberedContents].sort(), [...data.meta.sourceSections].sort());
  assert.equal(new Set(data.announcements.map(item => item.section)).size, inventory.sections.length);
  assert.equal(new Set(inventory.sections.map(item => item.id)).size, inventory.sections.length);
  assert.equal(data.announcements.length, inventory.sections.length);
  for (const [index, section] of inventory.sections.entries()) {
    const item = data.announcements[index];
    assert.equal(item.section, section.number);
    assert.equal(item.id, section.id);
    assert.equal(item.title, section.title);
    assert.ok(item.sources.some(source => source.url === inventory.sourceUrl + "#" + section.id));
  }
});
test("mixed, future and program-gated availability is preserved in the real catalog and exports", async () => {
  const { announcements } = JSON.parse(await readFile(new URL("../data/announcements.json", import.meta.url), "utf8"));
  for (const [section, status] of [["1.3.1", "Mixed availability"], ["1.3.7", "Preview"], ["4.1.2", "Frontier"], ["6.4.1", "Mixed availability"], ["7.4.2", "Preview coming soon"], ["8.1.6", "Mixed availability"]]) {
    assert.equal(announcements.find(item => item.section === section).status, status);
  }
  const fabric = announcements.find(item => item.section === "6.4.1");
  const markdown = exportMarkdown([fabric], {}, "both"), csv = exportCsv([fabric], {}, "both");
  for (const output of [markdown, csv]) {
    assert.ok(output.includes(fabric.availabilityEvidence));
    assert.ok(output.includes(fabric.discrepancy));
    assert.ok(output.includes(fabric.details[0]));
  }
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
  announcements[0].details = ["A distinctive subfeature keyword"];
  announcements[1].workload = "Another workload";
  assert.deepEqual(filterItems(announcements, { query: "SUBFEATURE", workload: "Test workload" }).map(i => i.id), ["alpha"]);
  assert.equal(filterItems(announcements, { query: "subfeature", workload: "Another workload" }).length, 0);
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
  const noHighlights = fixture(); noHighlights.announcements[0].details = [];
  assert.throws(() => validateData(noHighlights), /highlights/);
});
test("source check recognizes the holding page but never equates missing holding text with complete coverage", () => {
  assert.equal(sourceState("<h1>Microsoft Ignite 2026</h1><p>The Book of News will be available after the keynote.</p>"), "pending");
  assert.equal(sourceState("<h1>Microsoft Ignite 2026 Book of News</h1><h2>News</h2>"), "review-required");
  assert.throws(() => sourceState("<h1>Access denied</h1>"), /expected/);
});
test("blog context validates existing section mappings and rejects unsafe or incomplete supplementary sources", async () => {
  const data = JSON.parse(await readFile(new URL("../data/announcements.json", import.meta.url), "utf8"));
  const blog = JSON.parse(await readFile(new URL("../data/blog.json", import.meta.url), "utf8"));
  assert.ok(validateData({ ...data, blog }));
  assert.equal(blog.topics.length, 6);
  assert.deepEqual(blog.links.map(link => link.url), [
    "https://ignite.microsoft.com/en-US/",
    "https://www.youtube-nocookie.com/embed/Jwp2aZDSVss?feature=oembed",
    data.meta.sourceUrl,
    "https://blogs.microsoft.com/blog/2026/11/12/scaling-ai-value-without-losing-control-lessons-from-frontier-firms/",
    "https://blogs.microsoft.com/blog/2026/10/27/the-platform-approach-to-becoming-frontier/"
  ]);
  for (const [change, error] of [
    [copy => { copy.links[0].url = "javascript:alert(1)"; }, /blog resource/],
    [copy => { copy.topics[0].sections.push("unverified"); }, /source section/],
    [copy => { copy.topics.push(copy.topics[0]); }, /blog topic/],
    [copy => { delete copy.topics[0].relevance.zurich; }, /both customer/]
  ]) {
    const copy = structuredClone(blog); change(copy);
    assert.throws(() => validateData({ ...data, blog: copy }), error);
  }
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
  const blog = JSON.parse(await readFile(new URL("../data/blog.json", import.meta.url), "utf8"));
  const mappedSections = new Set(blog.topics.flatMap(topic => topic.sections));
  for (const item of actual.announcements) {
    const original = expected.announcements.find(entry => entry.id === item.id);
    assert.deepEqual(item.sources.filter(source => source.url !== blog.url), original.sources);
    assert.equal(item.sources.filter(source => source.url === blog.url).length, mappedSections.has(item.section) ? 1 : 0);
  }
  assert.ok(exportCsv(actual.announcements.filter(item => mappedSections.has(item.section)), {}, "both").includes(blog.url));
  assert.ok(exportMarkdown(actual.announcements.filter(item => mappedSections.has(item.section)), {}, "both").includes(blog.url));
  assert.ok(!/<iframe\b/i.test(html));
  expected.blog = blog;
  for (const item of expected.announcements) {
    if (mappedSections.has(item.section)) item.sources.push({ label: "Ignite 2026 keynote blog", url: blog.url });
  }
  assert.deepEqual(actual, expected);
});
