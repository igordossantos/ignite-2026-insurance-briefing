import { STATUSES, validateData, filterItems, selectGroup, restoreSelection, exportCsv, exportMarkdown } from "./logic.mjs";

const $ = id => document.getElementById(id);
const storageKey = "ignite-2026-insurance-discussion-v1";
const customerNames = { farmers: "Farmers Insurance", zurich: "Zurich Insurance Group" };
let messageTimer;
function notify(text) {
  $("message").textContent = text;
  $("message").hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { $("message").hidden = true; }, 9000);
}
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function link(source) {
  const anchor = node("a", source.label);
  anchor.href = source.url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
  return anchor;
}
function button(text, action) {
  const element = node("button", text);
  element.type = "button"; element.addEventListener("click", action);
  return element;
}
function main() {
  const data = validateData(JSON.parse($("catalog-data").textContent));
  const items = data.announcements;
  let selected = new Set(), notes = {}, undo = null, view = "cards";
  const expanded = new Set();
  const filters = { query: "", theme: "", story: "", workload: "", status: "", audience: "both", sort: "source", selectedOnly: false };
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({ selected: [...selected], notes })); }
    catch (error) { console.error("Could not save discussion", error); notify("Browser storage is unavailable or full. Changes are not saved; download your discussion list before leaving."); }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved) {
      if (typeof saved !== "object" || !Array.isArray(saved.selected) || !saved.notes || typeof saved.notes !== "object") throw new Error("Unrecognized saved discussion");
      selected = restoreSelection(saved.selected, items);
      notes = Object.fromEntries(items.filter(item => typeof saved.notes[item.id] === "string").map(item => [item.id, saved.notes[item.id]]));
    }
  } catch (error) { console.error("Could not restore discussion", error); notify("Saved discussion could not be read. Browser storage may be disabled or the saved data may be invalid."); }
  function applySharedSelection(updateView = false) {
    const hash = new URLSearchParams(location.hash.slice(1));
    if (!hash.has("selected")) return;
    const incoming = hash.get("selected").split(",").filter(Boolean);
    selected = restoreSelection(incoming, items); filters.selectedOnly = true;
    if (new Set(incoming).size !== selected.size) notify("Some shared announcements are not in this catalog and were omitted.");
    persist();
    if (updateView) {
      Object.assign(filters, { query: "", theme: "", story: "", workload: "", status: "", audience: "both", sort: "source" });
      $("filters").reset();
      filters.selectedOnly = true;
      view = "cards"; undo = null; render();
    }
  }
  applySharedSelection();
  window.addEventListener("hashchange", () => applySharedSelection(true));
  function changeSelection(next) {
    undo = new Set(selected); selected = next; persist(); render();
  }
  function selectEntireGroup(field, id) {
    changeSelection(selectGroup(items, selected, field, id));
    notify(`Selected all announcements in ${field === "themes" ? "this theme" : "this story"}. Other selections were kept.`);
  }
  function selectedItems() { return items.filter(item => selected.has(item.id)); }
  const nameOf = (field, id) => data[field].find(entry => entry.id === id).name;
  const visible = () => filterItems(items, filters, selected);

  const sourceNotice = $("source-notice");
  sourceNotice.append(node("strong", data.meta.sourceState === "pending" ? "Awaiting the official announcement catalog" :
    data.meta.sourceState === "partial" ? "Partial coverage - compilation in progress" : `${items.length}/${data.meta.sourceSections.length} numbered Book of News items compiled`));
  sourceNotice.append(node("span", data.meta.coverageNote), node("p", `Source checked: ${new Date(data.meta.checkedAt).toLocaleString(undefined, { timeZoneName: "short" })}`));
  for (const [value, label] of [[items.length, "source-linked announcements"], [new Set(items.map(item => item.workload)).size, "source workloads"], [new Set(items.flatMap(item => item.themes)).size, "technology themes"], [data.stories.length, "insurance discussion stories"]]) {
    const metric = node("div", undefined, "metric");
    metric.append(node("strong", String(value)), node("span", label)); $("metrics").append(metric);
  }
  $("source-link").href = data.meta.sourceUrl;
  $("empty-source").href = data.meta.sourceUrl;
  $("checked").textContent = `Last checked: ${new Date(data.meta.checkedAt).toLocaleString(undefined, { timeZoneName: "short" })}.`;
  $("coverage").textContent = data.meta.coverageNote;
  if (!data.meta.sourceSections.length) $("source-sections").append(node("li", "No announcement sections accessible at the source check."));
  for (const section of data.meta.sourceSections) {
    const entry = node("li"), item = items.find(item => item.section === section);
    entry.append(link({ label: `${section} | ${item.title}`, url: item.sources.find(source => new URL(source.url).origin === new URL(data.meta.sourceUrl).origin).url }));
    $("source-sections").append(entry);
  }
  if (data.blog) {
    const blog = data.blog;
    $("keynote").hidden = false; $("keynote-nav").hidden = false;
    $("blog-summary").textContent = blog.summary;
    $("blog-source").append(link({ label: `${blog.title} (opens in new tab)`, url: blog.url }));
    $("blog-checked").textContent = `Published: ${blog.publishedAt}. Reviewed: ${new Date(blog.checkedAt).toLocaleString(undefined, { timeZoneName: "short" })}.`;
    $("blog-availability").textContent = blog.availabilityNote;
    for (const topic of blog.topics) {
      const card = node("article", undefined, "story blog-topic");
      card.append(node("h3", topic.title), node("p", topic.summary));
      if (topic.caveat) card.append(node("p", topic.caveat, "caveat"));
      const details = node("details"), related = node("ul");
      details.append(node("summary", "Insurance lenses & related announcements"), relevance(topic), node("h4", "Related Book of News sections"));
      for (const section of topic.sections) {
        const item = items.find(item => item.section === section), entry = node("li");
        entry.append(link({ label: `${section} | ${item.title}`, url: item.sources[0].url })); related.append(entry);
      }
      details.append(related); card.append(details); $("blog-topics").append(card);
    }
    $("blog-link-scope").textContent = blog.linkScope;
    for (const resource of blog.links) {
      const entry = node("li");
      entry.append(node("span", `${resource.kind}${resource.publishedAt ? ` / ${resource.publishedAt}` : ""}`, "tag"),
        node("br"), link({ label: `${resource.title} (opens in new tab)`, url: resource.url }), node("p", resource.summary));
      $("blog-links").append(entry);
    }
  }
  function groupCard(group, field) {
    const kind = field === "themes" ? "theme" : "story";
    const count = items.filter(item => item[field].includes(group.id)).length;
    const card = node("article", undefined, "story");
    const browse = button(`Browse ${kind}`, () => {
      filters[kind] = group.id;
      if (kind === "story") $("story").value = group.id;
      filters.selectedOnly = false; render(); $("catalog").scrollIntoView();
    });
    const select = button(`Select ${kind}`, () => selectEntireGroup(field, group.id));
    select.disabled = count === 0;
    card.append(node("span", `${String(count).padStart(2, "0")} ANNOUNCEMENTS`, "count"), node("h3", group.name), node("p", group.description), browse, document.createTextNode(" "), select);
    return card;
  }
  for (const story of data.stories) {
    $("stories").append(groupCard(story, "stories"));
    const option = node("option", story.name); option.value = story.id; $("story").append(option);
  }
  for (const theme of data.themes) $("technology-stories").append(groupCard(theme, "themes"));
  for (const status of STATUSES) { const option = node("option", status); option.value = status; $("status").append(option); }
  for (const workload of [...new Set(items.map(item => item.workload))]) {
    const option = node("option", `${workload} (${items.filter(item => item.workload === workload).length})`);
    option.value = workload; $("workload").append(option);
  }
  const themeButtons = new Map();
  for (const theme of [{ id: "", name: "All themes" }, ...data.themes]) {
    const count = theme.id ? items.filter(item => item.themes.includes(theme.id)).length : items.length;
    const control = button(`${theme.name} (${count})`, () => { filters.theme = theme.id; render(); });
    control.dataset.theme = theme.id;
    themeButtons.set(theme.id, control); $("themes").append(control);
  }
  function checkbox(item) {
    const label = node("label", undefined, "check");
    const input = node("input"); input.type = "checkbox"; input.checked = selected.has(item.id); input.id = `select-${item.id}`;
    input.setAttribute("aria-label", `Select for discussion: ${item.title}`);
    input.addEventListener("change", () => {
      const next = new Set(selected);
      if (input.checked) next.add(item.id); else next.delete(item.id);
      changeSelection(next);
    });
    label.append(input, document.createTextNode("Select for discussion")); return label;
  }
  function relevance(item) {
    const section = node("div", undefined, "relevance");
    for (const key of ["farmers", "zurich"]) {
      if (filters.audience !== "both" && filters.audience !== key) continue;
      const paragraph = node("p");
      paragraph.append(node("strong", `Potential relevance for ${customerNames[key]}: `), document.createTextNode(item.relevance[key]));
      section.append(paragraph);
    }
    return section;
  }
  function card(item) {
    const article = node("article", undefined, `announcement${selected.has(item.id) ? " selected" : ""}`);
    article.id = item.id;
    const meta = node("div", undefined, "card-meta");
    const status = node("span", item.status, "tag status"); status.dataset.status = item.status;
    meta.append(node("span", `${item.section} / ${item.workload}`, "tag"), status);
    if (item.discrepancy) meta.append(node("span", "Source caveat", "tag caveat-flag"));
    for (const id of item.themes) meta.append(node("span", nameOf("themes", id), "tag"));
    const heading = node("h3");
    heading.append(link({ label: item.title, url: item.sources[0].url }));
    const announcementLink = link({ label: "Read announcement (opens in new tab)", url: item.sources[0].url });
    article.append(meta, heading, node("p", item.summary), announcementLink, relevance(item));
    const next = node("p"); next.append(node("strong", "Suggested next step: "), document.createTextNode(item.nextStep)); article.append(next);
    const details = node("details");
    details.open = expanded.has(item.id);
    details.addEventListener("toggle", () => {
      if (!details.isConnected) return;
      if (details.open) expanded.add(item.id); else expanded.delete(item.id);
    });
    const highlights = node("ul", undefined, "highlights");
    for (const detail of item.details) highlights.append(node("li", detail));
    details.append(node("summary", "Highlights, availability & discussion notes"), highlights, node("h4", "Availability evidence"), node("p", item.availabilityEvidence),
      node("p", `Book of News section: ${item.section}`), node("p", `Stories: ${item.stories.map(id => nameOf("stories", id)).join("; ")}`));
    if (item.discrepancy) {
      const caveat = node("p", undefined, "caveat");
      caveat.append(node("strong", "Source caveat: "), document.createTextNode(item.discrepancy)); details.append(caveat);
    }
    const sources = node("ul");
    for (const source of item.sources) { const li = node("li"); li.append(link(source)); sources.append(li); }
    details.append(sources);
    const noteLabel = node("label", "Discussion notes (saved only in this browser)");
    const textarea = node("textarea"); textarea.value = notes[item.id] || ""; textarea.maxLength = 10000;
    textarea.setAttribute("aria-label", `Discussion notes: ${item.title}`);
    const printNote = node("p", notes[item.id] ? `Notes: ${notes[item.id]}` : "", "print-note");
    textarea.addEventListener("input", () => { notes[item.id] = textarea.value; printNote.textContent = textarea.value ? `Notes: ${textarea.value}` : ""; persist(); });
    noteLabel.append(textarea);
    details.append(noteLabel);
    article.append(checkbox(item), details, printNote);
    return article;
  }
  function renderTable(shown) {
    const table = node("table"), head = node("thead"), row = node("tr");
    for (const title of ["Announcement / selection", "Theme & story", "Availability", "Potential relevance / next step", "Sources / notes"]) {
      const th = node("th", title); th.scope = "col"; row.append(th);
    }
    head.append(row); table.append(head);
    const body = node("tbody");
    for (const item of shown) {
      const tr = node("tr"), title = node("td"), tags = node("td"), status = node("td", `${item.status}: ${item.availabilityEvidence}`), potential = node("td"), sources = node("td");
      const heading = node("p");
      heading.append(link({ label: item.title, url: item.sources[0].url }));
      title.append(node("span", `${item.section} / ${item.workload}`, "tag"), heading, node("p", item.summary), checkbox(item));
      if (item.discrepancy) status.append(node("p", `Source caveat: ${item.discrepancy}`, "caveat"));
      tags.textContent = [...item.themes.map(id => nameOf("themes", id)), ...item.stories.map(id => nameOf("stories", id))].join("; ");
      potential.append(relevance(item), node("p", item.nextStep));
      for (const source of item.sources) sources.append(link(source), node("br"));
      sources.append(node("p", notes[item.id] ? `Notes: ${notes[item.id]}` : "No discussion notes. Use Cards to edit notes."));
      tr.append(title, tags, status, potential, sources); body.append(tr);
    }
    table.append(body); $("table").replaceChildren(table);
  }
  function render() {
    const focusedId = document.activeElement.id;
    const shown = visible();
    for (const [id, control] of themeButtons) control.setAttribute("aria-pressed", String(filters.theme === id));
    $("result-count").textContent = `${shown.length} of ${items.length} announcements${filters.selectedOnly ? " | Discussion list only" : ""}`;
    $("selection-count").textContent = `(${selected.size})`;
    $("selected-only").setAttribute("aria-pressed", String(filters.selectedOnly));
    $("dock-selected").setAttribute("aria-pressed", String(filters.selectedOnly));
    $("selection-dock").hidden = selected.size === 0;
    $("dock-count").textContent = `${selected.size} selected`;
    for (const id of ["expand-all", "collapse-all"]) $(id).disabled = view !== "cards" || !shown.length;
    $("select-shown").disabled = shown.length === 0;
    $("select-theme").disabled = !filters.theme || !items.some(item => item.themes.includes(filters.theme));
    $("select-story").disabled = !filters.story || !items.some(item => item.stories.includes(filters.story));
    $("undo").disabled = undo === null;
    for (const id of ["clear", "export-md", "export-csv", "share"]) $(id).disabled = selected.size === 0;
    $("cards-view").setAttribute("aria-pressed", String(view === "cards"));
    $("table-view").setAttribute("aria-pressed", String(view === "table"));
    $("cards").hidden = view !== "cards" || !shown.length;
    $("table").hidden = view !== "table" || !shown.length;
    $("empty").hidden = shown.length > 0;
    $("empty-title").textContent = !items.length ? "No verified announcements available yet" : "No announcements match this view";
    $("empty-text").textContent = !items.length ? (data.meta.sourceState === "pending" ?
      "The source is still a holding page. Theme and story selection are ready, but no older news or sample announcements have been added to this briefing." :
      "No announcement entries have been verified in this catalog. Review the coverage note and official source for current information.") :
      filters.selectedOnly ? "Your discussion list has no items matching these filters. Turn off Keep selected only or reset filters to browse all announcements." : "Try another theme or story, or reset filters to see all announcements.";
    $("empty-source").hidden = items.length > 0;
    if (view === "cards") { $("cards").replaceChildren(...shown.map(card)); $("table").replaceChildren(); }
    else { $("cards").replaceChildren(); renderTable(shown); }
    if (focusedId.startsWith("select-")) $(focusedId)?.focus();
  }
  for (const id of ["query", "story", "workload", "status", "audience", "sort"]) {
    $(id).addEventListener(id === "query" ? "input" : "change", event => { filters[id] = event.target.value; render(); });
  }
  $("filters").addEventListener("submit", event => event.preventDefault());
  $("filters").addEventListener("reset", () => {
    Object.assign(filters, { query: "", story: "", workload: "", status: "", audience: "both", sort: "source", theme: "", selectedOnly: false });
    render();
  });
  $("select-shown").addEventListener("click", () => changeSelection(new Set([...selected, ...visible().map(item => item.id)])));
  $("select-theme").addEventListener("click", () => selectEntireGroup("themes", filters.theme));
  $("select-story").addEventListener("click", () => selectEntireGroup("stories", filters.story));
  $("clear").addEventListener("click", () => changeSelection(new Set()));
  $("undo").addEventListener("click", () => { if (undo) { selected = undo; undo = null; persist(); render(); } });
  $("selected-only").addEventListener("click", () => { filters.selectedOnly = !filters.selectedOnly; render(); });
  $("dock-selected").addEventListener("click", () => { filters.selectedOnly = !filters.selectedOnly; render(); $("catalog").scrollIntoView(); });
  for (const [id, open] of [["expand-all", true], ["collapse-all", false]]) {
    $(id).addEventListener("click", () => {
      for (const item of visible()) { if (open) expanded.add(item.id); else expanded.delete(item.id); }
      for (const detail of document.querySelectorAll(".announcement details")) detail.open = open;
    });
  }
  for (const mode of ["cards", "table"]) $(`${mode}-view`).addEventListener("click", () => { view = mode; render(); });
  function download(extension, mime, content) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = node("a"); anchor.href = url; anchor.download = `ignite-2026-discussion.${extension}`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Downloaded ${selected.size} selected announcements. Discussion notes are included; review before sharing.`);
  }
  $("export-md").addEventListener("click", () => download("md", "text/markdown;charset=utf-8", exportMarkdown(selectedItems(), notes, filters.audience)));
  $("export-csv").addEventListener("click", () => download("csv", "text/csv;charset=utf-8", "\uFEFF" + exportCsv(selectedItems(), notes, filters.audience)));
  $("share").addEventListener("click", async () => {
    const url = new URL(location.href); url.hash = new URLSearchParams({ selected: [...selected].join(",") }).toString();
    try { await navigator.clipboard.writeText(url.href); notify("Share link copied. Only announcement IDs are included, never notes."); }
    catch (error) { console.error("Could not copy link", error); download("txt", "text/plain", url.href); notify("Clipboard access failed. The share link has been downloaded instead; notes are not included."); }
  });
  $("theme").addEventListener("click", () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  });
  $("present").addEventListener("click", event => { const active = document.documentElement.classList.toggle("present"); event.target.setAttribute("aria-pressed", String(active)); });
  $("print").addEventListener("click", () => window.print());
  let previouslyClosed = [];
  window.addEventListener("beforeprint", () => {
    previouslyClosed = [...document.querySelectorAll(".announcement details:not([open])")];
    for (const detail of previouslyClosed) detail.open = true;
  });
  window.addEventListener("afterprint", () => { for (const detail of previouslyClosed) detail.open = false; });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault(); $("query").focus();
    }
  });
  render();
}
try { main(); }
catch (error) {
  console.error("Briefing could not load", error);
  $("source-notice").textContent = "The briefing could not load because its catalog is invalid. No results can be trusted until the data is corrected. Please use the official Book of News.";
  $("source-notice").setAttribute("role", "alert");
}
