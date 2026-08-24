/**
 * The demo knowledge base and the traffic that has supposedly already hit it.
 *
 * Kept apart from the mechanics in `seed.ts` so the story a reviewer sees on
 * first login can be edited without reading any database code. Every answer
 * here is one the real pipeline would produce from these sources — the seed is
 * a rehearsal of the product, not a mock of it.
 */

export const DEMO_BOT = {
  name: "Harbor Coffee Support",
  welcomeMessage: "Hi! I'm Harbor's support bot. Ask me about orders, subscriptions or brewing.",
  fallbackMessage:
    "I could not find this in our docs. Leave your email and our team will get back to you.",
  systemPrompt:
    "You support customers of Harbor Coffee Roasters, a small-batch coffee subscription. Be warm and practical, and never guess at shipping times or prices.",
  tone: "friendly",
  theme: {
    accentColor: "#0f766e",
    placeholder: "Ask about orders, subscriptions or brewing…",
  },
  allowedDomains: ["harborcoffee.example"],
} as const;

/** Written as a support team would write them: short, specific, quotable. */
export const DEMO_SOURCES = [
  {
    kind: "text" as const,
    title: "Shipping and returns",
    content: `Shipping and returns

Dispatch
We roast to order on Mondays and Thursdays. Orders placed before 15:00 GMT on a roast day are dispatched the same evening; everything else goes out on the next roast day.

Delivery times
United Kingdom: 1-2 working days with Royal Mail Tracked 24.
European Union: 3-5 working days with DHL. Duties are paid by Harbor, so there is nothing to settle on delivery.
United States and Canada: 5-8 working days with DHL Express.

Shipping cost
UK delivery is £3.95, and free on orders over £30. EU delivery is £7.50. US and Canada delivery is £14.00. Subscription orders always ship free, wherever they go.

Returns
Coffee is a fresh food product, so we cannot resell a returned bag. If a bag arrives damaged, stale or simply not to your taste, email hello@harborcoffee.example within 14 days of delivery and we will replace it or refund it in full. Keep the bag — we do not ask you to send it back.

Equipment returns
Grinders, drippers and scales can be returned unused within 30 days for a full refund. Return postage is on us if the item is faulty, and £4.50 otherwise.

Lost parcels
If tracking has not moved for 5 working days, tell us and we will send a replacement immediately rather than waiting for the courier's investigation to close.`,
  },
  {
    kind: "text" as const,
    title: "Subscriptions and billing",
    content: `Subscriptions and billing

Plans
A Harbor subscription delivers either 250g or 1kg of coffee, every week, fortnight or month. You choose a roast profile — Bright, Balanced or Deep — and we pick the coffee that fits it from that week's roast.

Prices
250g: £11.50 per delivery. 1kg: £38.00 per delivery. Shipping is included on every subscription delivery.

Billing
Your card is charged the evening before each roast, not on the day you signed up. You will always see the charge before the coffee is roasted, so a failed payment never turns into a missed delivery — we retry for 24 hours and email you.

Pausing
You can pause a subscription for up to 8 weeks from the Deliveries page in your account. Pausing before the roast-eve charge means you are not billed for the skipped delivery. There is no limit on how often you pause.

Changing your coffee
Roast profile, bag size and frequency can be changed at any time, and the change applies to the next delivery that has not been charged yet.

Cancelling
Cancel from the Deliveries page with no notice period and no fee. A delivery that has already been charged still ships. We do not offer partial refunds on a delivery that has left the roastery.

Gift subscriptions
Gift subscriptions are prepaid for 3, 6 or 12 deliveries and do not renew automatically.`,
  },
  {
    kind: "faq" as const,
    question: "Do you offer wholesale pricing for cafés and offices?",
    answer:
      "Yes. Wholesale starts at 6kg per month and is priced at £22.00 per kilogram, with free weekly delivery inside the M25 and free courier delivery elsewhere in the UK. Wholesale accounts are invoiced monthly on 30-day terms rather than charged to a card. Email wholesale@harborcoffee.example with your expected monthly volume and we will send a sample box before you commit.",
  },
  {
    kind: "faq" as const,
    question: "How should I store coffee once the bag is open?",
    answer:
      "Keep the bag itself, roll it down and press the air out — our bags have a one-way valve and a resealable strip, which beats any jar. Store it somewhere cool and dark, but not in the fridge: coffee takes on the smell of everything around it and condensation ruins it. Do not freeze coffee you are drinking day to day. Whole beans hold their flavour for about four weeks after roasting, ground coffee for about a week.",
  },
] as const;

type DemoTurn = {
  /** Days before now the conversation happened. */
  daysAgo: number;
  channel: "app" | "widget";
  pageUrl?: string;
  question: string;
  answer: string;
  /** Titles of the sources the answer cites, in marker order. Empty = a failure. */
  cites: string[];
  rating?: 1 | -1;
  lead?: { email: string; name: string };
};

