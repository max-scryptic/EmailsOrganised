import Link from "next/link";
import { ArrowRight, CreditCard, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BillingPortalButton } from "@/components/billing/billing-portal-button";
import { UsageMeter } from "@/components/pricing/usage-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatRenewal, statusLabel } from "@/lib/billing/format";
import { getSubscription } from "@/lib/billing/server";
import { requireUser } from "@/lib/auth/session";
import {
  invoices,
  paymentMethod,
  plans,
  settingsSections,
} from "@/lib/template-data";

export default async function SettingsPage() {
  const [user, subscription] = await Promise.all([
    requireUser(),
    getSubscription(),
  ]);
  const currentPlan = plans.find((plan) => plan.id === subscription.planId);

  return (
    <AppShell
      title="Settings"
      description="Reusable profile, billing, and payment settings with predictable save flows."
      actions={
        <Button type="button">
          <Save className="size-4" />
          Save changes
        </Button>
      }
    >
      <Tabs defaultValue="user" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 md:inline-grid md:grid-cols-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;

            return (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="px-3"
              >
                <Icon className="size-4" />
                {section.title}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="user">
          <Card>
            <CardHeader>
              <CardTitle>User</CardTitle>
              <p className="text-sm text-muted-foreground">
                Personal details and notification preferences.
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue={user.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={user.email} readOnly />
                <p className="text-xs text-muted-foreground">
                  Managed by the Google account you sign in with.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Mailbox</Label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={user.gmailConnected ? "outline" : "destructive"}>
                    {user.gmailConnected ? "Connected" : "Not connected"}
                  </Badge>
                  {user.gmailConnected ? (
                    <span>
                      We can read, draft, and send on your behalf. Revoke any
                      time from your Google account.
                    </span>
                  ) : (
                    <span>
                      Sign in again to grant mailbox access.{" "}
                      <Link
                        href="/auth/sign-in"
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        Reconnect
                      </Link>
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  defaultValue="Building reusable SaaS foundations."
                />
              </div>
              <Separator className="md:col-span-2" />
              <SettingSwitch
                title="Product updates"
                description="Receive account and feature emails."
              />
              <SettingSwitch
                title="Security alerts"
                description="Notify me about login and API-key events."
                defaultChecked
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="billing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Plan
                <Badge variant="outline">
                  {statusLabel(subscription.status)}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {currentPlan
                  ? `${currentPlan.name} · $${currentPlan.price}/mo · ${formatRenewal(subscription)}`
                  : "No active subscription. Pick a plan to get started."}
              </p>
              <CardAction>
                <Button type="button" variant="outline" asChild>
                  <Link href="/plans">
                    Manage plans
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
          <UsageMeter />
          <Card>
            <CardHeader>
              <CardTitle>Billing controls</CardTitle>
              <p className="text-sm text-muted-foreground">
                Billing contacts and usage guardrails.
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="billing-email">Billing email</Label>
                <Input id="billing-email" defaultValue="finance@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax ID</Label>
                <Input id="tax-id" placeholder="Optional" />
              </div>
              <SettingSwitch
                title="Spend alerts"
                description="Send alerts when usage reaches 80% of quota."
                defaultChecked
              />
              <SettingSwitch
                title="Automatic upgrades"
                description="Move to the next tier when quota is exceeded."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="size-5" />
                Payment method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4">
                <div className="font-medium">{paymentMethod.label}</div>
                <p className="text-sm text-muted-foreground">
                  {paymentMethod.expires}
                </p>
              </div>
              {/* Card details never touch this app: the provider's hosted
                  portal owns them, which keeps PCI scope out of the codebase. */}
              <BillingPortalButton label="Update payment method" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Invoices</CardTitle>
              <BillingPortalButton label="Download invoices" />
            </CardHeader>
            <CardContent className="divide-y rounded-md border">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{invoice.id}</div>
                    <p className="text-sm text-muted-foreground">
                      {invoice.period}
                    </p>
                  </div>
                  <Badge variant="outline">{invoice.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function SettingSwitch({
  title,
  description,
  defaultChecked,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-4">
      <div>
        <div className="font-medium">{title}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
