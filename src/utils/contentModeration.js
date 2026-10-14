// Free, local content moderation — no external API, no AI, no API key.
// Deliberately keyword-based rather than ML-based: it can't catch everything
// a paid moderation API would, but it costs nothing to run and blocks the
// two categories this product explicitly doesn't want (sexual content,
// political campaigning) from job posts.
//
// Word lists are matched on whole words/phrases (\b boundaries) so they
// don't trip on innocent substrings — e.g. the word list never matches
// "class", "assistant", "grass", etc.

const SEXUAL_TERMS = [
  "sex",
  "sexual",
  "nude",
  "nudity",
  "naked",
  "porn",
  "pornographic",
  "escort",
  "erotic",
  "fetish",
  "nsfw",
  "onlyfans",
  "hookup",
  "prostitut\\w*",
  "xxx",
];

// Generic political-campaigning language plus the major Zimbabwean party
// names/abbreviations, since this marketplace is Zimbabwe/Africa-focused.
// Deliberately broad on campaigning verbs ("vote for", "rally for") rather
// than politician names, which would be far more prone to false positives
// and would need constant upkeep.
const POLITICAL_TERMS = [
  "zanu[- ]?pf",
  "\\bmdc\\b",
  "\\bccc\\b",
  "political party",
  "political campaign",
  "election campaign",
  "campaign rally",
  "vote for \\w+",
  "rally for \\w+",
  "presidential candidate",
  "ruling party",
  "opposition party",
  "regime change",
];

function buildMatcher(terms) {
  return new RegExp(`\\b(${terms.join("|")})\\b`, "i");
}

const SEXUAL_PATTERN = buildMatcher(SEXUAL_TERMS);
const POLITICAL_PATTERN = buildMatcher(POLITICAL_TERMS);

/**
 * Checks one piece of free text. Returns `{ ok: true }` or
 * `{ ok: false, category, message }`.
 */
export function moderateText(text) {
  const value = typeof text === "string" ? text : "";
  if (!value.trim()) {
    return { ok: true };
  }

  if (SEXUAL_PATTERN.test(value)) {
    return {
      ok: false,
      category: "sexual",
      message: "This post can't include sexual content.",
    };
  }

  if (POLITICAL_PATTERN.test(value)) {
    return {
      ok: false,
      category: "political",
      message: "This post can't include political campaigning or party-affiliated content.",
    };
  }

  return { ok: true };
}

/**
 * Checks every free-text field a client fills in when posting a job.
 * Returns the first violation found, or `{ ok: true }` if the post is clean.
 */
export function moderateJobPost({ serviceType, specialistChoice, additionalInfo } = {}) {
  for (const field of [serviceType, specialistChoice, additionalInfo]) {
    const result = moderateText(field);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}
