import { describe, it, expect } from "vitest";
import { sanitizeHtmlToText } from "../src/feeds/html";

describe("sanitizeHtmlToText", () => {
  it("returns empty string for null/undefined", () => {
    expect(sanitizeHtmlToText(null)).toBe("");
    expect(sanitizeHtmlToText(undefined)).toBe("");
  });

  it("strips paragraph tags and preserves line breaks", () => {
    const out = sanitizeHtmlToText("<p>First</p><p>Second</p>");
    expect(out).toContain("First");
    expect(out).toContain("Second");
    expect(out).not.toContain("<p>");
  });

  it("strips tracking pixel img tags entirely", () => {
    const out = sanitizeHtmlToText('Hello <img src="https://track.example.com/pixel.gif"/> world');
    expect(out).not.toContain("img");
    expect(out).not.toContain("track.example.com");
    expect(out).toContain("Hello");
    expect(out).toContain("world");
  });

  it("removes script and style blocks entirely, including their content", () => {
    const out = sanitizeHtmlToText("<style>.x{color:red}</style>Visible<script>alert(1)</script>");
    expect(out).not.toContain("color:red");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("Visible");
  });

  it("decodes common HTML entities", () => {
    const out = sanitizeHtmlToText("Fish &amp; Chips &mdash; &lsquo;great&rsquo;");
    expect(out).toBe("Fish & Chips — ‘great’");
  });

  it("decodes numeric entities", () => {
    expect(sanitizeHtmlToText("&#65;&#66;&#x43;")).toBe("ABC");
  });

  it("collapses excess whitespace", () => {
    const out = sanitizeHtmlToText("Hello    world\n\n\n\nagain");
    expect(out).not.toMatch(/ {2,}/);
  });

  it("handles plain text with no HTML unchanged (aside from trimming)", () => {
    expect(sanitizeHtmlToText("  Just plain text  ")).toBe("Just plain text");
  });
});