/**
 * `cites` names sources by title; `seed.ts` resolves them to real ids, so a
 * citation in the seeded history clicks through to a real document exactly as a
 * live one does.
 */
export const DEMO_CONVERSATIONS: DemoTurn[] = [
  {
    daysAgo: 6,
    channel: "app",
    question: "How long does delivery take to Germany?",
    answer:
      "Deliveries to the European Union take 3-5 working days with DHL, and duties are paid by Harbor so there is nothing to settle when the parcel arrives [1]. Bear in mind that we roast to order on Mondays and Thursdays — the clock starts from the next roast day after your order, or the same evening if you ordered before 15:00 GMT on one [1].",
    cites: ["Shipping and returns"],
    rating: 1,
  },
  {
    daysAgo: 5,
    channel: "widget",
    pageUrl: "https://harborcoffee.example/subscriptions",
    question: "Can I pause my subscription while I'm away?",
    answer:
      "Yes — you can pause for up to 8 weeks from the Deliveries page in your account, as often as you like [1]. Pause before the roast-eve charge and you will not be billed for the skipped delivery at all [1].",
    cites: ["Subscriptions and billing"],
    rating: 1,
  },
  {
    daysAgo: 4,
    channel: "widget",
    pageUrl: "https://harborcoffee.example/",
    question: "What does the 1kg bag cost on subscription?",
    answer: "A 1kg subscription delivery is £38.00, and shipping is included on every subscription delivery [1].",
    cites: ["Subscriptions and billing"],
  },
  {
    daysAgo: 4,
    channel: "widget",
    pageUrl: "https://harborcoffee.example/shipping",
    question: "My beans arrived crushed. What now?",
    answer:
      "Email hello@harborcoffee.example within 14 days of delivery and we will replace the bag or refund it in full — and please keep the bag, we do not ask for damaged coffee back [1].",
    cites: ["Shipping and returns"],
  },
  {
    daysAgo: 3,
    channel: "app",
    question: "Should I keep coffee in the freezer?",
    answer:
      "Not for the coffee you are drinking day to day. Keep the bag itself, roll it down and press the air out — the one-way valve and resealable strip beat any jar — and store it somewhere cool and dark rather than in the fridge or freezer, because coffee picks up surrounding smells and condensation ruins it [1].",
    cites: ["How should I store coffee once the bag is open?"],
  },
  {
    daysAgo: 2,
    channel: "widget",
    pageUrl: "https://harborcoffee.example/wholesale",
    question: "We run a 20-person office. Can we buy directly from you?",
    answer:
      "Yes. Wholesale starts at 6kg a month at £22.00 per kilogram, with free delivery across the UK, and wholesale accounts are invoiced monthly on 30-day terms rather than charged to a card [1]. Email wholesale@harborcoffee.example with your expected monthly volume and we will send a sample box first [1].",
    cites: ["Do you offer wholesale pricing for cafés and offices?"],
  },
  {
    daysAgo: 2,
    channel: "widget",
    pageUrl: "https://harborcoffee.example/subscriptions",
    question: "Is the Deep roast decaf?",
    answer:
      "Deep is one of our three roast profiles, alongside Bright and Balanced, and you pick one when you start a subscription [1]. Our documentation does not say whether a decaffeinated option exists, so I would rather not guess.",
    cites: ["Subscriptions and billing"],
    rating: -1,
  },
  {
    daysAgo: 1,
    channel: "widget",
    pageUrl: "https://harborcoffee.example/shipping",
    question: "Do you ship to Japan?",
    answer:
      "I could not find this in our docs. Leave your email and our team will get back to you.",
    cites: [],
    lead: { email: "mika.tanaka@example.com", name: "Mika Tanaka" },
  },
];

// ─── The landing page's own demo bot ────────────────────────────────────────

/**
 * PROJECT_SPEC.md §11 puts a working widget on the landing page, trained on the
 * product's own documentation — a visitor tests the product before signing up.
 * These sources are that documentation, and every number in them is the number
 * `lib/plans.ts` actually enforces.
 */
export const DOCSY_BOT = {
  name: "Docsy",
  welcomeMessage: "Hi — ask me anything about Docsy's setup, pricing, or the widget.",
  fallbackMessage:
    "That is not in our documentation. Leave your email and we will answer it properly.",
  systemPrompt:
    "You answer questions about Docsy itself for visitors on its landing page. Be concrete and short, quote the real numbers, and never speculate about a feature the documentation does not mention.",
  tone: "concise",
  theme: {
    accentColor: "#e11d63",
    placeholder: "Ask about pricing, setup or the widget…",
  },
} as const;

