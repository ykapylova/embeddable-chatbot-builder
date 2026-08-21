import { useEffect, useRef } from "react";
import { Send, Square } from "lucide-react";

import { cn } from "lib/utils";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  placeholder,
  accentColor,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
  accentColor: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Driven by `value` rather than by `onChange` so the box also shrinks back
  // when ChatSurface clears the input after a send. The height is reset to
  // `auto` first: `scrollHeight` otherwise reports the tallest the box has
  // ever been and the composer only ever grows. The border is added back on
  // top because `box-sizing: border-box` counts it inside the height we set,
  // while `scrollHeight` does not include it.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const border = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + border}px`;
  }, [value]);

  function submit() {
    if (isStreaming || value.trim().length === 0) return;
    onSend();
  }

  return (
    <form
      className="flex items-end gap-2 border-t border-[var(--border)] p-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        maxLength={4000}
        placeholder={placeholder ?? "Ask a question…"}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="max-h-32 min-h-9 flex-1 resize-none overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none transition focus:border-[#c9d0dd]"
      />

      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop generating"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90"
          style={{ background: accentColor }}
        >
          <Square className="h-3.5 w-3.5" fill="currentColor" />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send message"
          disabled={value.trim().length === 0}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40",
          )}
          style={{ background: accentColor }}
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
