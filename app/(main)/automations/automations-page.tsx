"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AUTOMATION_DEFINITIONS } from "@/lib/automations";
import {
  formatDuration,
  formatRelativeTime,
  formatRunTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  Loader2,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";

export function AutomationsPage() {
  const runs = useQuery(api.automations.getAutomationRuns);

  const successCount =
    runs?.filter((run) => run.status === "success").length ?? 0;
  const failedCount = runs?.filter((run) => run.status === "failed").length ?? 0;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          Background jobs that keep your notes indexed and searchable. Each run is
          logged with timing, status, and how many notes were updated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {AUTOMATION_DEFINITIONS.map((automation) => {
          const automationRuns =
            runs?.filter((run) => run.automationKey === automation.key) ?? [];
          const lastRun = automationRuns[0];
          const lastSuccess = automationRuns.find(
            (run) => run.status === "success"
          );

          return (
            <div
              key={automation.key}
              data-slot="card"
              className="bg-card rounded-xl border border-border/50 p-5 shadow-xs"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                  <Zap className="size-4" />
                </div>
                <Badge variant="secondary" className="font-normal">
                  {automation.trigger}
                </Badge>
              </div>
              <h2 className="mb-1 text-base font-medium">{automation.name}</h2>
              <p className="text-muted-foreground mb-4 text-base leading-relaxed">
                {automation.description}
              </p>
              <div className="text-muted-foreground flex items-center justify-between text-sm">
                <span>{automationRuns.length} total runs</span>
                <span>
                  {lastSuccess
                    ? `Last success ${formatRelativeTime(lastSuccess.startedAt)}`
                    : lastRun
                      ? `Last run ${formatRelativeTime(lastRun.startedAt)}`
                      : "No runs yet"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div
        data-slot="card"
        className="bg-card overflow-hidden rounded-xl border border-border/50 shadow-xs"
      >
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div>
            <h2 className="text-base font-medium">Run history</h2>
            <p className="text-muted-foreground text-sm">
              Recent automation executions across your workspace
            </p>
          </div>
          {runs !== undefined && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {successCount} succeeded
              </Badge>
              {failedCount > 0 && (
                <Badge variant="outline" className="font-normal">
                  {failedCount} failed
                </Badge>
              )}
            </div>
          )}
        </div>

        {runs === undefined ? (
          <RunHistorySkeleton />
        ) : runs.length === 0 ? (
          <EmptyRunHistory />
        ) : (
          <div className="divide-y divide-border/50">
            {runs.map((run) => (
              <RunHistoryRow key={run._id} run={run} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RunHistoryRow({ run }: { run: Doc<"automationRuns"> }) {
  return (
    <div className="hover:bg-muted/30 flex flex-col gap-3 px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={run.status} />
          <span className="text-base font-medium">{run.automationName}</span>
        </div>
        {run.message && (
          <p className="text-muted-foreground line-clamp-2 text-base">
            {run.message}
          </p>
        )}
      </div>

      <div className="text-muted-foreground grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-sm sm:text-right">
        <div>
          <p className="text-foreground/70 mb-0.5 font-medium">Started</p>
          <p title={formatRunTime(run.startedAt)}>
            {formatRelativeTime(run.startedAt)}
          </p>
        </div>
        <div>
          <p className="text-foreground/70 mb-0.5 font-medium">Duration</p>
          <p>{formatDuration(run.startedAt, run.completedAt)}</p>
        </div>
        <div>
          <p className="text-foreground/70 mb-0.5 font-medium">Notes updated</p>
          <p>{run.notesUpdated}</p>
        </div>
        <div>
          <p className="text-foreground/70 mb-0.5 font-medium">Finished</p>
          <p>
            {run.completedAt
              ? formatRelativeTime(run.completedAt)
              : run.status === "running"
                ? "In progress"
                : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Doc<"automationRuns">["status"];
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-normal",
        status === "success" && "border-primary/20 text-primary",
        status === "failed" && "border-destructive/30 text-destructive",
        status === "running" && "border-border text-muted-foreground"
      )}
    >
      {status === "success" && <CheckCircle2 className="size-3" />}
      {status === "failed" && <XCircle className="size-3" />}
      {status === "running" && (
        <Loader2 className="size-3 animate-spin" />
      )}
      {status === "success"
        ? "Success"
        : status === "failed"
          ? "Failed"
          : "Running"}
    </Badge>
  );
}

function EmptyRunHistory() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
        <Workflow className="size-5" />
      </div>
      <p className="mb-1 text-base font-medium">No automation runs yet</p>
      <p className="text-muted-foreground max-w-sm text-base">
        Create or delete a note to trigger indexing automations. Runs will appear
        here with timing and status.
      </p>
    </div>
  );
}

function RunHistorySkeleton() {
  return (
    <div className="space-y-0 divide-y divide-border/50">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
      ))}
    </div>
  );
}
