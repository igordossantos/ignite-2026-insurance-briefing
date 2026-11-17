import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const [sourceInput, outputPath] = process.argv.slice(2);
if (!sourceInput || !outputPath) throw new Error("Usage: node tools/inventory-source.mjs <source-url-or-rendered-html> <review-json-output>");
const executablePath = process.env.CHROME_PATH || (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined);
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  let html;
  if (/^https:\/\//.test(sourceInput)) {
    const response = await page.goto(sourceInput, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!response?.ok()) throw new Error(`Source request failed: HTTP ${response?.status()}`);
    await page.locator('[data-bon-number="1.1.1"]').waitFor({ state: "attached", timeout: 30000 });
    html = await page.content();
  } else html = await readFile(sourceInput, "utf8");
  const inventory = await page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, "text/html");
    const clean = text => text.replace(/\s+/g, " ").trim();
    const headings = [...doc.querySelectorAll("h2[data-bon-number], h3[data-bon-number], h4[data-bon-number]")];
    const sections = headings.filter(heading => /^\d+\.\d+\.\d+$/.test(heading.dataset.bonNumber)).map(heading => {
      const container = heading.closest(".wp-block-mks-bon-entry[id]");
      if (!container) throw new Error(`Missing section container: ${heading.textContent}`);
      const body = container.cloneNode(true);
      body.querySelectorAll(".wp-block-mks-bon-entry, .seb-bon-content__summary, .wp-block-mks-bon-variation-heading, script, style, button").forEach(element => element.remove());
      const firstHeading = body.querySelector("h2, h3, h4");
      firstHeading?.remove();
      const chapterNumber = heading.dataset.bonNumber.split(".")[0];
      return {
        number: heading.dataset.bonNumber,
        id: container.id,
        sourceId: container.dataset.bonEntry,
        title: clean(heading.textContent),
        chapter: clean(headings.find(h => h.dataset.bonNumber === chapterNumber)?.textContent || ""),
        text: clean(body.textContent),
        paragraphs: [...body.querySelectorAll("p, li")].map(element => clean(element.textContent)).filter(Boolean),
        links: [...body.querySelectorAll("a[href]")].map(anchor => ({ label: clean(anchor.textContent), url: anchor.getAttribute("href") })).filter(link => /^https:\/\//.test(link.url))
      };
    });
    const tocNumbers = [...doc.querySelectorAll("a")].map(anchor => clean(anchor.textContent).match(/^(\d+\.\d+\.\d+)\b/)?.[1]).filter(Boolean);
    return { sections, tocNumbers: [...new Set(tocNumbers)] };
  }, html);
  if (!inventory.sections.length) throw new Error("No numbered announcement items found; do not treat this as complete coverage.");
  if (new Set(inventory.sections.map(item => item.number)).size !== inventory.sections.length) throw new Error("Duplicate source section numbers.");
  if (new Set(inventory.sections.map(item => item.id)).size !== inventory.sections.length) throw new Error("Duplicate source anchors.");
  const missing = inventory.tocNumbers.filter(number => !inventory.sections.some(item => item.number === number));
  if (missing.length) throw new Error(`TOC entries missing from section extraction: ${missing.join(", ")}`);
  const unlisted = inventory.sections.filter(item => !inventory.tocNumbers.includes(item.number));
  if (unlisted.length) throw new Error(`Sections missing from numbered TOC: ${unlisted.map(item => item.number).join(", ")}`);
  await writeFile(outputPath, JSON.stringify(inventory, null, 2) + "\n");
  console.log(`Extracted ${inventory.sections.length} numbered announcements; ${inventory.tocNumbers.length} numbered TOC entries. Review saved to ${outputPath}`);
  for (const item of inventory.sections) console.log(`${item.number} | ${item.chapter} | ${item.title}`);
} finally {
  await browser.close();
}
