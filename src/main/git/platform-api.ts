import https from "https";
import type { CIStatus } from "../../shared/git-types";

interface RequestOptions {
  method: string;
  hostname: string;
  path: string;
  headers: Record<string, string>;
}

function request(
  options: RequestOptions,
  body?: string
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          data: Buffer.concat(chunks).toString("utf-8"),
        });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// --- GitHub REST API ---

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "GitSmith",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function githubListPrs(
  owner: string,
  repo: string,
  token: string
): Promise<
  {
    number: number;
    title: string;
    state: string;
    author: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    sourceBranch: string;
    targetBranch: string;
    labels: string[];
  }[]
> {
  const res = await request({
    method: "GET",
    hostname: "api.github.com",
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open&per_page=50`,
    headers: ghHeaders(token),
  });
  if (res.status !== 200) throw new Error(`GitHub API error ${res.status}: ${res.data}`);
  const prs = JSON.parse(res.data);
  return prs.map(
    (pr: {
      number: number;
      title: string;
      state: string;
      user: { login: string };
      html_url: string;
      created_at: string;
      updated_at: string;
      head: { ref: string };
      base: { ref: string };
      labels: { name: string }[];
    }) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      author: pr.user?.login || "",
      url: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      labels: (pr.labels || []).map((l) => l.name),
    })
  );
}

export async function githubCreatePr(
  owner: string,
  repo: string,
  token: string,
  options: {
    title: string;
    body: string;
    targetBranch: string;
    sourceBranch: string;
    draft?: boolean;
  }
): Promise<string> {
  const payload = JSON.stringify({
    title: options.title,
    body: options.body,
    head: options.sourceBranch,
    base: options.targetBranch,
    draft: options.draft || false,
  });
  const res = await request(
    {
      method: "POST",
      hostname: "api.github.com",
      path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      headers: {
        ...ghHeaders(token),
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(payload)),
      },
    },
    payload
  );
  if (res.status !== 201)
    throw new Error(`Failed to create PR: GitHub API ${res.status}: ${res.data}`);
  const pr = JSON.parse(res.data);
  return pr.html_url;
}

export async function githubViewPr(
  owner: string,
  repo: string,
  token: string,
  number: number
): Promise<string> {
  const res = await request({
    method: "GET",
    hostname: "api.github.com",
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`,
    headers: ghHeaders(token),
  });
  if (res.status !== 200) throw new Error(`GitHub API error ${res.status}`);
  const pr = JSON.parse(res.data);
  return [
    `#${pr.number}: ${pr.title}`,
    `State: ${pr.state}`,
    `Author: ${pr.user?.login || "unknown"}`,
    `Branch: ${pr.head?.ref} -> ${pr.base?.ref}`,
    `URL: ${pr.html_url}`,
    "",
    pr.body || "",
  ].join("\n");
}

