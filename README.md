# Ignite 2026 | Insurance briefing

A static, self-contained GitHub Pages briefing for Farmers Insurance and Zurich Insurance Group, following the FabCon briefing's overview, catalog, customer relevance, discussion-list and source-methodology format.

## Current source limitation

On November 17, 2026 at 18:18 UTC, the [official 2026 Book of News](https://news.microsoft.com/events/ignite/2026/book-of-news/) was still a holding page. Both a direct fetch and a browser visit confirmed it. The catalog intentionally contains **zero announcements**, not sample content, prior-year news or FabCon entries. The published page clearly reports this limitation; it is **not yet the requested complete news compilation**.

Run `npm run source:check` to check the source again. This is a read-only check, not an automatic import or an assertion of completeness.

## Discussion workflow

- Browse by technology theme (including Copilot and Fabric) or insurance business story.
- **Select entire theme/story** adds every matching catalog announcement, independent of other active filters. Existing selections are kept and overlapping groups are deduplicated.
- **Select all shown** selects only the intersection of the current search, theme, story and availability filters.
- Use **Keep selected only**, individual checkboxes, clear and undo to refine the discussion.
- Switch between both organizations' perspectives or either customer individually.
- Use cards or a comparison table, local notes, Markdown/CSV downloads, ID-only share links, presenter view and printing.
- Share links restore the selected-only view. Unknown IDs are omitted with a visible warning.
- Exports include all selected items, even if current filters hide some; customer perspective follows the audience control.
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

For the optional browser tests, run `npm ci`, start the local preview, then `npm run test:e2e`. These use `playwright-core` with an installed Chrome (`CHROME_PATH` overrides the Windows default); no browser is downloaded. The browser test injects synthetic data into its own browser responses only, never the published catalog.

`src/page.html`, `src/styles.css`, `src/logic.mjs`, `src/app.mjs` and `data/announcements.json` generate `index.html`. The generated file has everything inlined, works offline (including by double-clicking), and is the only file deployed to Pages. Do not edit it manually.

## Completing the news compilation when published

1. Review the entire official Book of News. Record every numbered announcement section, in source order, in `meta.sourceSections`. This is a manual source inventory, not inferred from keyword matches.
2. Set `meta.sourceState` to `partial` while curating. Keep the coverage note explicit about gaps.
3. Add each announcement with these fields:
   - `id`: unique kebab-case ID, kept stable for saved/share selections.
   - `title`, `summary`: concise title and an original factual summary, not copied article prose.
   - `workload`, `section`: product/workload and exact source-inventory section identifier.
   - `themes`, `stories`: arrays of IDs from the existing taxonomies; multiple memberships are allowed.
   - `status`: `GA`, `Public preview`, `Private preview`, `Preview`, `Coming soon`, or `Not specified`. Do not infer public preview from unspecified "preview".
   - `availabilityEvidence`: describe what the source states and what remains unspecified. Do not invent dates, prerequisites or licenses.
   - `relevance`: `farmers` and `zurich` strings describing suggested, hypothetical use cases.
   - `nextStep`: an editorial validation/discussion step.
   - `sources`: an array of `{ "label": "...", "url": "https://..." }`. At least one exact Book of News URL with a section fragment is required.
4. Verify every source section is mapped and every announcement is included (split multi-feature sections when useful). Set `complete` only after a source-to-catalog audit. The schema checks consistency, **not whether an editor omitted a source section**.
5. Update `meta.checkedAt` to the actual verification time and `meta.coverageNote` with scope/gaps. Rebuild, test and verify the browser; commit the data and generated page together.

Synthetic test fixtures live only under `tests/`; they are not shipped. Test fixtures exercise populated catalog behavior while the real source is pending.

## GitHub Pages

The workflow builds, tests, checks for stale generated output and deploys only the single HTML file on pushes to `main`. Enable **Settings > Pages > Source: GitHub Actions**. The resulting page is public, even though it requests `noindex`; this is not access control.

No analytics, third-party scripts, external fonts or external requests on page load. Source links open the public Microsoft site only when clicked. Independent discussion aid; not an official publication of Microsoft or either insurance organization.
