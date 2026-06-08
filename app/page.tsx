import { CompanyLogo } from "@/components/company-logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <CompanyLogo size="sm" />
          <span className="text-sm font-medium">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button asChild variant="outline" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl space-y-8 text-center">
          <CompanyLogo size="lg" className="mx-auto" />

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {APP_NAME}
            </h1>
            <p className="text-muted-foreground mx-auto max-w-lg text-lg leading-relaxed">
              The operating system for your company&apos;s knowledge. Capture
              notes, search with AI, and keep your team aligned.
            </p>
            <p className="text-muted-foreground/70 text-sm">
              by {COMPANY_NAME}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/notes">Open workspace</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/signin">Create account</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="text-muted-foreground px-6 py-8 text-center text-xs">
        Built with Convex and the Vercel AI SDK
      </footer>
    </div>
  );
}
