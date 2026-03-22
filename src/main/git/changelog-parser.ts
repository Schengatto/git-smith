import type { ChangelogEntry, ChangelogGroup, ChangelogData } from "../../shared/git-types";

const COMMIT_PATTERN = /^(\w+)(\(.+?\))?(!)?:\s*(.+)$/;

const GROUP_CONFIG: { types: string[]; label: string; color: string }[] = [
  { types: ["feat"], label: "Features", color: "var(--green)" },
  { types: ["fix"], label: "Bug Fixes", color: "var(--peach)" },
  { types: ["perf"], label: "Performance", color: "var(--mauve)" },
  { types: ["refactor"], label: "Refactoring", color: "var(--blue)" },
  { types: ["docs"], label: "Documentation", color: "var(--teal)" },
  { types: ["test"], label: "Tests", color: "var(--yellow)" },
  { types: ["chore", "build", "ci"], label: "Maintenance", color: "var(--overlay1)" },
];

const BREAKING_COLOR = "var(--red)";
const OTHER_COLOR = "var(--subtext0)";

export function parseChangelog(entries: ChangelogEntry[], from: string, to: string): ChangelogData {
  const breakingEntries: ChangelogEntry[] = [];
  const grouped = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    const parsed = parseSubject(entry.subject);
    const body = entry.description; // preserve raw body before overwrite
    const isBreaking = parsed.breaking || body.includes("BREAKING CHANGE:");

    entry.type = parsed.type;
    entry.scope = parsed.scope;
    entry.description = parsed.description;
    entry.breaking = isBreaking;

    if (isBreaking) {
      breakingEntries.push(entry);
    } else {
      const groupLabel = findGroupLabel(parsed.type);
      const existing = grouped.get(groupLabel) || [];
      existing.push(entry);
      grouped.set(groupLabel, existing);
    }
  }

  const groups: ChangelogGroup[] = [];

  if (breakingEntries.length > 0) {
    groups.push({
      label: "Breaking Changes",
      color: BREAKING_COLOR,
      entries: breakingEntries,
    });
  }

  for (const config of GROUP_CONFIG) {
    const groupEntries = grouped.get(config.label);
    if (groupEntries && groupEntries.length > 0) {
      groups.push({
        label: config.label,
        color: config.color,
        entries: groupEntries,
      });
    }
  }

  const otherEntries = grouped.get("Other");
  if (otherEntries && otherEntries.length > 0) {
    groups.push({
      label: "Other",
      color: OTHER_COLOR,
      entries: otherEntries,
    });
  }

  const uniqueAuthors = [...new Set(entries.map((e) => e.authorName))];

  return {
    from,
    to,
    groups,
    totalCommits: entries.length,
    authors: uniqueAuthors,
  };
}

function parseSubject(subject: string): {
  type: string;
  scope?: string;
  breaking: boolean;
  description: string;
} {
  const match = subject.match(COMMIT_PATTERN);
  if (!match) {
    return { type: "other", breaking: false, description: subject };
  }
  return {
    type: match[1]!,
    scope: match[2] ? match[2].slice(1, -1) : undefined,
    breaking: match[3] === "!",
    description: match[4]!,
  };
}

function findGroupLabel(type: string): string {
  for (const config of GROUP_CONFIG) {
    if (config.types.includes(type)) return config.label;
  }
  return "Other";
}
