import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const file = new URL("../index.html", import.meta.url);
const port = Number(process.env.PORT || 8086);
createServer(async (req, res) => {
  if (!["/", "/index.html"].includes(new URL(req.url, "http://localhost").pathname)) {
    res.writeHead(404).end("Not found"); return;
  }
  try {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(await readFile(file));
  } catch (error) { console.error(error); res.writeHead(500).end("Build the briefing with npm run build first."); }
}).listen(port, "127.0.0.1", () => console.log(`Briefing ready at http://127.0.0.1:${port}`));
