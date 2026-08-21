"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getBot, updateBot } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import {
  BOT_MESSAGE_MAX,
  BUBBLE_POSITIONS,
  THEME_DEFAULTS,
  THEME_PLACEHOLDER_MAX,
  type BubblePosition,
} from "lib/bot-defaults";
import { queryKeys } from "lib/query-keys";
import { cn } from "lib/utils";
import { usePlan } from "components/plan/use-plan";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { AppearancePreview } from "components/widget-settings/appearance-preview";
import { ProPill } from "components/widget-settings/plan-pill";

type FormState = {
  accentColor: string;
  avatarUrl: string;
  placeholder: string;
  position: BubblePosition;
  greeting: string;
  brandingEnabled: boolean;
};

export function AppearanceForm({ botId }: { botId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { plan } = usePlan();
  const [draft, setDraft] = useState<Partial<FormState>>({});

  const bot = useQuery({
    queryKey: queryKeys.bots.detail(botId),
    queryFn: () => getBot(botId),
  });

  const base: FormState | null = bot.data
    ? {
        accentColor: bot.data.theme.accentColor ?? THEME_DEFAULTS.accentColor,
        avatarUrl: bot.data.theme.avatarUrl ?? "",
        placeholder: bot.data.theme.placeholder ?? THEME_DEFAULTS.placeholder,
        position: bot.data.theme.position ?? THEME_DEFAULTS.position,
        greeting: bot.data.welcomeMessage,
        brandingEnabled: bot.data.brandingEnabled,
      }
    : null;

  const form: FormState | null = base ? { ...base, ...draft } : null;

  const save = useMutation({
    mutationFn: (values: FormState) =>
      updateBot(botId, {
        theme: {
          accentColor: values.accentColor,
          avatarUrl: values.avatarUrl.trim() || null,
          placeholder: values.placeholder.trim(),
          position: values.position,
        },
        welcomeMessage: values.greeting.trim(),
        brandingEnabled: values.brandingEnabled,
      }),
    onSuccess: async (updated) => {
      toast.success("Appearance updated");
      queryClient.setQueryData(queryKeys.bots.detail(botId), updated);
      setDraft({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
    },
  });

  // Checked before the `!base` skeleton branch below: `bot.data` stays
  // undefined once a query errors, so a bare `!base` check would keep
  // showing the loading skeleton forever instead of ever reaching this.
  if (bot.isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <p className="text-sm text-red-600">
          {bot.error instanceof Error ? bot.error.message : "Could not load this bot"}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => bot.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (bot.isPending || !form || !base) {
    return (
      <div className="grid gap-6 md:grid-cols-2" aria-hidden>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
          ))}
        </div>
        <div className="h-[560px] animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
      </div>
    );
  }

  const isDirty =
    form.accentColor !== base.accentColor ||
    form.avatarUrl.trim() !== base.avatarUrl ||
    form.placeholder.trim() !== base.placeholder ||
    form.position !== base.position ||
    form.greeting.trim() !== base.greeting ||
    form.brandingEnabled !== base.brandingEnabled;

  const canSave = isDirty && !save.isPending && form.greeting.trim().length > 0;

  function patch(values: Partial<FormState>) {
    setDraft((prev) => ({ ...prev, ...values }));
    save.reset();
  }

  const brandingLocked = plan?.branding ?? true;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) save.mutate(form);
        }}
      >
        <Field label="Accent colour" hint="Used for your messages and the send button.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.accentColor}
              onChange={(event) => patch({ accentColor: event.target.value })}
              className="h-9 w-14 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1"
              aria-label="Accent colour"
            />
            <span className="text-xs text-[var(--muted)]">{form.accentColor}</span>
          </div>
        </Field>

        <Field label="Bubble position" hint="Which corner the widget opens from on your site.">
          <div className="flex flex-wrap gap-2">
            {BUBBLE_POSITIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => patch({ position: option.value })}
                className={
                  form.position === option.value
                    ? "rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm text-white"
                    : "rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm transition hover:bg-[var(--panel-soft)]"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Avatar URL" hint="Optional. Shown next to the bot's replies.">
          <Input
            type="url"
            value={form.avatarUrl}
            placeholder="https://example.com/avatar.png"
            onChange={(event) => patch({ avatarUrl: event.target.value })}
          />
        </Field>

        <Field label="Greeting" hint="First thing a visitor sees when the chat opens.">
          <Input
            value={form.greeting}
            maxLength={BOT_MESSAGE_MAX}
            onChange={(event) => patch({ greeting: event.target.value })}
          />
        </Field>

        <Field label="Input placeholder" hint="Shown in the empty message box.">
          <Input
            value={form.placeholder}
            maxLength={THEME_PLACEHOLDER_MAX}
            onChange={(event) => patch({ placeholder: event.target.value })}
          />
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-2">
              &quot;Powered by&quot; badge{brandingLocked ? <ProPill /> : null}
            </span>
          }
        >
          <button
            type="button"
            role="switch"
            aria-checked={form.brandingEnabled}
            onClick={() =>
              brandingLocked
                ? router.push(`${appPaths.billing()}?reason=FEATURE_BRANDING`)
                : patch({ brandingEnabled: !form.brandingEnabled })
            }
            className={cn(
              "relative h-6 w-11 rounded-full transition",
              form.brandingEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
                form.brandingEnabled ? "left-[22px]" : "left-0.5",
              )}
            />
          </button>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            {brandingLocked
              ? "Removing the badge requires a Pro plan."
              : "Off hides \"Powered by Docsy\" from the widget."}
          </p>
        </Field>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!canSave}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          {save.isSuccess && !isDirty ? (
            <span className="text-sm text-[var(--muted)]">Saved</span>
          ) : null}
          {save.isError ? (
            <span className="text-sm text-red-600">
              {save.error instanceof Error ? save.error.message : "Could not save"}
            </span>
          ) : null}
        </div>
      </form>

      <AppearancePreview
        botId={botId}
        position={form.position}
        greeting={form.greeting || base.greeting}
        theme={{
          accentColor: form.accentColor,
          avatarUrl: form.avatarUrl.trim() || null,
          placeholder: form.placeholder.trim() || undefined,
          brandingEnabled: form.brandingEnabled,
        }}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}
