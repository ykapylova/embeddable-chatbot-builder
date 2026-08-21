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

type FormState = {
  name: string;
  tone: string;
  welcomeMessage: string;
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
        welcomeMessage: bot.data.welcomeMessage,
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
        welcomeMessage: values.welcomeMessage.trim(),
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

  const remove = useMutation({
    mutationFn: () => deleteBot(botId),
    onSuccess: async () => {
      toast.success("Bot deleted");
      await queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
      router.push(appPaths.dashboard());
    },
  });

  if (bot.isPending || !form || !base) {
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
        <p className="text-sm text-red-600">
          {bot.error instanceof Error ? bot.error.message : "Could not load bot"}
        </p>
        <Button variant="outline" className="mt-3" onClick={() => bot.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const isDirty =
    form.name.trim() !== base.name ||
    form.tone !== base.tone ||
    form.welcomeMessage.trim() !== base.welcomeMessage ||
    form.fallbackMessage.trim() !== base.fallbackMessage ||
    form.systemPrompt.trim() !== base.systemPrompt;

  const canSave =
    isDirty &&
    !save.isPending &&
    form.name.trim().length > 0 &&
    form.welcomeMessage.trim().length > 0 &&
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

        <Field label="Welcome message" hint="First thing a visitor sees in the chat.">
          <Input
            value={form.welcomeMessage}
            maxLength={BOT_MESSAGE_MAX}
            onChange={(event) => patch({ welcomeMessage: event.target.value })}
          />
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
          <textarea
            value={form.systemPrompt}
            maxLength={BOT_PROMPT_MAX}
            rows={4}
            placeholder="You are the support assistant for Acme, a project management tool for design teams."
            onChange={(event) => patch({ systemPrompt: event.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none transition focus:border-[#c9d0dd]"
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
            <span className="text-sm text-red-600">
              {save.error instanceof Error ? save.error.message : "Could not save"}
            </span>
          ) : null}
        </div>
      </form>

      <section className="rounded-2xl border border-red-200 bg-[var(--panel)] p-4">
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
          <p className="mt-2 text-sm text-red-600">
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
