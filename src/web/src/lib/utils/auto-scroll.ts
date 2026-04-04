/**
 * Check if a scrollable element is near the bottom.
 * Returns true if within `threshold` pixels of the bottom.
 */
export function isNearBottom(el: HTMLElement, threshold = 100): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el;
  return scrollHeight - scrollTop - clientHeight < threshold;
}

/** Scroll element to the bottom smoothly. */
export function scrollToBottom(el: HTMLElement, smooth = true): void {
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? "smooth" : "instant",
  });
}
