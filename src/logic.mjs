export const STATUSES = ["GA", "Mixed availability", "Public preview", "Private preview", "Preview", "Frontier", "Rolling out", "Preview coming soon", "Coming soon", "Not specified"];

export function validateData(data) {
  const fail = message => { throw new Error(`Invalid catalog: ${message}`); };
  if (!data?.meta || !Array.isArray(data.announcements)) fail("metadata and announcements are required");
  if (!["pending", "partial", "complete"].includes(data.meta.sourceState)) fail("unknown source state");
  if (!Number.isFinite(Date.parse(data.meta.checkedAt))) fail("checkedAt must be a date");
  if (!data.meta.coverageNote || !Array.isArray(data.meta.sourceSections)) fail("coverage evidence is required");
  const safeUrl = url => {
    try { return new URL(url).protocol === "https:"; } catch { return false; }
  };
  if (!safeUrl(data.meta.sourceUrl)) fail("source URL must use HTTPS");
  const taxonomy = (entries, label) => {
    if (!Array.isArray(entries) || !entries.length) fail(`${label} must not be empty`);
    const ids = new Set();
    for (const entry of entries) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || !entry.name || !entry.description || ids.has(entry.id)) fail(`invalid ${label} entry`);
      ids.add(entry.id);
    }
    return ids;
  };
  const themes = taxonomy(data.themes, "themes"), stories = taxonomy(data.stories, "stories");
  const ids = new Set(), sections = new Set();
  for (const item of data.announcements) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || ids.has(item.id)) fail("duplicate or invalid announcement ID");
    ids.add(item.id);
    for (const field of ["title", "summary", "workload", "section", "availabilityEvidence", "nextStep"]) {
      if (typeof item[field] !== "string" || !item[field].trim()) fail(`${item.id}: ${field} is required`);
    }
    if (!STATUSES.includes(item.status)) fail(`${item.id}: invalid availability`);
    if (!Array.isArray(item.details) || !item.details.length || item.details.some(detail => typeof detail !== "string" || !detail.trim())) fail(`${item.id}: factual highlights are required`);
    if (item.discrepancy !== undefined && (typeof item.discrepancy !== "string" || !item.discrepancy.trim())) fail(`${item.id}: invalid source caveat`);
    for (const [field, values] of [["themes", themes], ["stories", stories]]) {
      if (!Array.isArray(item[field]) || !item[field].length || item[field].some(id => !values.has(id))) fail(`${item.id}: invalid ${field}`);
    }
    if (!item.relevance || ["farmers", "zurich"].some(key => typeof item.relevance[key] !== "string" || !item.relevance[key].trim())) fail(`${item.id}: both customer perspectives are required`);
    if (!Array.isArray(item.sources) || !item.sources.length || item.sources.some(source => !source.label || !safeUrl(source.url))) fail(`${item.id}: valid sources are required`);
    if (!item.sources.some(source => {
      const url = new URL(source.url), book = new URL(data.meta.sourceUrl);
      return url.origin === book.origin && url.pathname === book.pathname && url.hash.length > 1;
    })) fail(`${item.id}: an exact Book of News section link is required`);
    sections.add(item.section);
  }
  if (data.meta.sourceState === "pending" && ids.size) fail("pending sources cannot contain announcements");
  if (new Set(data.meta.sourceSections).size !== data.meta.sourceSections.length) fail("duplicate source sections");
  if (data.meta.sourceSections.some(section => !sections.has(section))) fail("source section missing from catalog");
  if ([...sections].some(section => !data.meta.sourceSections.includes(section))) fail("catalog section missing from source inventory");
  if (data.meta.sourceState === "complete" && !ids.size) fail("complete coverage cannot be empty");
  if (data.blog !== undefined) {
    const blog = data.blog;
    const requiredText = (object, fields) => object && fields.every(field => typeof object[field] === "string" && object[field].trim());
    if (!requiredText(blog, ["title", "summary", "availabilityNote", "linkScope"]) || !safeUrl(blog.url) ||
      !Number.isFinite(Date.parse(blog.publishedAt)) || !Number.isFinite(Date.parse(blog.checkedAt))) fail("invalid blog metadata");
    if (!Array.isArray(blog.topics) || !blog.topics.length || !Array.isArray(blog.links) || !blog.links.length) fail("blog topics and links are required");
    const topicIds = new Set();
    for (const topic of blog.topics) {
      if (!requiredText(topic, ["id", "title", "summary"]) || topicIds.has(topic.id)) fail("invalid blog topic");
      topicIds.add(topic.id);
      if (!Array.isArray(topic.sections) || !topic.sections.length || new Set(topic.sections).size !== topic.sections.length ||
        topic.sections.some(section => !sections.has(section))) fail("blog topic references an unknown or duplicate source section");
      if (!requiredText(topic.relevance, ["farmers", "zurich"])) fail("blog topic requires both customer perspectives");
      if (topic.caveat !== undefined && !requiredText(topic, ["caveat"])) fail("invalid blog caveat");
    }
    const urls = new Set();
    for (const resource of blog.links) {
      if (!requiredText(resource, ["kind", "title", "summary"]) || !safeUrl(resource.url) || urls.has(resource.url) ||
        (resource.publishedAt !== undefined && !Number.isFinite(Date.parse(resource.publishedAt)))) fail("invalid blog resource");
      urls.add(resource.url);
    }
  }
  return data;
}