export const DOCSY_SOURCES = [
  {
    kind: "text" as const,
    title: "Plans and credits",
    content: `Docsy plans and credits

What a credit is
One credit is one answer. An answer from the default model, GPT-4o-mini, costs 1 credit. An answer from GPT-4o costs 5 credits, and GPT-4o is available on the Business plan only. A question the bot cannot answer is not charged.

Free — $0 per month
100 credits a month, 1 bot, 5 sources, 400,000 characters of knowledge, 1 embed domain, answers with source citations, and the "Powered by Docsy" badge on the widget. No card required.

Pro — $29 per month, or $290 a year
2,000 credits a month, 3 bots, 100 sources per bot, 5,000,000 characters, 5 embed domains, no badge. Adds lead capture when the bot cannot answer, the unanswered-questions dashboard, 90 days of conversation history and CSV export.

Business — $99 per month, or $990 a year
10,000 credits a month, 10 bots, unlimited sources and domains, 20,000,000 characters, 12 months of history, and GPT-4o answers at 5 credits each. Everything in Pro.

Annual billing
Paying annually gives two months free — 10 months for 12.

What happens at the limit
The widget never goes silent. Once the month's credits are used up the bot stops answering and starts collecting the visitor's contact details instead, so the question still reaches you. Paid plans get a 10% grace buffer above their allowance before that happens.

Changing or cancelling
Upgrades and downgrades go through the Stripe Billing Portal and take effect immediately. Cancelling keeps your access until the end of the period you have already paid for. A downgrade locks whatever is over the new plan's limits — it never deletes a bot, a source or a conversation.`,
  },
  {
    kind: "text" as const,
    title: "Sources and indexing",
    content: `How Docsy indexes your documentation

Accepted sources
PDF, TXT and Markdown files up to 20MB each, a web page by URL, text pasted straight into the app, and single question-and-answer FAQ entries. Several files can be uploaded at once.

What happens to a source
The text is extracted, normalised, split into overlapping chunks and embedded with OpenAI's text-embedding-3-small model. Nothing is written to the knowledge base until every chunk has embedded successfully, so a source is either fully indexed or marked failed — never half there.

When it fails
A failed source says why on the Knowledge tab: a scanned PDF with no text layer, a page with no readable content, a URL that does not resolve, a file over the plan's character allowance. Fix the cause and press Reindex; the source keeps its place.

Re-indexing
A URL source can be re-read at any time to pick up changes to the page. Re-indexing replaces the old chunks rather than adding to them.

Deleting
Deleting a source removes its chunks and its stored file immediately, and deleting a bot removes everything belonging to it. Cached answers are dropped whenever the knowledge base changes, so an answer is never served from documentation you have removed.`,
  },
  {
    kind: "text" as const,
    title: "The widget on your site",
    content: `Embedding the Docsy widget

The snippet
One line, pasted before the closing body tag of any page: a script tag pointing at Docsy's widget.js with your bot's public key in a data attribute. It has no dependencies, adds no CSS to your page, and renders the chat inside an iframe so nothing of yours can clash with it.

The public key is not a secret
It is visible in your page source by design. What protects the bot is the domain allowlist: the widget only answers requests whose page is on a domain you have listed. A page on any other domain gets a 403, and a bot with an empty list allows nothing at all. Free allows one domain, Pro five, Business as many as you like.

Testing locally
Add "localhost" to the allowlist and serve your test page over HTTP. A file opened straight from disk sends no domain at all, so the allowlist refuses it — that is the protection working, not a bug.

Appearance
Accent colour, greeting, input placeholder, avatar and which corner the bubble sits in are all set on the Appearance tab, with a live preview beside the form. Paid plans can remove the "Powered by Docsy" badge.`,
  },
  {
    kind: "text" as const,
    title: "Answers, citations and gaps",
    content: `How Docsy answers, and what it does when it cannot

Citations
Every answer is built only from the chunks retrieved from your documentation, and each one carries numbered markers that link back to the source they came from. The citation list comes from retrieval rather than from the model, so it is trustworthy even when the wording is loose.

Saying "I don't know"
If nothing relevant is retrieved, or the retrieved context does not actually answer the question, the bot says so in your own words — the fallback message you set on the bot. It does not guess, and a non-answer is not charged as a credit.

Content gaps
Every unanswered question, and every answer a visitor marked with a thumbs-down, lands on the Content gaps dashboard, grouped by question and ordered by how often it was asked. One click turns any of them into an FAQ entry, and the bot answers it from then on. Free sees the count; Pro and Business see the list.

Lead capture
On Pro and Business, a bot that cannot answer offers to take the visitor's email. The contact and the question that prompted it appear on the Leads tab, exportable as CSV, each one linked to the conversation it came from.

Privacy
Your documents are stored in a private bucket and are never used to train any model. Conversations are kept for as long as your plan's history window — 7 days on Free, 90 days on Pro, 12 months on Business.

Languages
The bot answers in the language of the question, whatever language the documentation is written in.`,
  },
] as const;
