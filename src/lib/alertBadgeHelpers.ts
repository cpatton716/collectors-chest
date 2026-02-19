export function getAlertBadgeColor(
  level: "ok" | "warning" | "critical"
): string {
  switch (level) {
    case "critical":
      return "bg-pop-red";
    case "warning":
      return "bg-pop-yellow text-pop-black";
    case "ok":
      return "";
  }
}
