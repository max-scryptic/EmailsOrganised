export type AuthResult = {
  title: string;
  description: string;
};

type SignInInput = {
  email: string;
  password: string;
};

type SignUpInput = SignInInput & {
  name: string;
};

type EmailInput = {
  email: string;
};

type PasswordInput = {
  password: string;
  currentPassword?: string;
};

const MOCK_SESSION_KEY = "base-repo-template-session";

function delay(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRedirectUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}

function persistMockSession(email: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    MOCK_SESSION_KEY,
    JSON.stringify({ email, signedInAt: new Date().toISOString() }),
  );
}

export const authAdapter = {
  async signIn({ email }: SignInInput): Promise<AuthResult> {
    await delay();
    persistMockSession(email);

    return {
      title: "Signed in",
      description:
        "Mock session created. Swap this call for supabase.auth.signInWithPassword when the backend is ready.",
    };
  },

  async signUp({ email }: SignUpInput): Promise<AuthResult> {
    await delay();

    return {
      title: "Check your inbox",
      description: `Mock account created for ${email}. Supabase signUp can redirect confirmed users back to /auth/sign-in.`,
    };
  },

  async requestPasswordReset({ email }: EmailInput): Promise<AuthResult> {
    await delay();
    void email;

    return {
      title: "Reset link requested",
      description:
        "If an account exists for that email, Supabase should send a reset link to /auth/reset-password.",
    };
  },

  async resetPassword({ password }: PasswordInput): Promise<AuthResult> {
    await delay();
    void password;

    return {
      title: "Password updated",
      description:
        "This maps to supabase.auth.updateUser({ password }) after a recovery link creates a valid session.",
    };
  },

  async changePassword({
    currentPassword,
    password,
  }: PasswordInput): Promise<AuthResult> {
    await delay();
    void currentPassword;
    void password;

    return {
      title: "Password changed",
      description:
        "This maps to supabase.auth.updateUser({ password, current_password }) for signed-in users.",
    };
  },

  async resendVerification({ email }: EmailInput): Promise<AuthResult> {
    await delay();

    return {
      title: "Verification email requested",
      description: `Mock verification sent to ${email}. A Supabase implementation can call resend with an email signup type.`,
    };
  },

  resetRedirectUrl: getRedirectUrl("/auth/reset-password"),
  signInRedirectUrl: getRedirectUrl("/auth/sign-in"),
};
