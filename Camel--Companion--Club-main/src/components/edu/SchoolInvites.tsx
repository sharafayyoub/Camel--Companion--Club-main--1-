import { EduSelect } from "@/components/edu/EduSelect";
import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";

export function SchoolInvites() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "director">("teacher");
  const [token, setToken] = useState("");
  const invite = useMutation({
    mutationFn: async () => {
      z.string().email().max(255).parse(email);
      const { data, error } = await supabase.rpc("edu_invite", {
        invite_email: email,
        invite_role: role,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: setToken,
    onError: () => toast.error(t("cloud.error")),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    invite.mutate();
  }
  return (
    <section className="mt-10 border-t-2 pt-8">
      <h2 className="text-2xl">{t("school.team")}</h2>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-2 font-bold">
          {t("auth.email")}
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
          />
        </label>
        <label className="space-y-2 font-bold">
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
        <Button disabled={invite.isPending}>
          <UserPlus />
          {t("school.invite")}
        </Button>
      </form>
      {token && (
        <div className="mt-4 rounded-lg border p-4">
          <p className="text-sm">{t("school.shareInvite", { email })}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 break-all text-sm">{token}</code>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("school.copy")}
              title={t("school.copy")}
              onClick={() =>
                void navigator.clipboard
                  .writeText(token)
                  .then(() => toast.success(t("school.copied")))
                  .catch(() => toast.error(t("cloud.error")))
              }
            >
              <Copy />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
