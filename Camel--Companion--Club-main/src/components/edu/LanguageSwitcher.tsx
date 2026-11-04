import { Check, ChevronDown, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouter } from "@tanstack/react-router";
import { changeLanguage, normalizeLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABELS: Record<AppLanguage, string> = { es: "Español", en: "English", fr: "Français" };

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const current = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ?? "es";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-32 justify-between border-2 px-3 font-extrabold sm:w-36"
          aria-label={t("common.language")}
        >
          <Globe className="text-secondary" aria-hidden />
          <span lang={current}>{LABELS[current]}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 border-2 p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {t("common.language")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            className="min-h-11 cursor-pointer justify-between font-extrabold"
            onSelect={() => {
              changeLanguage(lang);
              void router.invalidate();
            }}
            aria-label={LABELS[lang]}
          >
            <span lang={lang}>{LABELS[lang]}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{lang.toUpperCase()}</span>
              {lang === current ? (
                <Check className="text-secondary" aria-hidden />
              ) : (
                <span className="size-4" />
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
