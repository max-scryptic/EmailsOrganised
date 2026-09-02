import { CreditCard, Home, ReceiptText, UserRound } from "lucide-react";

export const appConfig = {
  name: "EmailsOrganised",
  description: "Inbox triage that keeps every team's email organised.",
};

export const appNavItems = [{ title: "Dashboard", href: "/", icon: Home }];

export const settingsSections = [
  { title: "User", value: "user", icon: UserRound },
  { title: "Billing", value: "billing", icon: CreditCard },
  { title: "Payments & Invoices", value: "payments", icon: ReceiptText },
];

export const currentUser = {
  name: "Max Winter",
  email: "max@example.com",
  avatar: "",
  initials: "MW",
};

export const paymentMethod = {
  label: "Visa ending in 4242",
  expires: "Expires 08/2029",
};

export const invoices = [
  { id: "INV-0042", period: "September 2026", status: "Paid" },
  { id: "INV-0041", period: "August 2026", status: "Paid" },
  { id: "INV-0040", period: "July 2026", status: "Paid" },
];

export type Customer = {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Pro" | "Scale";
  status: "Active" | "Trialing" | "Past due";
  mrr: number;
};

export const customers: Customer[] = [
  {
    id: "cus_1048",
    name: "Northstar Labs",
    email: "ops@northstar.test",
    plan: "Scale",
    status: "Active",
    mrr: 2400,
  },
  {
    id: "cus_1049",
    name: "Atlas Studio",
    email: "finance@atlas.test",
    plan: "Pro",
    status: "Trialing",
    mrr: 499,
  },
  {
    id: "cus_1050",
    name: "Beacon Health",
    email: "admin@beacon.test",
    plan: "Scale",
    status: "Active",
    mrr: 1800,
  },
  {
    id: "cus_1051",
    name: "Lumen Works",
    email: "team@lumen.test",
    plan: "Free",
    status: "Past due",
    mrr: 0,
  },
  {
    id: "cus_1052",
    name: "Papertrail AI",
    email: "founders@papertrail.test",
    plan: "Pro",
    status: "Active",
    mrr: 499,
  },
];

export const metrics = [
  { label: "Monthly recurring revenue", value: "$5,198", delta: "+12.4%" },
  { label: "Active customers", value: "1,284", delta: "+8.1%" },
  { label: "Trial conversion", value: "18.6%", delta: "+3.2%" },
  { label: "Churn risk", value: "2.1%", delta: "-0.9%" },
];

export type PlanId = "starter" | "pro" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
  /** Plans that need a sales conversation instead of a self-serve switch. */
  contactSales?: boolean;
};

/** Ordered cheapest to most expensive so upgrade/downgrade can be derived. */
export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    description: "For validating the first paid workflow.",
    features: ["1 workspace", "5 team seats", "Basic analytics", "Email support"],
    cta: "Start",
  },
  {
    id: "pro",
    name: "Pro",
    price: 79,
    description: "For teams running the product every day.",
    features: [
      "3 workspaces",
      "25 team seats",
      "Usage reporting",
      "Priority support",
    ],
    cta: "Upgrade",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 249,
    description: "For multi-team products with tighter controls.",
    features: ["Unlimited workspaces", "SSO", "Audit log", "Dedicated support"],
    cta: "Contact sales",
    contactSales: true,
  },
];

/** UI-only placeholder until a billing provider owns subscription state. */
export const currentPlanId: PlanId = "pro";

/** ISO so it matches the shape a provider returns. Rendered via `formatRenewal`. */
export const planRenewalDate = "2026-10-01T00:00:00.000Z";
