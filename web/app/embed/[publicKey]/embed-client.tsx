"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatStreamEvent } from "lib/api-types/chat";
import { consumeSseJsonStream } from "lib/chat-turn-stream";
import { ChatSurface } from "components/chat/chat-surface";
import type { ChatFeedback, ChatTheme, SendChatMessage } from "components/chat/types";
import { LeadCaptureBar } from "./lead-capture-bar";

const VISITOR_ID_KEY = "docsy_visitor_id";
const MOBILE_BREAKPOINT_PX = 480;

function randomId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    // Storage blocked (private mode, cookies disabled) — the widget still
    // works, the conversation just will not survive a reload.
    return randomId();
  }
}

/**
 * `postMessage` target/expected origins. The iframe never knows the
 * customer's origin from same-origin APIs (`window.parent.location` throws
 * cross-origin), so `widget.js` passes it explicitly in the iframe's own
 * query string. Both directions check `event.source` too, so a message can
 * only be accepted from the actual embedding frame.
 */
function readHostParams(): { parentOrigin: string | null; pageUrl: string | null } {
  if (typeof window === "undefined") return { parentOrigin: null, pageUrl: null };
  const search = new URLSearchParams(window.location.search);
  return { parentOrigin: search.get("parentOrigin"), pageUrl: search.get("pageUrl") };
}

/**
 * Drives `ChatSurface`'s own composer the way a visitor's click would,
 * without editing the component: `window.ChatWidget.ask()` sends a message
 * that came from outside React, so it has to go in through the DOM.
 */
function askThroughComposer(container: HTMLElement, text: string): void {
  const textarea = container.querySelector("textarea");
  const sendButton = container.querySelector<HTMLButtonElement>('button[aria-label="Send message"]');
  if (!textarea || !sendButton) return;

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  nativeSetter?.call(textarea, text);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  requestAnimationFrame(() => {
    if (!sendButton.disabled) sendButton.click();
  });
}

export function EmbedClient({
  publicKey,
  theme,
  greeting,
  leadCaptureEnabled,
  fallbackMessage,
}: {
  publicKey: string;
  theme: ChatTheme;
  greeting: string;
  leadCaptureEnabled: boolean;
  fallbackMessage: string;
}) {
  const [visitorId] = useState(() => (typeof window === "undefined" ? "" : getOrCreateVisitorId()));
  const [hostParams] = useState(readHostParams);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  // Mirrors `conversationIdRef` — the ref is what the fetch/SSE closures read
  // (reliable regardless of render timing), this state is what `LeadCaptureBar`
  // renders (refs cannot be read during render).
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const panelVisibleRef = useRef(true);
  const [leadPrompt, setLeadPrompt] = useState<{ visible: boolean; question: string }>({
    visible: false,
    question: "",
  });

  const postToParent = useCallback(
    (message: unknown) => {
      if (!hostParams.parentOrigin) return;
      window.parent.postMessage(message, hostParams.parentOrigin);
    },
    [hostParams.parentOrigin],
  );

  // Host -> iframe: visibility toggles and the `.ask()` public API.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      if (!hostParams.parentOrigin || event.origin !== hostParams.parentOrigin) return;
      const data = event.data as { type?: string; text?: string } | null;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "open") {
        panelVisibleRef.current = true;
      } else if (data.type === "close") {
        panelVisibleRef.current = false;
      } else if (data.type === "ask" && typeof data.text === "string" && containerRef.current) {
        panelVisibleRef.current = true;
        askThroughComposer(containerRef.current, data.text);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [hostParams.parentOrigin]);

  // Iframe -> host: which layout mode the panel should render in. Driven by
  // the iframe's own viewport rather than a CSS media query on the host page,
  // so it stays correct regardless of how the host sizes the iframe element.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    function reportMode() {
      const mode = window.innerWidth < MOBILE_BREAKPOINT_PX ? "fullscreen" : "panel";
      postToParent({ type: "resize", mode });
    }

    reportMode();
    function onResize() {
      clearTimeout(timeout);
      timeout = setTimeout(reportMode, 150);
    }
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timeout);
    };
  }, [postToParent]);

  const watchForFallback = useCallback(
    async (response: Response, question: string) => {
      try {
        await consumeSseJsonStream<ChatStreamEvent>(response, (event) => {
          if (event.type === "start") {
            conversationIdRef.current = event.conversationId;
            setConversationId(event.conversationId);
          } else if (event.type === "done") {
            if (!panelVisibleRef.current) postToParent({ type: "unread" });
            if (leadCaptureEnabled && !event.answered) {
              setLeadPrompt({ visible: true, question });
            }
          }
        });
      } catch {
        // Best-effort UI hint only — the primary stream (read by ChatSurface
        // itself) is what surfaces the error to the visitor.
      }
    },
    [leadCaptureEnabled, postToParent],
  );

  const sendMessage: SendChatMessage = useCallback(
    async ({ message, conversationId, requestId, signal }) => {
      const response = await fetch("/api/public/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          message,
          conversationId,
          requestId,
          visitorId,
          pageUrl: hostParams.pageUrl ?? undefined,
        }),
        signal,
      });

      if (!response.ok || !response.body) {
        const json: unknown = await response.json().catch(() => ({}));
        const errorMessage =
          json && typeof json === "object" && "error" in json && typeof json.error === "string"
            ? json.error
            : `Request failed (${response.status})`;
        throw new Error(errorMessage);
      }

      void watchForFallback(response.clone(), message);
      return response;
    },
    [publicKey, visitorId, hostParams.pageUrl, watchForFallback],
  );

  const onFeedback: ChatFeedback = useCallback(
    ({ messageId, rating }) => {
      const conversationId = conversationIdRef.current;
      if (!conversationId) return;
      void fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, conversationId, messageId, rating }),
      }).catch(() => {
        // Rating is a nicety for the owner's dashboard, not something the
        // visitor needs to know failed.
      });
    },
    [publicKey],
  );

  return (
    <div className="flex h-full w-full flex-col gap-2 p-2">
      <div ref={containerRef} className="min-h-0 flex-1">
        <ChatSurface
          variant="widget"
          theme={theme}
          greeting={greeting}
          sendMessage={sendMessage}
          onFeedback={onFeedback}
          className="h-full"
        />
      </div>

      {leadCaptureEnabled && leadPrompt.visible ? (
        <LeadCaptureBar
          publicKey={publicKey}
          conversationId={conversationId}
          question={leadPrompt.question}
          fallbackMessage={fallbackMessage}
          accentColor={theme.accentColor}
          onDismiss={() => setLeadPrompt((prev) => ({ ...prev, visible: false }))}
        />
      ) : null}
    </div>
  );
}
