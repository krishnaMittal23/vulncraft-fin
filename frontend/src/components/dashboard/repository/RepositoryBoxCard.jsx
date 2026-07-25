import { GitBranch, Lock, Globe, Zap } from "lucide-react";
import { getLanguageColor } from "@/lib/colors";


export const RepositoryBoxCard = ({ repo, onAnalyze }) => {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[#27272a] bg-[#131315] p-5 transition-all duration-300 hover:border-[#3f3f46] hover:-translate-y-0.5">
      {/* Corner glow */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 bg-[#4be277]/5 blur-3xl transition-colors group-hover:bg-[#4be277]/10" />

      {/* Header: name + visibility badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <a
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-2"
        >
          <GitBranch className="h-4 w-4 shrink-0 text-[#bccbb9]" />
          <h3 className="truncate text-base font-bold text-[#e5e1e4] transition-colors group-hover:text-[#4be277]">
            {repo.name}
          </h3>
        </a>

        {repo.private ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#3f3f46] bg-[#27272a] px-2 py-1 text-[10px] tracking-[0.1em] text-[#bccbb9]"
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            <Lock className="h-3 w-3" />
            PRIVATE
          </span>
        ) : (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#4be277]/20 bg-[#4be277]/10 px-2 py-1 text-[10px] tracking-[0.1em] text-[#4be277]"
            style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            <Globe className="h-3 w-3" />
            PUBLIC
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-6 line-clamp-2 flex-1 text-sm text-[#bccbb9]/80">
        {repo.description || "No description provided."}
      </p>

      {/* Footer: language + analyze */}
      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {repo.language && (
            <>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getLanguageColor(repo.language) }}
              />
              <span
                className="truncate text-xs text-[#bccbb9]"
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {repo.language}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAnalyze?.(repo.name)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#4be277] px-4 py-2 text-sm font-bold text-[#003915] transition-all hover:brightness-110 active:scale-95"
        >
          Analyze
          <Zap className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
