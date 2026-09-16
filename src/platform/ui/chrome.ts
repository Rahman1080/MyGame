import { ICON_FLAME } from "../../ui/icons";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function streakPill(streak: number): string {
  return `<span class="stat amber">${ICON_FLAME}${streak} DAY</span>`;
}
