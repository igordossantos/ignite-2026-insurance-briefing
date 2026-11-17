const url = "https://news.microsoft.com/events/ignite/2026/book-of-news/";

export function sourceState(html) {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/Book of News will be available/i.test(text)) return "pending";
  if (!/Microsoft Ignite 2026/i.test(text) || !/Book of News/i.test(text)) throw new Error("The source did not return the expected Ignite Book of News page.");
  return "review-required";
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } });
  if (!response.ok) throw new Error(`Source check failed: HTTP ${response.status}`);
  const state = sourceState(await response.text());
  console.log(JSON.stringify({ url, checkedAt: new Date().toISOString(), state,
    action: state === "pending" ? "Official holding page is still present. Do not populate announcements from older events." :
      "The holding message is absent. Review the official source, inventory every announcement section, add original summaries and source links, then rebuild and test. This is not proof of complete coverage." }, null, 2));
}
