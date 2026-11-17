import { readFile, writeFile } from "node:fs/promises";
import { validateData } from "../src/logic.mjs";

const root = new URL("../", import.meta.url);
const [page, styles, logic, app, raw] = await Promise.all(
  ["src/page.html", "src/styles.css", "src/logic.mjs", "src/app.mjs", "data/announcements.json"].map(path => readFile(new URL(path, root), "utf8"))
);
const data = validateData(JSON.parse(raw));
const script = logic.replaceAll("export ", "") + "\n" + app.replace(/^import .+\r?\n/, "");
const html = page.replace("/*__STYLES__*/", () => styles)
  .replace("/*__DATA__*/", () => JSON.stringify(data).replaceAll("<", "\\u003c"))
  .replace("/*__APP__*/", () => script.replaceAll("</script", "<\\/script"));
await writeFile(new URL("index.html", root), html);
console.log(`Built self-contained index.html: ${data.announcements.length} announcements, source state: ${data.meta.sourceState}.`);
