/**
 * nyuchi_report_issue backend: files a GitHub issue on the Nyuchi Tools repo so
 * any MCP caller (agent or human) can turn "I hit a bug in the Studio"
 * into a tracked issue with repro details, in the moment.
 *
 * The target repo and token are configured server-side — callers never
 * choose where issues land:
 *
 *   FEEDBACK_REPO          — Worker var, `owner/repo` (defaults to the
 *                            nyuchi/workspace-tools monorepo)
 *   GITHUB_FEEDBACK_TOKEN  — secret (`wrangler secret put
 *                            GITHUB_FEEDBACK_TOKEN`), a fine-grained token
 *                            with Issues: write on that repo.
 */

export interface FeedbackEnv {
  FEEDBACK_REPO?: string;
  GITHUB_FEEDBACK_TOKEN?: string;
}

export const DEFAULT_FEEDBACK_REPO = "nyuchi/workspace-tools";

export type FeedbackSeverity = "low" | "medium" | "high";
export type FeedbackCategory = "bug" | "missing_capability" | "confusing_output" | "documentation";

export interface FeedbackInput {
  title: string;
  description: string;
  toolName: string;
  severity: FeedbackSeverity;
  category: FeedbackCategory;
}

export function feedbackConfigured(env: FeedbackEnv): boolean {
  return Boolean(env.GITHUB_FEEDBACK_TOKEN) && /^[\w.-]+\/[\w.-]+$/.test(feedbackRepo(env));
}

export function feedbackRepo(env: FeedbackEnv): string {
  return env.FEEDBACK_REPO || DEFAULT_FEEDBACK_REPO;
}

export interface FiledIssue {
  url: string;
  number: number;
}

export async function createFeedbackIssue(env: FeedbackEnv, input: FeedbackInput): Promise<FiledIssue> {
  if (!feedbackConfigured(env)) {
    throw new Error(
      "Issue reporting is not configured on this server (GITHUB_FEEDBACK_TOKEN unset).",
    );
  }

  const body = [
    `**Tool:** \`${input.toolName}\``,
    `**Severity:** ${input.severity}`,
    `**Category:** ${input.category}`,
    "",
    input.description,
    "",
    "---",
    "_Filed via the `nyuchi_report_issue` tool on the nyuchi-tools MCP server._",
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${feedbackRepo(env)}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_FEEDBACK_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "nyuchi-tools-mcp",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: `[${input.toolName}] ${input.title}`,
      body,
      labels: ["mcp-feedback", input.category, `severity:${input.severity}`],
    }),
  });

  interface IssueResponse {
    html_url?: string;
    number?: number;
    message?: string;
  }
  let json: IssueResponse | null = null;
  try {
    json = (await res.json()) as IssueResponse;
  } catch {
    // fall through to the status-based error below
  }
  if (!res.ok || !json?.html_url || typeof json.number !== "number") {
    const detail = json?.message || `HTTP ${res.status}`;
    throw new Error(`Filing the GitHub issue failed: ${detail}`);
  }
  return { url: json.html_url, number: json.number };
}
