"use client";

import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const { signOut } = useAuthActions();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 shrink-0"
      onClick={() => signOut()}
      title="Sign out"
    >
      <LogOut className="size-3.5" />
    </Button>
  );
}
