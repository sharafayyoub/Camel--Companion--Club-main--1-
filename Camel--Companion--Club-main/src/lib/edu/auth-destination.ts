/** Only same-app destinations can be resumed after sign-in. */
export function authDestination(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/panel";
  try {
    const url = new URL(value, "https://edupulse.invalid");
    if (
      url.origin !== "https://edupulse.invalid" ||
      ["/auth", "/reset-password"].includes(url.pathname)
    )
      return "/panel";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/panel";
  }
}
