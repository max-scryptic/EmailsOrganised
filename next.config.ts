import type { NextConfig } from "next";

const authRedirectSources = [
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/change-password",
  "/auth/verify",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async redirects() {
    // Google SSO is the only way in, so the template's password flows are gone.
    // Anything still linking to them lands on sign-in rather than a 404.
    // `/auth/sign-up` is deliberately not in this list: sign-up is a real page
    // again, because visitors look for the word even when the flow behind it is
    // the same single OAuth call.
    return [
      {
        source: "/workflows",
        destination: "/",
        permanent: false,
      },
      ...authRedirectSources.map((source) => ({
        source,
        destination: "/auth/sign-in",
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
