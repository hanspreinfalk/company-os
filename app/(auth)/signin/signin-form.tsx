"use client";

import { CompanyLogo } from "@/components/company-logo";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";
import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AuthFormValues, signinSchema } from "../schema";

export function SigninForm() {
  const [step, setStep] = useState<"signIn" | "signUp">("signIn");
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: AuthFormValues) {
    setIsLoading(true);
    try {
      await signIn("password", {
        ...values,
        flow: step,
      });
      toast.success(
        step === "signIn"
          ? "Signed in successfully"
          : "Account created successfully"
      );
      router.push("/notes");
    } catch (error) {
      console.error(error);
      if (
        error instanceof Error &&
        (error.message.includes("InvalidAccountId") ||
          error.message.includes("InvalidSecret"))
      ) {
        form.setError("root", {
          type: "manual",
          message: "Invalid credentials.",
        });
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen">
      <div className="bg-muted/50 hidden w-1/2 flex-col justify-between border-r border-border/50 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <CompanyLogo size="sm" />
          <span className="max-w-xs truncate text-base font-medium" title={APP_NAME}>
            {APP_NAME}
          </span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight">
            Deploy knowledge,
            <br />
            not guesswork.
          </h2>
          <p className="text-muted-foreground max-w-md text-base leading-relaxed">
            A calm workspace for capturing notes and querying them with AI —
            built for teams that ship.
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <CompanyLogo size="sm" />
          <span className="max-w-xs truncate text-base font-medium" title={APP_NAME}>
            {APP_NAME}
          </span>
        </div>

        <div
          data-slot="card"
          className="bg-card w-full max-w-md space-y-6 rounded-xl border border-border/50 p-8 shadow-xs"
        >
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {step === "signIn" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-muted-foreground text-base">
              {step === "signIn"
                ? "Sign in to access your workspace."
                : "Get started with your team workspace."}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="you@deployment.co"
                        {...field}
                        type="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <div className="text-destructive text-base">
                  {form.formState.errors.root.message}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {step === "signIn" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </Form>

          <Separator />

          <div className="space-y-3 text-center">
            <Button
              variant="link"
              type="button"
              className="text-muted-foreground h-auto p-0 text-base"
              onClick={() => {
                setStep(step === "signIn" ? "signUp" : "signIn");
                form.reset();
              }}
            >
              {step === "signIn"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
            <p>
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                &larr; Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