export async function githubGetCIStatus(
  owner: string,
  repo: string,
  token: string,
  sha: string
): Promise<CIStatus[]> {
  const res = await request({
    method: "GET",
    hostname: "api.github.com",
    path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs?head_sha=${sha}&per_page=10`,
    headers: ghHeaders(token),
  });
  if (res.status !== 200) return [];
  const data = JSON.parse(res.data);
  return (data.workflow_runs || []).map(
    (r: {
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      run_started_at: string;
    }) => {
      let status: CIStatus["status"] = "unknown";
      if (r.status === "completed") status = r.conclusion === "success" ? "success" : "failure";
      else if (r.status === "in_progress") status = "running";
      else if (r.status === "queued" || r.status === "waiting") status = "pending";
      return {
        sha,
        status,
        name: r.name,
        url: r.html_url,
        conclusion: r.conclusion || "",
        startedAt: r.run_started_at || "",
      };
    }
  );
}

// --- GitLab REST API ---

function glHeaders(token: string): Record<string, string> {
  return {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
    "User-Agent": "GitSmith",
  };
}

function glProjectPath(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`);
}

export async function gitlabListMrs(
  owner: string,
  repo: string,
  token: string
): Promise<
  {
    number: number;
    title: string;
    state: string;
    author: string;
    url: string;
    createdAt: string;
    updatedAt: string;
    sourceBranch: string;
    targetBranch: string;
    labels: string[];
  }[]
> {
  const res = await request({
    method: "GET",
    hostname: "gitlab.com",
    path: `/api/v4/projects/${glProjectPath(owner, repo)}/merge_requests?state=opened&per_page=50`,
    headers: glHeaders(token),
  });
  if (res.status !== 200) throw new Error(`GitLab API error ${res.status}: ${res.data}`);
  const mrs = JSON.parse(res.data);
  return mrs.map(
    (mr: {
      iid: number;
      title: string;
      state: string;
      author: { username: string };
      web_url: string;
      created_at: string;
      updated_at: string;
      source_branch: string;
      target_branch: string;
      labels: string[];
    }) => ({
      number: mr.iid,
      title: mr.title,
      state: mr.state,
      author: mr.author?.username || "",
      url: mr.web_url,
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      labels: mr.labels || [],
    })
  );
}

export async function gitlabCreateMr(
  owner: string,
  repo: string,
  token: string,
  options: {
    title: string;
    body: string;
    targetBranch: string;
    sourceBranch: string;
    draft?: boolean;
  }
): Promise<string> {
  const payload = JSON.stringify({
    title: options.draft ? `Draft: ${options.title}` : options.title,
    description: options.body,
    source_branch: options.sourceBranch,
    target_branch: options.targetBranch,
  });
  const res = await request(
    {
      method: "POST",
      hostname: "gitlab.com",
      path: `/api/v4/projects/${glProjectPath(owner, repo)}/merge_requests`,
      headers: {
        ...glHeaders(token),
        "Content-Length": String(Buffer.byteLength(payload)),
      },
    },
    payload
  );
  if (res.status !== 201)
    throw new Error(`Failed to create MR: GitLab API ${res.status}: ${res.data}`);
  const mr = JSON.parse(res.data);
  return mr.web_url;
}

export async function gitlabViewMr(
  owner: string,
  repo: string,
  token: string,
  number: number
): Promise<string> {
  const res = await request({
    method: "GET",
    hostname: "gitlab.com",
    path: `/api/v4/projects/${glProjectPath(owner, repo)}/merge_requests/${number}`,
    headers: glHeaders(token),
  });
  if (res.status !== 200) throw new Error(`GitLab API error ${res.status}`);
  const mr = JSON.parse(res.data);
  return [
    `!${mr.iid}: ${mr.title}`,
    `State: ${mr.state}`,
    `Author: ${mr.author?.username || "unknown"}`,
    `Branch: ${mr.source_branch} -> ${mr.target_branch}`,
    `URL: ${mr.web_url}`,
    "",
    mr.description || "",
  ].join("\n");
}

export async function gitlabGetCIStatus(
  owner: string,
  repo: string,
  token: string,
  sha: string
): Promise<CIStatus[]> {
  const res = await request({
    method: "GET",
    hostname: "gitlab.com",
    path: `/api/v4/projects/${glProjectPath(owner, repo)}/pipelines?sha=${sha}&per_page=10`,
    headers: glHeaders(token),
  });
  if (res.status !== 200) return [];
  const pipelines = JSON.parse(res.data);
  return pipelines.slice(0, 10).map(
    (p: { sha: string; status: string; web_url: string; created_at: string }): CIStatus => ({
      sha,
      status:
        p.status === "success"
          ? "success"
          : p.status === "failed"
            ? "failure"
            : p.status === "running"
              ? "running"
              : "pending",
      name: "Pipeline",
      url: p.web_url || "",
      conclusion: p.status || "",
      startedAt: p.created_at || "",
    })
  );
}
