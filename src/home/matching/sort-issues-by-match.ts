import { GitHubIssue } from "../github-types.ts";
import { calculateTimeLabelValue } from "../sorting/calculate-time-label-value.ts";
import { getLabelText } from "../sorting/label-utils.ts";
import { DeveloperMatchProfile, loadDeveloperMatchProfile } from "./developer-profile.ts";

export function sortIssuesByMatch(issues: GitHubIssue[], profile: DeveloperMatchProfile | null = loadDeveloperMatchProfile()) {
  return issues.sort((a, b) => {
    const scoreDiff = calculateMatchScore(b, profile) - calculateMatchScore(a, profile);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function calculateMatchScore(issue: GitHubIssue, profile: DeveloperMatchProfile | null = loadDeveloperMatchProfile()): number {
  const profileTerms = new Set(profile?.terms.map((term) => term.toLowerCase()) ?? []);
  const profileRepositories = new Set(profile?.repositories.map((repo) => repo.toLowerCase()) ?? []);

  let score = 0;
  const issueRepository = getIssueRepositoryFullName(issue);
  if (issueRepository && profileRepositories.has(issueRepository)) {
    score += 40;
  }

  const issueText = [issue.title, issue.body, ...issue.labels.map(getLabelText)].filter(Boolean).join(" ").toLowerCase();

  for (const term of profileTerms) {
    if (issueText.includes(term)) {
      score += 35;
    }
  }

  score += calculateOpportunityScore(issue);
  return score;
}

function calculateOpportunityScore(issue: GitHubIssue): number {
  let score = 0;

  for (const label of issue.labels) {
    const name = getLabelText(label);
    const priceMatch = name.match(/Price:\s*(\d+)/i);
    if (priceMatch) {
      score += Math.min(Number(priceMatch[1]) / 25, 40);
    }

    const priorityMatch = name.match(/Priority:\s*(\d+)/i);
    if (priorityMatch) {
      score += Number(priorityMatch[1]) * 10;
    }
  }

  let timeEstimate = 0;
  for (const label of issue.labels) {
    const text = getLabelText(label);
    if (text.toLowerCase().includes("time:")) {
      timeEstimate += calculateTimeLabelValue(text);
    }
  }
  if (timeEstimate > 0) {
    score += Math.max(0, 20 - timeEstimate / 1800);
  }

  return score;
}

function getIssueRepositoryFullName(issue: GitHubIssue): string | null {
  if (typeof issue.repository_url !== "string") return null;
  const match = issue.repository_url.match(/repos\/(.+?\/.+?)(?:\/|$)/);
  if (match) return match[1].toLowerCase();

  const htmlMatch = issue.html_url?.match(/github\.com\/(.+?\/.+?)\/issues/i);
  return htmlMatch ? htmlMatch[1].toLowerCase() : null;
}
