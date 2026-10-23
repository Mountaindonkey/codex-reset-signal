import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, validateConfig } from "../src/config";
import { runMonitor } from "../src/monitor";
import { createTargets } from "../src/notifications";
import { emptyState, writeState } from "../src/state";
import type { XPost } from "../src/types";

/** Inject only the collection result. Detection, queueing, delivery and deduplication are real. */
export async function runDetectionProbe(
  post: XPost,
  env: NodeJS.ProcessEnv,
  transport: typeof fetch = fetch,
) {
  const dir = await mkdtemp(join(tmpdir(), "reset-detection-probe-"));
  // Deliberately do not inherit production state paths or other notification channels.
  const config = loadConfig({
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_TO: env.EMAIL_TO,
    STATE_PATH: join(dir, "state.json"),
    INCLUDE_MENTIONS: "true",
  });
  const errors = validateConfig(config);
  if (!config.resendApiKey || !config.emailFrom || !config.emailTo.length)
    errors.push("Configure RESEND_API_KEY, EMAIL_FROM and EMAIL_TO repository secrets.");
  if (config.emailFrom && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
    config.emailFrom.match(/<([^<>]+)>$/)?.[1] ?? config.emailFrom,
  )) errors.push("EMAIL_FROM must contain a valid sender email address.");
  if (config.emailTo.some((email) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)))
    errors.push("EMAIL_TO must contain valid recipient email addresses.");
  if (errors.length) throw new Error(errors.join(" "));

  await writeState(config.statePath, {
    ...emptyState(config.username, config.keyword),
    sinceId: (BigInt(post.id) - 1n).toString(),
  });
  let emailRequests = 0;
  let accepted = 0;
  const responses: Array<{ status: number; code?: string }> = [];
  const observedTransport: typeof fetch = async (url, options) => {
    emailRequests++;
    // Annotate only the outgoing envelope; the detector receives the exact original text.
    const body = JSON.parse(String(options?.body));
    body.subject = `[检测链路测试] ${body.subject}`;
    const response = await transport(url, { ...options, body: JSON.stringify(body) });
    const data = await response.clone().json().catch(() => ({})) as { name?: unknown };
    responses.push({ status: response.status, ...(typeof data.name === "string" && /^[a-z_]+$/.test(data.name) ? { code: data.name } : {}) });
    if (response.ok) accepted++;
    return response;
  };
  const source = {
    async resolveUserId() { return "injected-test-source"; },
    async getPosts() { return { posts: [post], newestId: post.id }; },
  };
  const targets = createTargets(config, observedTransport);
  let state;
  try {
    state = await runMonitor(config, { source, targets });
  } catch {
    throw new Error(`Detection probe failed; email provider responses: ${JSON.stringify(responses)}. No secrets or email addresses are included.`);
  }
  const firstPollRequests = emailRequests;
  const second = await runMonitor(config, { source, targets });
  if (emailRequests !== firstPollRequests) throw new Error("Duplicate delivery detected.");
  return {
    postId: post.id,
    input: post.text,
    matched: state.matches.length > 0,
    eventTypes: state.matches.flatMap((match) => match.events.map((event) => event.type)),
    emailRequests,
    accepted,
    responses,
    secondPollEmailRequests: emailRequests - firstPollRequests,
    pending: second.outbox?.length ?? 0,
  };
}
