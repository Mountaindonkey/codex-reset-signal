import { appendFile, readFile } from "node:fs/promises";
import { runDetectionProbe } from "./detection-probe";
import type { XPost } from "../src/types";

try {
  const post = JSON.parse(await readFile("fixtures/live-detection-probe.json", "utf8")) as XPost;
  const result = await runDetectionProbe(post, process.env);
  const report = JSON.stringify(result, null, 2);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Injected detection → real email test\n\n\`\`\`json\n${report}\n\`\`\`\n`);
  if (!result.matched || !result.accepted || result.pending) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Detection probe failed.");
  process.exitCode = 1;
}
