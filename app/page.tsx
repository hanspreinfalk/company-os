import { CompanyLogo } from "@/components/company-logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <CompanyLogo size="sm" />
          <span
            className="truncate text-base font-medium"
            title={APP_NAME}
          >
            {APP_NAME}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ModeToggle />
          <Button asChild variant="outline" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-3xl space-y-8 text-center">
          <CompanyLogo size="lg" className="mx-auto" />

          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {APP_NAME}
            </h1>
            <p className="text-muted-foreground mx-auto max-w-lg text-lg leading-relaxed">
              Capture notes, search with AI, and keep your deployment team
              aligned.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/chat">Open workspace</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/signin">Create account</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="text-muted-foreground border-t border-border/50 px-6 py-8 text-center text-sm">
        Built with Convex and the Vercel AI SDK
      </footer>
    </div>
  );
}