export function filterItems(items, filters, selected = new Set()) {
  const query = (filters.query || "").trim().toLocaleLowerCase();
  return items.filter(item =>
    (!filters.theme || item.themes.includes(filters.theme)) &&
    (!filters.story || item.stories.includes(filters.story)) &&
    (!filters.workload || item.workload === filters.workload) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.selectedOnly || selected.has(item.id)) &&
    (!query || [item.title, item.summary, ...item.details, item.availabilityEvidence, item.discrepancy || "", item.nextStep, item.workload, item.section, ...item.themes, ...item.stories,
      item.relevance.farmers, item.relevance.zurich].join(" ").toLocaleLowerCase().includes(query))
  ).sort((a, b) => filters.sort === "title" ? a.title.localeCompare(b.title) :
    filters.sort === "workload" ? a.workload.localeCompare(b.workload) || a.title.localeCompare(b.title) : 0);
}

export function selectGroup(items, selected, field, id) {
  if (!["themes", "stories"].includes(field)) throw new Error("Unknown selection group");
  return new Set([...selected, ...items.filter(item => item[field].includes(id)).map(item => item.id)]);
}

export function restoreSelection(raw, items) {
  const valid = new Set(items.map(item => item.id));
  return new Set((Array.isArray(raw) ? raw : []).filter(id => valid.has(id)));
}

export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(items, notes, audience) {
  const customers = audience === "both" ? ["farmers", "zurich"] : [audience];
  const rows = [["Source section", "Title", "Workload", "Themes", "Stories", "Availability", "Availability evidence", "Source caveat", "Summary", "Highlights",
    ...customers.map(key => key === "farmers" ? "Potential relevance: Farmers Insurance" : "Potential relevance: Zurich Insurance Group"), "Next step", "Sources", "Notes"]];
  for (const item of items) rows.push([item.section, item.title, item.workload, item.themes.join("; "), item.stories.join("; "), item.status,
    item.availabilityEvidence, item.discrepancy || "", item.summary, item.details.join("\n"), ...customers.map(key => item.relevance[key]), item.nextStep, item.sources.map(s => s.url).join("; "), notes[item.id] || ""]);
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}

export function exportMarkdown(items, notes, audience) {
  const plain = value => String(value).replace(/[\\`*_[\]<>#|]/g, "\\$&");
  const lines = ["# Microsoft Ignite 2026 | Insurance discussion list", "",
    "Suggested use cases only; not statements about either organization's environment.", ""];
  for (const item of items) {
    lines.push(`## ${plain(item.title)}`, "", `${plain(item.workload)} | ${plain(item.status)}`,
      "", `Book of News section: ${plain(item.section)}`, "", plain(item.summary), "",
      ...item.details.map(detail => `- ${plain(detail)}`), "", `Availability evidence: ${plain(item.availabilityEvidence)}`, "");
    if (item.discrepancy) lines.push(`Source caveat: ${plain(item.discrepancy)}`, "");
    lines.push(`Themes: ${item.themes.map(plain).join(", ")}`, `Stories: ${item.stories.map(plain).join(", ")}`, "");
    if (audience !== "zurich") lines.push(`Potential relevance for Farmers Insurance: ${plain(item.relevance.farmers)}`, "");
    if (audience !== "farmers") lines.push(`Potential relevance for Zurich Insurance Group: ${plain(item.relevance.zurich)}`, "");
    lines.push(`Suggested next step: ${plain(item.nextStep)}`, "", ...item.sources.map(s => `Source: ${s.url}`), "");
    if (notes[item.id]) lines.push(`Discussion notes: ${plain(notes[item.id])}`, "");
  }
  return lines.join("\n");
}
