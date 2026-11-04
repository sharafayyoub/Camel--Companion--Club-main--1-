import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useEduAuth } from "@/lib/edu/auth";
import { eduPageHead } from "@/lib/edu/meta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: ({ match }) => eduPageHead("reset", match.context.translations),
  component: ResetPassword,
});
function ResetPassword() {
  const { t } = useTranslation();
  const { user, recovery } = useEduAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!recovery || !user || password.length < 8 || password !== confirm) {
      setError(t("auth.invalidReset"));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(t("cloud.error"));
    else await navigate({ to: "/panel", replace: true });
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-md space-y-5 py-8">
      <h1 className="text-3xl">{t("auth.newPassword")}</h1>
      <label className="block space-y-2">
        {t("auth.password")}
        <Input
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className="block space-y-2">
        {t("auth.confirmPassword")}
        <Input
          type="password"
          minLength={8}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy || !recovery || !user}>{t("cloud.save")}</Button>
    </form>
  );
}
