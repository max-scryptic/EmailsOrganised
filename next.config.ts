import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async redirects() {
    // Google SSO is the only way in, so the template's password flows are gone.
    // Anything still linking to them lands on sign-in rather than a 404.
    return [
      "/auth/sign-up",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/change-password",
      "/auth/verify",
    ].map((source) => ({
      source,
      destination: "/auth/sign-in",
      permanent: false,
    }));
  },
};

export default nextConfig;
