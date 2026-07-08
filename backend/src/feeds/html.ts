/**
 * Minimal, dependency-free HTML -> plain text sanitizer for show-note soup
 * (corner case 5): CDATA-wrapped HTML, tracking pixels, stray entities.
 * Not a rendering engine — good enough to hand clean text to an LLM or to
 * display safely. Strips script/style bodies entirely, drops all tags,
 * decodes common entities, and collapses whitespace.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“"
};

/**
 * Decodes named + numeric (decimal and hex) HTML/XML entities. Exported
 * separately from sanitizeHtmlToText because titles need entity decoding
 * too but must NOT go through tag-stripping/whitespace-collapsing — see
 * corner case finding in fixtures/feeds/README.md: fast-xml-parser does
 * not decode numeric character references (e.g. WordPress/PowerPress
 * feeds emitting "&#038;" for a literal "&" in episode titles) even with
 * its default entity-processing options, since those only cover the five
 * predefined named XML entities.
 */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

export function sanitizeHtmlToText(input: string | null | undefined): string {
  if (!input) return "";

  let text = input;

  // Drop tracking pixels and other zero-content tags outright, and script/style bodies.
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<img[^>]*>/gi, " ");

  // Convert common block-ish tags to line breaks before stripping, so
  // paragraphs don't run together into one word-soup line.
  text = text.replace(/<\/(p|div|br|li|h[1-6])\s*>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Strip all remaining tags.
  text = text.replace(/<[^>]*>/g, " ");

  text = decodeEntities(text);

  // Collapse whitespace: multiple spaces -> one, multiple blank lines -> one.
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1] !== ""))
    .join("\n")
    .trim();

  return text;
}
