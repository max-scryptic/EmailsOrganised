import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function UsageMeter() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Usage</CardTitle>
        <p className="text-sm text-muted-foreground">
          Standard billing components for quota-backed SaaS products.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {[
          { label: "API calls", value: 68, caption: "68,240 of 100,000" },
          { label: "Team seats", value: 44, caption: "11 of 25" },
          { label: "Storage", value: 22, caption: "44GB of 200GB" },
        ].map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground">{item.caption}</span>
            </div>
            <Progress value={item.value} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
