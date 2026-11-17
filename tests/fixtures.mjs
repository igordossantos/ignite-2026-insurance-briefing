export function fixture() {
  const item = (id, themes, stories) => ({
    id, title: `Synthetic test ${id}`, summary: "Test-only factual summary.",
    details: ["Synthetic detailed feature for testing."],
    workload: "Test workload", section: `1.1.${id}`, themes, stories,
    status: "Not specified", availabilityEvidence: "The test source does not specify availability.",
    relevance: { farmers: "Consider a test claims discussion.", zurich: "Consider a test risk discussion." },
    nextStep: "Validate the test scenario.",
    sources: [{ label: "Synthetic section link", url: `https://news.microsoft.com/events/ignite/2026/book-of-news/#${id}` }]
  });
  const announcements = [
    item("alpha", ["copilot", "agents"], ["claims"]),
    item("beta", ["fabric", "copilot"], ["data", "claims"]),
    item("gamma", ["fabric"], ["data"])
  ];
  return {
    meta: {
      sourceState: "complete", sourceUrl: "https://news.microsoft.com/events/ignite/2026/book-of-news/",
      checkedAt: "2026-11-17T18:18:03Z", coverageNote: "Synthetic fixtures for testing only.",
      sourceSections: announcements.map(item => item.section)
    },
    themes: ["copilot", "fabric", "agents"].map(id => ({ id, name: id, description: `Test ${id}` })),
    stories: ["claims", "data"].map(id => ({ id, name: id, description: `Test ${id}` })),
    announcements
  };
}
