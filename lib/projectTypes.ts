export const PROJECT_TYPES = [
  { value: "meo", label: "MEO", accent: "blue" },
  { value: "hp-strong", label: "ストロング", accent: "red" },
  { value: "hp-classic", label: "クラシック", accent: "amber" },
  { value: "hp-beauty", label: "ビューティー", accent: "pink" },
  { value: "hp-recruit", label: "リクルート", accent: "green" },
  { value: "lp", label: "LP", accent: "purple" },
  { value: "portal", label: "ポータルサイト", accent: "cyan" },
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number]["value"];

export const PROJECT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROJECT_TYPES.map((type) => [type.value, type.label])
);

export function isProjectType(value: string | null | undefined): value is ProjectType {
  return PROJECT_TYPES.some((type) => type.value === value);
}
