/**
 * The post-auth destination, normalised.
 *
 * `next` is attacker-controllable — Proxy puts it on the URL, but so can anyone
 * handing out a link — and it ends up in a hidden form field, in the OAuth
 * `redirectTo`, and in the href that swaps between sign-in and sign-up. Only
 * relative in-app paths survive: anything absolute (`https://…`) or
 * protocol-relative (`//evil.example`) collapses to "/" rather than becoming an
 * open redirect.
 */
export function safeNextParam(next: string | string[] | undefined) {
  const value = typeof next === "string" ? next : undefined;

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
