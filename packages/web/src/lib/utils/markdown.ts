import { marked } from "marked";

/** Render markdown to HTML. Uses marked for streaming-friendly rendering. */
export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false, breaks: true }) as string;
}
