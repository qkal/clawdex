import { marked } from "marked";
import DOMPurify from "dompurify";

/** Render markdown to HTML. Uses marked for streaming-friendly rendering. */
export function renderMarkdown(text: string): string {
  const parsedHtml = marked.parse(text, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(parsedHtml);
}