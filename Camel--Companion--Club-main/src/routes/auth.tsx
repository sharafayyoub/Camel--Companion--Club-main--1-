import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Mail, LogIn, UserPlus } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useEduAuth } from "@/lib/edu/auth";
import { eduPageHead } from "@/lib/edu/meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import camelWave from "@/assets/camel-wave.png";
import { authDestination } from "@/lib/edu/auth-destination";
import { hasCloudConfiguration } from "@/lib/edu/cloud-config";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["signup", "login"]).optional(),
    next: z.string().optional(),
  }),
  head: ({ match }) => eduPageHead("auth", match.context.translations),
  component: Auth,
});

function Auth() {
  const { t } = useTranslation();
  const { user, ready } = useEduAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const destination = authDestination(search.next);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (ready && user) void navigate({ href: destination, replace: true });
  }, [ready, user, navigate, destination]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!hasCloudConfiguration()) {
      setError("cloud.notConfigured");
      return;
    }
    setError("");
    setMessage("");
    if (
      !z.string().email().max(255).safeParse(email.trim()).success ||
      (mode !== "forgot" && password.length < 8) ||
      (mode === "signup" && !name.trim())
    ) {
      setError("auth.invalid");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(destination)}`,
            data: { display_name: name.trim() },
          },
        });
        if (err) throw err;
        setMessage("auth.confirmEmail");
      } else if (mode === "forgot") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setMessage("auth.resetSent");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        await navigate({ href: destination, replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.includes("email address is not allowed")
          ? "auth.invalidEmailDomain"
          : mode === "login"
            ? "auth.loginError"
            : "cloud.error",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-md py-3">
      <img src={camelWave} className="mx-auto h-32 w-32 object-contain" alt={t("home.mascotAlt")} />
      <h1 className="mt-3 text-center text-3xl">{t("auth.title")}</h1>
      <div className="mt-6 flex gap-2">
        <Button
          variant={mode === "login" ? "secondary" : "outline"}
          className="flex-1"
          onClick={() => {
            setMode("login");
            setError("");
            setMessage("");
          }}
        >
          <LogIn />
          {t("auth.login")}
        </Button>
        <Button
          variant={mode === "signup" ? "secondary" : "outline"}
          className="flex-1"
          onClick={() => {
            setMode("signup");
            setError("");
            setMessage("");
          }}
        >
          <UserPlus />
          {t("auth.signup")}
        </Button>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "signup" && (
          <label className="block space-y-2 font-bold">
            {t("auth.name")}
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              autoComplete="name"
            />
          </label>
        )}
        <label className="block space-y-2 font-bold">
          {t("auth.email")}
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={255}
            autoComplete="email"
          />
        </label>
        {mode !== "forgot" && (
          <label className="block space-y-2 font-bold">
            {t("auth.password")}
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
        {message && (
          <p role="status" className="rounded-md bg-accent p-4 text-accent-foreground">
            {t(message)}
          </p>
        )}
        <Button className="w-full" disabled={busy} type="submit">
          <Mail />
          {t(busy ? "cloud.saving" : mode === "forgot" ? "auth.sendReset" : `auth.${mode}`)}
        </Button>
        {mode === "login" && (
          <Button type="button" variant="link" onClick={() => setMode("forgot")}>
            {t("auth.forgot")}
          </Button>
        )}
      </form>
    </div>
  );
}
