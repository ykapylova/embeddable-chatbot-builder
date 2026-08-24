"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deleteBot, getBot, updateBot } from "lib/api-client";
import { appPaths } from "lib/api-paths";
import {
  BOT_MESSAGE_MAX,
  BOT_NAME_MAX,
  BOT_PROMPT_MAX,
  BOT_TONES,
} from "lib/bot-defaults";
import { queryKeys } from "lib/query-keys";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { TagPill } from "components/ui/tag-pill";
import { Textarea } from "components/ui/textarea";

// The welcome message is deliberately absent: it is edited on the Appearance
// screen, which writes the same column. Two controls over one value drifted
// visibly whenever one screen saved a stale copy.
type FormState = {
  name: string;
  tone: string;
  fallbackMessage: string;
  systemPrompt: string;
};

export function BotSettingsForm({ botId }: { botId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // The draft holds only edited fields and is layered over server data, so a
  // refetch never overwrites what the user is typing and no effect is needed to
  // copy the response into state.
  const [draft, setDraft] = useState<Partial<FormState>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const bot = useQuery({
    queryKey: queryKeys.bots.detail(botId),
    queryFn: () => getBot(botId),
  });

  const base: FormState | null = bot.data
    ? {
        name: bot.data.name,
        tone: bot.data.tone,
        fallbackMessage: bot.data.fallbackMessage,
        systemPrompt: bot.data.systemPrompt ?? "",
      }
    : null;

  const form: FormState | null = base ? { ...base, ...draft } : null;

  const save = useMutation({
    mutationFn: (values: FormState) =>
      updateBot(botId, {
        name: values.name.trim(),
        tone: values.tone,
        fallbackMessage: values.fallbackMessage.trim(),
        systemPrompt: values.systemPrompt.trim() || null,
      }),
    onSuccess: async (updated) => {
      toast.success("Bot settings saved");
      queryClient.setQueryData(queryKeys.bots.detail(botId), updated);
      setDraft({});
      await queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
    },
  });

  const setStatus = useMutation({
    mutationFn: (status: "active" | "paused") => updateBot(botId, { status }),
    onSuccess: async (updated) => {
      toast.success(updated.status === "paused" ? "Bot paused" : "Bot resumed");
      queryClient.setQueryData(queryKeys.bots.detail(botId), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteBot(botId),
    onSuccess: async () => {
      toast.success("Bot deleted");
      await queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
      router.push(appPaths.dashboard());
    },
  });

  if (bot.isPending || !bot.data || !form || !base) {
    return (
      <div className="space-y-4" aria-hidden>
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-16 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
        ))}
      </div>
    );
  }

  if (bot.isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center">
        <p className="text-sm text-[var(--danger)]">
          {bot.error instanceof Error ? bot.error.message : "Could not load bot"}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => bot.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const isPaused = bot.data.status === "paused";

  const isDirty =
    form.name.trim() !== base.name ||
    form.tone !== base.tone ||
    form.fallbackMessage.trim() !== base.fallbackMessage ||
    form.systemPrompt.trim() !== base.systemPrompt;

  const canSave =
    isDirty &&
    !save.isPending &&
    form.name.trim().length > 0 &&
    form.fallbackMessage.trim().length > 0;

  function patch(values: Partial<FormState>) {
    setDraft((prev) => ({ ...prev, ...values }));
    save.reset();
  }

  return (
    <div className="space-y-8">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) save.mutate(form);
        }}
      >
        <Field label="Name" hint="Internal only — how you tell bots apart.">
          <Input
            value={form.name}
            maxLength={BOT_NAME_MAX}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>

        <Field label="Tone" hint="How the bot phrases its answers.">
          <div className="flex flex-wrap gap-2">
            {BOT_TONES.map((tone) => (
              <button
                key={tone.value}
                type="button"
                onClick={() => patch({ tone: tone.value })}
                className={
                  form.tone === tone.value
                    ? "rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm text-white"
                    : "rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm transition hover:bg-[var(--panel-soft)]"
                }
                title={tone.hint}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Fallback message"
          hint="Shown when the answer is not in your knowledge base. The bot never guesses."
        >
          <Input
            value={form.fallbackMessage}
            maxLength={BOT_MESSAGE_MAX}
            onChange={(event) => patch({ fallbackMessage: event.target.value })}
          />
        </Field>

        <Field
          label="System instruction"
          hint="Optional. Extra context about your product, audience or rules."
        >
          <Textarea
            value={form.systemPrompt}
            maxLength={BOT_PROMPT_MAX}
            rows={4}
            placeholder="You are the support assistant for Acme, a project management tool for design teams."
            onChange={(event) => patch({ systemPrompt: event.target.value })}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!canSave}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
          {save.isSuccess && !isDirty ? (
            <span className="text-sm text-[var(--muted)]">Saved</span>
          ) : null}
          {save.isError ? (
            <span className="text-sm text-[var(--danger)]">
              {save.error instanceof Error ? save.error.message : "Could not save"}
            </span>
          ) : null}
        </div>
      </form>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">Availability</h2>
          <TagPill tone={isPaused ? "neutral" : "olive"}>{isPaused ? "Paused" : "Active"}</TagPill>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {isPaused
            ? "The widget refuses to open on your site and answers \"This assistant is currently unavailable.\" Your knowledge base and conversations are untouched."
            : "Pausing takes the bot off your site without deleting anything: the widget refuses to open and answers \"This assistant is currently unavailable.\" You can resume whenever you like."}
        </p>

        <Button
          variant="outline"
          className="mt-3"
          disabled={setStatus.isPending}
          onClick={() => setStatus.mutate(isPaused ? "active" : "paused")}
        >
          {setStatus.isPending
            ? isPaused
              ? "Resuming…"
              : "Pausing…"
            : isPaused
              ? "Resume bot"
              : "Pause bot"}
        </Button>

        {setStatus.isError ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            {setStatus.error instanceof Error
              ? setStatus.error.message
              : "Could not change availability"}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--danger-border)] bg-[var(--panel)] p-4">
        <h2 className="text-sm font-medium">Delete this bot</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Removes the bot, its knowledge base and its conversations. The widget stops answering
          immediately. This cannot be undone.
        </p>

        {confirmDelete ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? "Deleting…" : "Yes, delete permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="mt-3" onClick={() => setConfirmDelete(true)}>
            Delete bot
          </Button>
        )}

        {remove.isError ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            {remove.error instanceof Error ? remove.error.message : "Could not delete bot"}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
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
