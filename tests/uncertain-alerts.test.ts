import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config";
import { extractEvents } from "../src/events";
import { runMonitor } from "../src/monitor";
import { createTargets } from "../src/notifications";
import { emptyState, writeState } from "../src/state";

const post = (text: string) => ({
  id: "2",
  text,
  createdAt: "2026-10-22T06:55:54.577Z",
  url: "https://x.com/thsottiaux/status/2",
  media: [],
});
const timingReply = post("Lands tomorrow before 10am PST.");
const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("uncertain original-post alerts", () => {
  it.each([
    "Lands tomorrow before 10am PST.",
    "Tomorrow morning, stay tuned.",
    "Something nice in a few hours.",
    "See you Monday at 10:00.",
    "Rolling out shortly.",
    "Done and dusted.",
    "Your usage limits are being replenished.",
    "明天上午十点前到账。",
    "今晚有个小惊喜。",
    "额度马上恢复。",
  ])("forwards a possible hint without inventing a confirmed reset: %s", (text) => {
    const events = extractEvents(post(text), "America/Los_Angeles");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "mention",
      status: "uncertain",
      evidence: text,
      time: { kind: "unknown", start: null, end: null },
    });
  });

  it.each(["@romainhuet Very baguette of you", "Great photo!", "Thanks for the feedback."])(
    "ignores an unrelated post: %s", (text) => {
      expect(extractEvents(post(text))).toEqual([]);
    },
  );

  async function fixture(bootstrapped = true, includeMentions = true) {
    const dir = await mkdtemp(join(tmpdir(), "uncertain-alerts-"));
    dirs.push(dir);
    const config = loadConfig({
      STATE_PATH: join(dir, "state.json"),
      INCLUDE_MENTIONS: String(includeMentions),
      RESEND_API_KEY: "test-key",
      EMAIL_FROM: "sender@example.com",
      EMAIL_TO: "recipient@example.com",
    });
    if (bootstrapped)
      await writeState(config.statePath, { ...emptyState("thsottiaux", "reset"), sinceId: "1" });
    const source = {
      resolveUserId: vi.fn().mockResolvedValue("42"),
      getPosts: vi.fn().mockResolvedValue({ posts: [timingReply], newestId: timingReply.id }),
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "test-message" }));
    return { config, source, fetcher, targets: createTargets(config, fetcher) };
  }

  it("delivers the original timing-only reply and URL to email once across polls", async () => {
    const { config, source, fetcher, targets } = await fixture();
    const state = await runMonitor(config, { source, targets });
    await runMonitor(config, { source, targets });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.resend.com/emails");
    const email = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(email.text).toContain(timingReply.text);
    expect(email.text).toContain(timingReply.url);
    expect(email.text).toContain("可能相关");
    expect(email.text).toContain("未确认");
    expect(email.html).toContain(timingReply.text);
    expect(email.html).toContain(timingReply.url);
    expect(state.matches[0].channels).toEqual(["email"]);
    expect(state.matches[0].events[0].type).toBe("mention");
    expect(state.outbox).toEqual([]);
  });

  it("respects the existing uncertain-alert opt-out", async () => {
    const { config, source, fetcher, targets } = await fixture(true, false);
    const state = await runMonitor(config, { source, targets });
    expect(fetcher).not.toHaveBeenCalled();
    expect(state.matches).toEqual([]);
  });

  it("does not replay timing-only history on the first bootstrap", async () => {
    const { config, source, fetcher, targets } = await fixture(false);
    const state = await runMonitor(config, { source, targets });
    expect(fetcher).not.toHaveBeenCalled();
    expect(state.matches).toHaveLength(1);
    expect(state.matches[0].events[0].type).toBe("mention");
  });
});
