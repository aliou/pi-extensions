export const REVIEW_MESSAGE_TYPE = "review";

export interface CompletionItem {
  value: string;
  label: string;
  description: string;
}

export interface ReviewComment {
  file: string;
  line: number;
  comment: string;
}

export interface ReviewDetails {
  comments: ReviewComment[];
  range: string;
}

export interface ReviewMessage {
  content: unknown;
  details?: ReviewDetails;
}

export const REVIEW_FLAGS: CompletionItem[] = [
  {
    value: "--current",
    label: "--current",
    description: "Current commit only (HEAD^..HEAD)",
  },
  {
    value: "--staged",
    label: "--staged",
    description: "Staged changes",
  },
  {
    value: "--unstaged",
    label: "--unstaged",
    description: "Unstaged changes",
  },
];
