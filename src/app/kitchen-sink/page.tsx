import { Inbox, Settings, ShieldAlert, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BrandLockup, BrandMark } from "@/components/brand-logo";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { appConfig } from "@/lib/template-data";

export default function KitchenSinkPage() {
  return (
    <AppShell
      title="Kitchen sink"
      description="A compact QA route for checking tokens, primitives, composites, and light/dark behavior."
    >
      <Tabs defaultValue="primitives" className="space-y-4">
        <TabsList className="grid h-auto grid-cols-3 md:inline-grid">
          <TabsTrigger value="primitives">Primitives</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
        </TabsList>
        <TabsContent value="primitives" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <BrandMark className="size-14" />
              <BrandMark />
              <BrandMark className="size-5" />
              <Separator
                orientation="vertical"
                className="hidden h-10 sm:block"
              />
              <BrandLockup />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Buttons and badges</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Separator orientation="vertical" className="hidden h-8 sm:block" />
              <Badge>Active</Badge>
              <Badge variant="secondary">Trialing</Badge>
              <Badge variant="destructive">Past due</Badge>
              <Badge variant="outline">Draft</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Command menu and dialog</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <Command className="rounded-md border">
                <CommandInput placeholder="Search commands..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup heading="Actions">
                    <CommandItem>
                      <UserPlus />
                      Invite teammate
                      <CommandShortcut>⌘I</CommandShortcut>
                    </CommandItem>
                    <CommandItem>
                      <Settings />
                      Open settings
                      <CommandShortcut>⌘,</CommandShortcut>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Danger zone">
                    <CommandItem>
                      <ShieldAlert />
                      Review security alerts
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
              <div className="flex items-center">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reusable dialog</DialogTitle>
                      <DialogDescription>
                        Keep transactional dialogs short and move complex edits
                        into a sheet or full page.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="forms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form controls</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sink-name">Name</Label>
                <Input id="sink-name" defaultValue={appConfig.name} />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select defaultValue="pro">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="scale">Scale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="sink-notes">Notes</Label>
                <Textarea id="sink-notes" defaultValue="Use semantic tokens." />
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="sink-terms" defaultChecked />
                <Label htmlFor="sink-terms" className="font-normal">
                  Enabled by default
                </Label>
              </div>
              <div className="flex items-center justify-between rounded-md border p-4">
                <div>
                  <div className="font-medium">Automations</div>
                  <p className="text-sm text-muted-foreground">
                    Switches for binary settings.
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="states" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <EmptyState
              icon={Inbox}
              title="No customers yet"
              description="Use empty states to explain what appears here after the first real action."
            />
            <LoadingState />
            <Card>
              <CardHeader>
                <CardTitle>Skeleton stack</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-24 w-full" />
                <Progress value={64} />
              </CardContent>
            </Card>
          </div>
          <ErrorState />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
