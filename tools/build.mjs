import { readFile, writeFile } from "node:fs/promises";
import { validateData } from "../src/logic.mjs";

const root = new URL("../", import.meta.url);
const [page, styles, logic, app, raw, blog] = await Promise.all(
  ["src/page.html", "src/styles.css", "src/logic.mjs", "src/app.mjs", "data/announcements.json", "data/blog.json"].map(path => readFile(new URL(path, root), "utf8"))
);
const data = validateData({ ...JSON.parse(raw), blog: JSON.parse(blog) });
const blogSections = new Set(data.blog.topics.flatMap(topic => topic.sections));
for (const item of data.announcements) {
  if (blogSections.has(item.section) && !item.sources.some(source => source.url === data.blog.url)) {
    item.sources.push({ label: "Ignite 2026 keynote blog", url: data.blog.url });
  }
}
const script = logic.replaceAll("export ", "") + "\n" + app.replace(/^import .+\r?\n/, "");
const html = page.replace("/*__STYLES__*/", () => styles)
  .replace("/*__DATA__*/", () => JSON.stringify(data).replaceAll("<", "\\u003c"))
  .replace("/*__APP__*/", () => script.replaceAll("</script", "<\\/script"));
await writeFile(new URL("index.html", root), html);
console.log(`Built self-contained index.html: ${data.announcements.length} announcements, source state: ${data.meta.sourceState}.`);
