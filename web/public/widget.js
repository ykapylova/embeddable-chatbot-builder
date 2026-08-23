/**
 * Docsy embeddable widget. No dependencies. Reads `data-bot-key` off its own
 * `<script>` tag, draws a bubble button, and opens an iframe pointing at
 * `/embed/<publicKey>` for the actual chat — the iframe is what gives full
 * CSS/JS isolation from the host page (PROJECT_SPEC.md §9).
 *
 * Every style here is set via the CSSOM (`element.style.x = ...`), never a
 * `<style>` tag or the `style` attribute, so a strict host CSP that blocks
 * inline style sources still lets the widget render.
 */
(function () {
  "use strict";

  var currentScript = document.currentScript;
  if (!currentScript) return;

  var publicKey = currentScript.getAttribute("data-bot-key");
  if (!publicKey) {
    console.error("[ChatWidget] Missing data-bot-key on the widget <script> tag.");
    return;
  }

  var APP_ORIGIN = new URL(currentScript.src, window.location.href).origin;
  var PANEL_RADIUS = "16px";
  var PANEL_SHADOW = "0 16px 48px rgba(0,0,0,0.24)";
  // Below either of these the floating panel no longer fits next to the bubble,
  // so the chat takes over the viewport instead.
  var FULLSCREEN_MAX_WIDTH = 480;
  var FULLSCREEN_MAX_HEIGHT = 480;
  var BUBBLE_SHADOW = "0 8px 24px rgba(0,0,0,0.2)";
  var BUBBLE_SHADOW_HOVER = "0 10px 28px rgba(0,0,0,0.26)";
  var BUBBLE_SHADOW_FOCUS = BUBBLE_SHADOW + ", 0 0 0 3px #1c1b1a";

  var state = {
    open: false,
    mode: "panel",
    iframe: null,
    panelHost: null,
    pendingAsk: null,
  };

  function postToIframe(message) {
    if (state.iframe && state.iframe.contentWindow) {
      state.iframe.contentWindow.postMessage(message, APP_ORIGIN);
    }
  }

  // The host page owns the layout mode: it is the only window whose width says
  // whether a 380px panel fits. Letting the iframe decide oscillated, because
  // fullscreen widened the iframe past its own breakpoint, which reported
  // "panel", which narrowed it again.
  function preferredMode() {
    return window.innerWidth < FULLSCREEN_MAX_WIDTH || window.innerHeight < FULLSCREEN_MAX_HEIGHT
      ? "fullscreen"
      : "panel";
  }

  function syncMode() {
    var mode = preferredMode();
    if (mode === state.mode) return;
    state.mode = mode;
    applyPanelGeometry();
  }

  function applyPanelGeometry() {
    var host = state.panelHost;
    if (!host) return;

    if (state.mode === "fullscreen") {
      host.style.top = "0";
      host.style.left = "0";
      host.style.right = "0";
      host.style.bottom = "0";
      host.style.width = "100%";
      host.style.height = "100%";
    } else {
      host.style.top = "";
      host.style.left = "";
      host.style.bottom = "92px";
      host.style.right = "20px";
      host.style.width = "380px";
      host.style.height = "min(600px, 80vh)";
    }
    host.style.display = state.open ? "block" : "none";

    if (state.iframe) {
      state.iframe.style.borderRadius = state.mode === "fullscreen" ? "0" : PANEL_RADIUS;
      state.iframe.style.boxShadow = state.mode === "fullscreen" ? "none" : PANEL_SHADOW;
    }
  }

  function ensureIframe() {
    if (state.iframe) return state.iframe;

    var host = document.createElement("div");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.zIndex = "2147483000";
    document.body.appendChild(host);
    state.panelHost = host;

    var iframe = document.createElement("iframe");
    iframe.title = "Chat";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.background = "transparent";

    var src =
      APP_ORIGIN +
      "/embed/" +
      encodeURIComponent(publicKey) +
      "?parentOrigin=" +
      encodeURIComponent(window.location.origin) +
      "&pageUrl=" +
      encodeURIComponent(window.location.href);
    iframe.src = src;

    iframe.addEventListener("load", function () {
      if (state.pendingAsk) {
        postToIframe({ type: "ask", text: state.pendingAsk });
        state.pendingAsk = null;
      }
    });

    host.appendChild(iframe);
    state.iframe = iframe;
    applyPanelGeometry();
    return iframe;
  }

  function setBubbleIcon() {
    bubble.innerHTML = state.open ? CLOSE_ICON : CHAT_ICON;
    bubble.setAttribute("aria-label", state.open ? "Close chat" : "Open chat");
  }

  function setUnread(value) {
    badge.style.display = value ? "block" : "none";
  }

  function open() {
    if (state.open) return;
    state.open = true;
    state.mode = preferredMode();
    ensureIframe();
    applyPanelGeometry();
    setBubbleIcon();
    setUnread(false);
    postToIframe({ type: "open" });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    if (state.panelHost) state.panelHost.style.display = "none";
    setBubbleIcon();
    postToIframe({ type: "close" });
  }

  function toggle() {
    if (state.open) close();
    else open();
  }

  function ask(text) {
    if (typeof text !== "string" || !text.trim()) return;
    open();
    if (state.iframe && state.iframe.contentWindow) {
      postToIframe({ type: "ask", text: text });
    } else {
      state.pendingAsk = text;
    }
  }

  // ---- Bubble button, in a shadow root so the host page's CSS cannot reach
  // it and the widget's own styles cannot leak back out. ----

  // An inline SVG rather than an emoji: emoji render differently on every platform
  // and inherit the host page's font stack even inside the shadow root.
  var CHAT_ICON =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M4 11.5c0-3.9 3.6-7 8-7s8 3.1 8 7-3.6 7-8 7c-.9 0-1.8-.1-2.6-.4l-4 1.7a.5.5 0 0 1-.7-.6l.8-3A6.6 6.6 0 0 1 4 11.5Z"' +
    ' stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  var CLOSE_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  var bubbleHost = document.createElement("div");
  bubbleHost.style.all = "initial";
  bubbleHost.style.position = "fixed";
  bubbleHost.style.zIndex = "2147483000";
  bubbleHost.style.bottom = "20px";
  bubbleHost.style.right = "20px";

  var shadow = bubbleHost.attachShadow({ mode: "open" });
  var wrap = document.createElement("div");
  wrap.style.position = "relative";

  var bubble = document.createElement("button");
  bubble.type = "button";
  bubble.style.width = "56px";
  bubble.style.height = "56px";
  bubble.style.borderRadius = "50%";
  bubble.style.border = "none";
  bubble.style.cursor = "pointer";
  bubble.style.background = "linear-gradient(135deg, #f5a623 0%, #ef5b8c 55%, #d94fb0 100%)";
  bubble.style.boxShadow = BUBBLE_SHADOW;
  bubble.style.display = "flex";
  bubble.style.alignItems = "center";
  bubble.style.justifyContent = "center";
  bubble.style.color = "#ffffff";
  bubble.style.fontFamily = "system-ui, sans-serif";
  bubble.style.fontSize = "22px";
  bubble.style.padding = "0";
  bubble.style.outline = "none";

  // Hover, pressed and keyboard-focus states, done in JS because a shadow root
  // styled through the CSSOM has no stylesheet to hang :hover/:focus-visible on.
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) bubble.style.transition = "transform 150ms ease, box-shadow 150ms ease";

  function setBubbleScale(scale) {
    if (reduceMotion) return;
    bubble.style.transform = "scale(" + scale + ")";
  }

  bubble.addEventListener("mouseenter", function () {
    setBubbleScale(1.05);
    bubble.style.boxShadow = BUBBLE_SHADOW_HOVER;
  });
  bubble.addEventListener("mouseleave", function () {
    setBubbleScale(1);
    bubble.style.boxShadow = BUBBLE_SHADOW;
  });
  bubble.addEventListener("mousedown", function () {
    setBubbleScale(0.96);
  });
  bubble.addEventListener("mouseup", function () {
    setBubbleScale(1.05);
  });
  bubble.addEventListener("focus", function () {
    var keyboard = true;
    try {
      keyboard = bubble.matches(":focus-visible");
    } catch (error) {
      // Older engines without :focus-visible: show the ring rather than hide it.
    }
    if (keyboard) bubble.style.boxShadow = BUBBLE_SHADOW_FOCUS;
  });
  bubble.addEventListener("blur", function () {
    bubble.style.boxShadow = BUBBLE_SHADOW;
  });
  bubble.addEventListener("click", toggle);

  var badge = document.createElement("span");
  badge.style.position = "absolute";
  badge.style.top = "-2px";
  badge.style.right = "-2px";
  badge.style.width = "12px";
  badge.style.height = "12px";
  badge.style.borderRadius = "50%";
  badge.style.background = "#f2c438";
  badge.style.border = "2px solid #ffffff";
  badge.style.display = "none";

  wrap.appendChild(bubble);
  wrap.appendChild(badge);
  shadow.appendChild(wrap);
  setBubbleIcon();

  // ---- iframe -> host messages, only ever accepted from our own iframe. ----
  window.addEventListener("message", function (event) {
    if (event.origin !== APP_ORIGIN) return;
    if (!state.iframe || event.source !== state.iframe.contentWindow) return;

    var data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "unread") {
      if (!state.open) setUnread(true);
    } else if (data.type === "close") {
      close();
    }
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncMode, 150);
  });

  /**
   * The panel is a full page load — SSR, theme lookup, React bundle. Doing it
   * on the first click made the first open feel broken, so the iframe is
   * created (hidden) once the host page is idle. It costs one request the
   * visitor may never use; it buys an instant first open.
   */
  function prewarm() {
    if (state.iframe) return;
    ensureIframe();
  }

  function schedulePrewarm() {
    var idle = window.requestIdleCallback;
    if (idle) idle(prewarm, { timeout: 4000 });
    else setTimeout(prewarm, 1500);
  }

  function mount() {
    document.body.appendChild(bubbleHost);
    if (document.readyState === "complete") schedulePrewarm();
    else window.addEventListener("load", schedulePrewarm, { once: true });
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener("DOMContentLoaded", mount);
  }

  window.ChatWidget = { open: open, close: close, ask: ask };
})();
