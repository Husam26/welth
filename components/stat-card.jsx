import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Unified KPI tile: label, big tabular figure, optional icon + delta.
export default function StatCard({ label, value, icon: Icon, hint, tone = "default", className }) {
  const toneClass = {
    default: "text-foreground",
    positive: "text-positive",
    negative: "text-negative",
    primary: "text-primary",
  }[tone];

  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
        </div>
        <p className={cn("mt-2 text-2xl font-semibold tracking-tight nums", toneClass)}>
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
