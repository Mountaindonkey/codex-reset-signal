import { expect, it, vi } from "vitest";
import { runDetectionProbe } from "../scripts/detection-probe";

const env = {
  RESEND_API_KEY: "test-key",
  EMAIL_FROM: "sender@example.com",
  EMAIL_TO: "recipient@example.com",
};
const post = {
  id: "2113162413008884099",
  text: "lands tomorrow before 10am PST",
  createdAt: "2026-10-22T06:55:54.577Z",
  url: "https://x.com/thsottiaux/status/2113162413008884099",
  media: [],
};

it("lets normal detection decide, delivers through the email adapter, and deduplicates", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "provider-accepted" }));
  const result = await runDetectionProbe(post, env, fetcher);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("https://api.resend.com/emails");
  const email = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(email.subject).toContain("检测链路测试");
  expect(email.text).toContain(post.text);
  expect(email.text).toContain(post.url);
  expect(email.text).toContain("未确认");
  expect(result).toMatchObject({ matched: true, eventTypes: ["mention"], emailRequests: 1, accepted: 1, secondPollEmailRequests: 0, pending: 0 });
});

it("does not send when the injected post fails the real detector", async () => {
  const fetcher = vi.fn();
  const result = await runDetectionProbe({ ...post, text: "Great photo!" }, env, fetcher);
  expect(fetcher).not.toHaveBeenCalled();
  expect(result).toMatchObject({ matched: false, accepted: 0, emailRequests: 0 });
});
