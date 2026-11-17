# Ignite 2026 | Insurance briefing

A static, self-contained GitHub Pages briefing for Farmers Insurance and Zurich Insurance Group, following the FabCon briefing's overview, catalog, customer relevance, discussion-list and source-methodology format.

## Published source coverage

The [live briefing](https://igordossantos.github.io/ignite-2026-insurance-briefing/) includes **all 59 numbered announcements** in the [published 2026 Book of News](https://news.microsoft.com/events/ignite/2026/book-of-news/), reviewed November 17, 2026. Every entry is matched to the rendered source's numbered table of contents and exact section fragment. The precise verification timestamp is in `meta.checkedAt`.

There is one card per numbered item, with an original summary, factual subfeature highlights, availability evidence and separate potential relevance for each insurer. Overlapping IQ/Foundry and Agent 365 source stories are preserved rather than silently omitted. Counts represent source items, not distinct product releases. A compact descriptive header, stat tiles, six-theme executive overview, catalog, insurer stories and source methodology follow the previous [FabCon briefing](https://igordossantos.github.io/fabcon-barcelona-2026-briefing/).

`data/source-inventory.json` is the independently captured reference for coverage tests. It records source section identities and titles, not full source articles. The raw source and instant-summary variants are not shipped.

Availability is conservative: multi-feature items use **Mixed availability**, Frontier remains program-gated, and future previews are not presented as available now. Contradictions in Fabric IQ, Work IQ and Windows container availability are explicitly flagged. The Cosmos DB count discrepancy and Dynamics plugin learn-more mismatch are also recorded. GA does not override separately stated preview dependencies.

## Ignite blog and linked reading

The [Ignite 2026 keynote blog](https://blogs.microsoft.com/blog/2026/11/17/ignite-2026-building-the-frontier-ecosystem/) adds six original topic summaries, separate potential insurance lenses and links to matching Book of News sections. Its five direct editorial destinations are included: the Ignite event site, embedded Workspaces video, Book of News and two related background articles published November 12 and October 27. Navigation, social sharing, author/tag archives and image assets are excluded; links from the background articles are not recursively cataloged.

`data/blog.json` records the reviewed material, exact destinations, publication/review dates and source-section mappings. At build time, the keynote source is appended once to each mapped announcement's sources, including table view and exports. The numbered catalog remains 59 items; keynote-only points such as MAI Licensed Weights and the AI Transparency Initiative are explicitly labeled context, not fabricated numbered releases. More specific Book of News availability remains authoritative, including Foundry private-preview restrictions and Perception's per-feature exceptions. The AI Transparency Initiative is not confused with AI Readiness Initiatives.

The video is an external link, not an embedded player. Earlier background articles and third-party customer outcomes are not presented as new Ignite announcements, insurer deployments or promised results.

## Discussion workflow

- Browse by technology theme (including Copilot and Fabric) or insurance business story.
- **Start with an Insurance Industry story** preserves the insurance-story grid and customer perspectives. **Start with a technology story** provides one card per catalog theme, with matching counts, browsing and whole-theme selection. Both sections start expanded and collapse independently using the arrow on the left of each heading.
- Click any announcement title or its visible **Read announcement** link to open that item's exact Book of News section in a new tab. Source links remain available inside expanded details and in table view.
- Filter by workload, availability and audience; search includes detailed subfeatures and availability evidence.
- **Select entire theme/story** adds every matching catalog announcement, independent of other active filters. Existing selections are kept and overlapping groups are deduplicated.
- **Select all shown** selects only the intersection of the current search, theme, story and availability filters.
- Use **Keep selected only**, individual checkboxes, clear and undo to refine the discussion.
- Switch between both organizations' perspectives or either customer individually.
- Choose **Farmers theme** (pink) or **Zurich theme** (blue and white) in the header instead of light/dark mode. The choice is remembered in this browser, defaults to Farmers and is independent of audience filters, selected announcements and notes.
- Company artwork comes from the supplied project images: the Farmers group/sign image and Zurich logo. Copies in `assets/` are embedded by the build, so switching palettes works offline and makes no external image requests. These are discussion-page palettes, not a claim of official brand certification.
- Use cards or a comparison table, local notes, Markdown/CSV downloads, ID-only share links, presenter view and printing.
- Expand card details to read subfeatures, availability/caveats and add notes. Expand/collapse-all controls apply to shown cards; a floating selection bar opens selected-only mode or discussion/export tools.
- Share links restore the selected-only view. Unknown IDs are omitted with a visible warning.
- Exports include all selected items, even if current filters hide some; customer perspective follows the audience control.
- Both export formats retain subfeature highlights, availability evidence and source caveats.
- Selections/notes are browser-local. Downloads contain notes; share links do not. Storage failures are reported. Do not enter sensitive information.

The theme/story labels and potential customer perspectives are editorial lenses, not claims about Microsoft announcements or either customer's strategy, deployments or results. Availability must be recorded conservatively, with evidence. No savings, performance or compliance claims are made.

## Build and preview

Node.js 24+; no runtime dependencies, API keys or build services required. Building and unit tests need no package installation.

```powershell
npm run build
npm test
npm run serve
# http://127.0.0.1:8086
npm run source:check
```

For the optional browser tests, run `npm ci` on a fresh checkout, start the local preview, then `npm run test:e2e`. These use `playwright-core` with an installed Chrome (`CHROME_PATH` overrides the Windows default); no browser is downloaded. Tests verify all real entries, exact Copilot/Fabric selection membership, detailed search, workload filtering, expansion and mobile layout. Additional edge-case tests inject synthetic data into browser responses only, never the published catalog. Set `BASE_URL` to test the deployed page.

`src/page.html`, `src/styles.css`, `src/logic.mjs`, `src/app.mjs`, `data/announcements.json`, `data/blog.json` and the company artwork in `assets/` generate `index.html`. The generated file has everything inlined, works offline (including by double-clicking), and is the only file deployed to Pages. Do not edit it manually.

## Updating the compilation

1. Capture the rendered official source with `node tools\inventory-source.mjs <source-url> <review-json-output>`. This requires the optional browser-test dependency and Chrome. Section numbers/anchors are assigned by the source's JavaScript; raw HTTP HTML is insufficient. The extractor omits duplicate instant summaries, checks both directions of numbered contents coverage and fails on missing/duplicate identities. Keep the full-content review file outside the public repository.
2. Compare the captured identities/titles with `data/source-inventory.json`, review every changed/new item and update the committed inventory. Do not generate the reference inventory from the announcement catalog.
3. Set `meta.sourceState` to `partial` while curating. Keep the coverage note explicit about gaps.
4. Update each announcement with these fields:
   - `id`: unique kebab-case ID, kept stable for saved/share selections.
   - `title`, `summary`: concise title and an original factual summary, not copied article prose.
   - `details`: nonempty array of original factual subfeature highlights; `discrepancy` optionally explains conflicting source statements.
   - `workload`, `section`: product/workload and exact source-inventory section identifier.
   - `themes`, `stories`: arrays of IDs from the existing taxonomies; multiple memberships are allowed.
   - `status`: `GA`, `Mixed availability`, `Public preview`, `Private preview`, `Preview`, `Frontier`, `Rolling out`, `Preview coming soon`, `Coming soon`, or `Not specified`. Do not infer public preview from unspecified "preview".
   - `availabilityEvidence`: describe what the source states and what remains unspecified. Do not invent dates, prerequisites or licenses.
   - `relevance`: `farmers` and `zurich` strings describing suggested, hypothetical use cases.
   - `nextStep`: an editorial validation/discussion step.
   - `sources`: an array of `{ "label": "...", "url": "https://..." }`. At least one exact Book of News URL with a section fragment is required.
5. Keep one card per numbered source item, in source order. Verify catalog IDs, titles and exact fragment URLs against the independent inventory and numbered contents. Update the audited test count if the source genuinely adds/removes an item. Set `complete` only after this audit; a live recheck is needed to detect source changes outside the committed snapshot.
6. Update `meta.checkedAt` to the actual verification time and `meta.coverageNote` with scope/gaps. Rebuild, test and verify the browser; commit inventory, data and generated page together.
7. When reviewing the keynote or its direct links, update `data/blog.json` and its actual `checkedAt`. Keep summaries original, background dates explicit and topic section references restricted to verified catalog sections. Review the rendered article's editorial links and video destination, not just site-wide navigation. Do not change product availability based only on broader keynote wording.

Run `npm run source:check` for a lightweight holding-page/publication check. It is not an import or a completeness audit. Synthetic test fixtures live only under `tests/`; they are not shipped.

## GitHub Pages

The workflow builds, tests, checks for stale generated output and deploys only the single HTML file on pushes to `main`. Enable **Settings > Pages > Source: GitHub Actions**. The resulting page is public, even though it requests `noindex`; this is not access control.

No analytics, third-party scripts, external fonts or external requests on page load. External source sites, including the linked video, open only when clicked. Independent discussion aid; not an official publication of Microsoft or either insurance organization.
