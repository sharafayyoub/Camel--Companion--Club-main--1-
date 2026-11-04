import { EduSelect } from "@/components/edu/EduSelect";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";

export function SchoolSetup() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [school, setSchool] = useState("");
  const [token, setToken] = useState("");
  const [role, setRole] = useState<"teacher" | "director">("director");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "create") {
        if (!school.trim()) throw new Error();
        const { error: err } = await supabase.rpc("edu_create_school", {
          school_name: school.trim(),
          chosen_role: role,
        });
        if (err) throw err;
      } else {
        if (!z.string().uuid().safeParse(token.trim()).success) throw new Error();
        const { error: err } = await supabase.rpc("edu_join_school", {
          invite_token: token.trim(),
        });
        if (err) throw err;
      }
      await client.invalidateQueries({ queryKey: ["edu"] });
      await router.invalidate();
    } catch {
      setError(t(mode === "join" ? "school.invalidInvite" : "cloud.error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-lg py-8">
      <Building2 className="mb-4 h-10 w-10 text-secondary" />
      <h1 className="text-3xl">{t("school.title")}</h1>
      <div className="mt-6 flex gap-2">
        <Button
          variant={mode === "create" ? "secondary" : "outline"}
          onClick={() => setMode("create")}
        >
          {t("school.create")}
        </Button>
        <Button variant={mode === "join" ? "secondary" : "outline"} onClick={() => setMode("join")}>
          {t("school.join")}
        </Button>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-5">
        {mode === "create" ? (
          <>
            <label className="block space-y-2 font-bold">
              {t("school.name")}
              <Input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                maxLength={160}
                required
              />
            </label>
            <label className="block space-y-2 font-bold">
              {t("school.role")}
              <EduSelect
                label={t("school.role")}
                value={role}
                onChange={(value) => {
                  if (value === "teacher" || value === "director") setRole(value);
                }}
                options={["teacher", "director"].map((value) => ({
                  value,
                  label: t(`school.${value}`),
                }))}
              />
            </label>
            <p className="text-sm text-muted-foreground">{t("school.isolated")}</p>
          </>
        ) : (
          <label className="block space-y-2 font-bold">
            {t("school.inviteCode")}
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              maxLength={36}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy}>{t(busy ? "cloud.saving" : "cloud.continue")}</Button>
      </form>
    </section>
  );
}
