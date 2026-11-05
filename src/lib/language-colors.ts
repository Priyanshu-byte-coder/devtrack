/** GitHub's colours for common languages; anything else gets a neutral grey. */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f7df1e",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Ruby: "#701516",
  Shell: "#89e051",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  PHP: "#4F5D95",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Dart: "#00B4AB",
  "Jupyter Notebook": "#DA5B0B",
  Vue: "#41b883",
  SCSS: "#c6538c",
};

export function languageColor(name: string | null | undefined): string {
  return (name && LANGUAGE_COLORS[name]) || "#8b949e";
}
