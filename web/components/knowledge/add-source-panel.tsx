"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileText, Globe, HelpCircle, Loader2, Type, UploadCloud, X } from "lucide-react";

import { createFileSource, createSource } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import {
  SOURCE_FAQ_ANSWER_MAX_CHARS,
  SOURCE_FAQ_QUESTION_MAX_CHARS,
  SOURCE_FILE_ALLOWED_EXTENSIONS,
  SOURCE_FILE_MAX_BYTES,
  SOURCE_TEXT_MAX_CHARS,
  SOURCE_TITLE_MAX,
  extensionFromFilename,
  isAllowedSourceFileExtension,
} from "lib/source-defaults";
import type { Source } from "lib/api-types/source";
import { Button } from "components/ui/button";
import { Input } from "components/ui/input";

type Tab = "file" | "url" | "text" | "faq";

const TABS: { value: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "file", label: "Upload file", icon: FileText },
  { value: "url", label: "URL", icon: Globe },
  { value: "text", label: "Paste text", icon: Type },
  { value: "faq", label: "FAQ", icon: HelpCircle },
];

type QueueItem = {
  id: string;
  file: File;
  status: "uploading" | "error";
  error?: string;
};

function fileValidationError(file: File): string | null {
  if (file.size === 0) return "The file is empty";
  if (file.size > SOURCE_FILE_MAX_BYTES) {
    return `Files must be under ${Math.floor(SOURCE_FILE_MAX_BYTES / (1024 * 1024))}MB`;
  }
  const extension = extensionFromFilename(file.name);
  if (!isAllowedSourceFileExtension(extension)) {
    return "Only PDF, TXT and MD files are supported";
  }
  return null;
}

export function AddSourcePanel({ botId }: { botId: string }) {
  const [tab, setTab] = useState<Tab>("file");

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={
              tab === option.value
                ? "flex items-center gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-sm text-white"
                : "flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm transition hover:bg-[var(--panel-soft)]"
            }
          >
            <option.icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "file" ? <FileTab botId={botId} /> : null}
        {tab === "url" ? <UrlTab botId={botId} /> : null}
        {tab === "text" ? <TextTab botId={botId} /> : null}
        {tab === "faq" ? <FaqTab botId={botId} /> : null}
      </div>
    </div>
  );
}

function mergeSource(queryClient: ReturnType<typeof useQueryClient>, botId: string, source: Source) {
  queryClient.setQueryData<Source[]>(queryKeys.sources.list(botId), (prev) =>
    prev ? [source, ...prev] : [source],
  );
}

function FileTab({ botId }: { botId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  async function uploadOne(id: string, file: File) {
    try {
      const formData = new FormData();
      formData.append("type", "file");
      formData.append("file", file);
      const source = await createFileSource(botId, formData);
      mergeSource(queryClient, botId, source);
      setQueue((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "error", error: message } : item)),
      );
    }
  }

  function enqueue(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const invalid = fileValidationError(file);
      if (invalid) {
        setQueue((prev) => [...prev, { id, file, status: "error", error: invalid }]);
        continue;
      }
      setQueue((prev) => [...prev, { id, file, status: "uploading" }]);
      void uploadOne(id, file);
    }
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          if (event.dataTransfer.files.length > 0) enqueue(event.dataTransfer.files);
        }}
        className={
          isDragOver
            ? "rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--panel-soft)] p-8 text-center transition"
            : "rounded-lg border-2 border-dashed border-[var(--border)] p-8 text-center transition"
        }
      >
        <UploadCloud className="mx-auto mb-2 h-6 w-6 text-[var(--muted)]" />
        <p className="text-sm">
          Drag files here, or{" "}
          <button
            type="button"
            className="font-medium text-[var(--foreground)] underline underline-offset-2"
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          PDF, TXT or MD, up to {Math.floor(SOURCE_FILE_MAX_BYTES / (1024 * 1024))}MB each. Several
          files can upload at once.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={SOURCE_FILE_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) enqueue(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.status === "uploading" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--muted)]" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                )}
                <span className="min-w-0">
                  <span className="block truncate">{item.file.name}</span>
                  {item.status === "error" ? (
                    <span className="block text-xs text-red-600">{item.error}</span>
                  ) : null}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {item.status === "error" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQueue((prev) =>
                        prev.map((entry) =>
                          entry.id === item.id ? { ...entry, status: "uploading", error: undefined } : entry,
                        ),
                      );
                      void uploadOne(item.id, item.file);
                    }}
                  >
                    Try again
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove"
                  onClick={() => setQueue((prev) => prev.filter((entry) => entry.id !== item.id))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function UrlTab({ botId }: { botId: string }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  const create = useMutation({
    mutationFn: () => createSource(botId, { type: "url", url: url.trim() }),
    onSuccess: (source) => {
      mergeSource(queryClient, botId, source);
      setUrl("");
    },
  });

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (url.trim() && !create.isPending) create.mutate();
      }}
    >
      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://docs.example.com/getting-started"
        type="url"
      />
      <Button type="submit" disabled={!url.trim() || create.isPending}>
        {create.isPending ? "Adding…" : "Add URL"}
      </Button>
      {create.isError ? (
        <p className="text-sm text-red-600 sm:self-center">
          {create.error instanceof Error ? create.error.message : "Could not add this URL"}
        </p>
      ) : null}
    </form>
  );
}

function TextTab({ botId }: { botId: string }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const create = useMutation({
    mutationFn: () => createSource(botId, { type: "text", title: title.trim(), content: content.trim() }),
    onSuccess: (source) => {
      mergeSource(queryClient, botId, source);
      setTitle("");
      setContent("");
    },
  });

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !create.isPending;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) create.mutate();
      }}
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={SOURCE_TITLE_MAX}
        placeholder="Title, e.g. Refund policy"
      />
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={SOURCE_TEXT_MAX_CHARS}
        rows={6}
        placeholder="Paste the text you want the bot to know."
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none transition focus:border-[#c9d0dd]"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {create.isPending ? "Adding…" : "Add text"}
        </Button>
        <span className="text-xs text-[var(--muted)]">
          {content.length.toLocaleString()} / {SOURCE_TEXT_MAX_CHARS.toLocaleString()}
        </span>
        {create.isError ? (
          <span className="text-sm text-red-600">
            {create.error instanceof Error ? create.error.message : "Could not add this text"}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function FaqTab({ botId }: { botId: string }) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createSource(botId, { type: "faq", question: question.trim(), answer: answer.trim() }),
    onSuccess: (source) => {
      mergeSource(queryClient, botId, source);
      setQuestion("");
      setAnswer("");
    },
  });

  const canSubmit = question.trim().length > 0 && answer.trim().length > 0 && !create.isPending;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) create.mutate();
      }}
    >
      <Input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        maxLength={SOURCE_FAQ_QUESTION_MAX_CHARS}
        placeholder="Question a visitor might ask"
      />
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        maxLength={SOURCE_FAQ_ANSWER_MAX_CHARS}
        rows={4}
        placeholder="The answer, written the way you'd want it read back."
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none transition focus:border-[#c9d0dd]"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {create.isPending ? "Adding…" : "Add FAQ"}
        </Button>
        {create.isError ? (
          <span className="text-sm text-red-600">
            {create.error instanceof Error ? create.error.message : "Could not add this FAQ"}
          </span>
        ) : null}
      </div>
    </form>
  );
}
