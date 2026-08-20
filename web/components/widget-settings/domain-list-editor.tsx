"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { ApiError, updateBot } from "lib/api-client";
import { planLimits } from "lib/plans";
import { queryKeys } from "lib/query-keys";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";
import { ProPill } from "components/widget-settings/plan-pill";

// Mirrors the check in `bot.service.ts` for immediate feedback — the server
// stays the actual enforcement boundary (PROJECT_SPEC.md §9).
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase();
}

function validateDomain(raw: string, existing: string[]): string | null {
  const value = normalizeDomain(raw);
  if (!value) return "Enter a domain";
  if (/^[a-z]+:\/\//i.test(value)) return "Enter a hostname, not a URL — no protocol";
  if (value.includes("/")) return "Enter a hostname, not a URL — no path";
  if (!DOMAIN_PATTERN.test(value)) return "Not a valid domain, e.g. app.example.com";
  if (existing.includes(value)) return "Already in the list";
  return null;
}

/**
 * There is no endpoint yet that reports the account's real plan (billing is
 * later phases), so — same workaround as `KnowledgeCharUsage` — Free is the
 * honest assumption until one exists.
 */
const assumedPlanLimits = planLimits("free");

export function DomainListEditor({ botId, domains }: { botId: string; domains: string[] }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nextDomains: string[]) => updateBot(botId, { allowedDomains: nextDomains }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.bots.detail(botId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.bots.all });
    },
  });

  const atLimit = domains.length >= assumedPlanLimits.domains;
  const limitLabel = Number.isFinite(assumedPlanLimits.domains) ? String(assumedPlanLimits.domains) : "∞";

  function handleAdd() {
    const validationError = validateDomain(value, domains);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    mutation.mutate([...domains, normalizeDomain(value)], {
      onSuccess: () => setValue(""),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add domain"),
    });
  }

  function handleRemove(domain: string) {
    setError(null);
    mutation.mutate(
      domains.filter((d) => d !== domain),
      { onError: (err) => setError(err instanceof ApiError ? err.message : "Could not remove domain") },
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span>
          {domains.length} of {limitLabel} domains used
        </span>
        {atLimit ? <ProPill /> : null}
      </div>

      {domains.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No domains yet — the widget will not load anywhere until you add one.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {domains.map((domain) => (
            <li
              key={domain}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm"
            >
              {domain}
              <button
                type="button"
                onClick={() => handleRemove(domain)}
                disabled={mutation.isPending}
                className="text-[var(--muted)] transition hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${domain}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="app.example.com"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={handleAdd} disabled={mutation.isPending}>
          Add
        </Button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
