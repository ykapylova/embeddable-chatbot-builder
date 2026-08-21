import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { charsAfterReplacing, rollingPeriodStart } from "./plan.service";

describe("charsAfterReplacing", () => {
  const sources = [
    { id: "a", charCount: 40_000 },
    { id: "b", charCount: 60_000 },
  ];

  it("adds a new source on top of everything already indexed", () => {
    // A new row exists with charCount 0 by the time this runs, so excluding it
    // by id changes nothing — the incoming length is the whole contribution.
    assert.equal(charsAfterReplacing([...sources, { id: "new", charCount: 0 }], "new", 30_000), 130_000);
  });

  it("treats a reindex as a swap, not an addition", () => {
    // Reindexing "b" with longer text must not count b's old 60,000 as well,
    // or a source would be refused for its own weight.
    assert.equal(charsAfterReplacing(sources, "b", 90_000), 130_000);
  });

  it("lets a reindex shrink the total", () => {
    assert.equal(charsAfterReplacing(sources, "b", 1_000), 41_000);
  });

  it("counts an empty knowledge base as just the incoming source", () => {
    assert.equal(charsAfterReplacing([], "new", 500), 500);
  });
});

describe("rollingPeriodStart", () => {
  it("returns the account's signup date when the current period just started", () => {
    const start = rollingPeriodStart("2026-01-15T09:00:00.000Z", new Date("2026-01-20T00:00:00.000Z"));
    assert.equal(start, "2026-01-15");
  });

  it("rolls forward to the most recent monthly anniversary", () => {
    const start = rollingPeriodStart("2026-01-15T09:00:00.000Z", new Date("2026-03-20T00:00:00.000Z"));
    assert.equal(start, "2026-03-15");
  });

  it("does not roll forward before the anniversary day arrives", () => {
    const start = rollingPeriodStart("2026-01-15T09:00:00.000Z", new Date("2026-03-10T00:00:00.000Z"));
    assert.equal(start, "2026-02-15");
  });

  it("never lands on a calendar-month boundary shared by every account", () => {
    // Two accounts created on different days must not both roll over on the 1st.
    const a = rollingPeriodStart("2026-01-07T00:00:00.000Z", new Date("2026-04-10T00:00:00.000Z"));
    const b = rollingPeriodStart("2026-01-22T00:00:00.000Z", new Date("2026-04-10T00:00:00.000Z"));
    assert.equal(a, "2026-04-07");
    assert.equal(b, "2026-03-22");
    assert.notEqual(a.slice(-2), "01");
    assert.notEqual(b.slice(-2), "01");
  });

  it("clamps a day-31 anchor into shorter months instead of overflowing", () => {
    // Signed up Jan 31; by late Feb there is no Feb 31, so the period starts Feb 28.
    const start = rollingPeriodStart("2026-01-31T00:00:00.000Z", new Date("2026-02-27T00:00:00.000Z"));
    assert.equal(start, "2026-01-31");

    const nextPeriod = rollingPeriodStart("2026-01-31T00:00:00.000Z", new Date("2026-03-01T00:00:00.000Z"));
    assert.equal(nextPeriod, "2026-02-28");
  });
});
