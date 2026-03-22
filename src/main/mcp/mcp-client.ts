import { getSettings } from "../store";
import type { GitStatus, CommitInfo, CommitFileInfo } from "../../shared/git-types";

/**
 * AI client that calls external AI APIs to generate suggestions.
 * Supports Anthropic and OpenAI providers via their HTTP APIs.
 */
export class McpAiClient {
  /**
   * Generate a commit message from the staged diff and status.
   */
  async generateCommitMessage(diff: string, status: GitStatus): Promise<string> {
    const stagedSummary = status.staged.map((f) => `${f.status}: ${f.path}`).join("\n");
    const prompt = `You are a git commit message generator. Generate a concise, conventional commit message for the following changes.

Staged files:
${stagedSummary}

Diff:
${diff.slice(0, 8000)}

Rules:
- Use conventional commits format (feat:, fix:, refactor:, docs:, chore:, etc.)
- First line max 72 characters
- Be specific about what changed
- Do not include any explanation, only the commit message`;

    return this.callAi(prompt);
  }

  /**
   * Suggest a resolution for a merge conflict.
   */
  async suggestConflictResolution(
    ours: string | null,
    theirs: string | null,
    base: string | null,
    filePath: string
  ): Promise<string> {
    const prompt = `You are a merge conflict resolver. Analyze the following conflict in file "${filePath}" and produce the merged result.

${base ? `BASE (common ancestor):\n${base.slice(0, 4000)}\n` : ""}
OURS (current branch):
${(ours || "(deleted)").slice(0, 4000)}

THEIRS (incoming branch):
${(theirs || "(deleted)").slice(0, 4000)}

Rules:
- Output ONLY the merged file content, no explanations
- Preserve the intent of both changes where possible
- If changes conflict, prefer the more complete/correct version
- Do not include conflict markers`;

    return this.callAi(prompt);
  }

  /**
   * Generate a PR title from commits.
   */
  async generatePrTitle(commits: CommitInfo[], diff: string): Promise<string> {
    const commitLog = commits.map((c) => `- ${c.abbreviatedHash} ${c.subject}`).join("\n");

    const prompt = `You are a PR title generator. Generate a concise, descriptive pull request title.

Commits:
${commitLog}

Diff summary (truncated):
${diff.slice(0, 4000)}

Rules:
- Max 72 characters
- Be specific about what the PR does
- Do not use conventional commit prefixes unless it's a single-commit PR
- Output ONLY the title, no explanation`;

    return this.callAi(prompt);
  }

  /**
   * Generate a PR description from commits and diff.
   * If a PR template is provided, the AI will fill it in instead of using a default format.
   */
  async generatePrDescription(
    commits: CommitInfo[],
    diff: string,
    template?: string | null
  ): Promise<string> {
    const commitLog = commits.map((c) => `- ${c.abbreviatedHash} ${c.subject}`).join("\n");

    const templateInstruction = template
      ? `Use the following PR template and fill in each section based on the changes:\n\n${template}`
      : `Format:
## Summary
<1-3 bullet points>

## Changes
<detailed list of changes>

## Test plan
<suggested testing steps>`;

    const prompt = `You are a PR description generator. Generate a clear, structured PR description.

Commits:
${commitLog}

Diff summary (truncated):
${diff.slice(0, 6000)}

${templateInstruction}

Rules:
- Output ONLY the PR description content, no extra explanation
- Be specific and concise`;

    return this.callAi(prompt);
  }

  /**
   * Review a commit's changes.
   */
  async reviewCommit(hash: string, diff: string, files: CommitFileInfo[]): Promise<string> {
    const fileList = files
      .map((f) => `${f.status}: ${f.path} (+${f.additions}/-${f.deletions})`)
      .join("\n");

    const prompt = `You are a code reviewer. Review the following commit (${hash}).

Files changed:
${fileList}

Diff:
${diff.slice(0, 8000)}

Provide:
1. A brief summary of the changes
2. Potential issues or bugs
3. Suggestions for improvement
4. Overall assessment (looks good / needs changes)

Be concise and actionable.`;

    return this.callAi(prompt);
  }

  private async callAi(prompt: string): Promise<string> {
    const settings = getSettings();

    if (settings.aiProvider === "none") {
      throw new Error("No AI provider configured. Go to Settings > AI to set one up.");
    }

    if (!settings.aiApiKey) {
      throw new Error("API key not configured. Go to Settings > AI to add your API key.");
    }

    if (settings.aiProvider === "anthropic") {
      return this.callAnthropic(
        prompt,
        settings.aiApiKey,
        settings.aiModel || "claude-sonnet-4-20250514"
      );
    } else if (settings.aiProvider === "openai") {
      return this.callOpenAi(
        prompt,
        settings.aiApiKey,
        settings.aiModel || "gpt-4o",
        settings.aiBaseUrl
      );
    } else if (settings.aiProvider === "gemini") {
      return this.callGemini(prompt, settings.aiApiKey, settings.aiModel || "gemini-2.5-flash");
    } else if (settings.aiProvider === "custom-mcp") {
      throw new Error("Custom MCP provider not yet implemented");
    }

    throw new Error(`Unknown AI provider: ${settings.aiProvider}`);
  }

  private async callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  private async callOpenAi(
    prompt: string,
    apiKey: string,
    model: string,
    baseUrl?: string
  ): Promise<string> {
    const url = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`
      : "https://api.openai.com/v1/chat/completions";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  private async callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}
