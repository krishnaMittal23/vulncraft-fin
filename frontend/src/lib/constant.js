if (!import.meta.env.VITE_BACKEND_URL) {
  console.warn("VITE_BACKEND_URL not set; defaulting to http://localhost:3000");
}

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export const languageColors= {
  TypeScript: "#3178C6",
  JavaScript: "#F7DF1E",
  Python: "#3572A5",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#FFAC45",
  Kotlin: "#A97BFF",
  Dart: "#00C4B3",
  HTML: "#E34C26",
  CSS: "#563D7C",
};
