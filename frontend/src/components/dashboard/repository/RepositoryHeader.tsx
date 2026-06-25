import { Search } from "lucide-react";

interface RepositoryHeaderProps {
  totalRepos: number;
  onSearch: (query: string) => void;
}

export const RepositoryHeader = ({
  totalRepos,
  onSearch,
}: RepositoryHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#e5e1e4]">
          Repositories
        </h1>
        <div className="hidden h-6 w-px bg-[#27272a] md:block" />
        <span
          className="rounded-md bg-[#4be277]/10 px-2 py-0.5 text-xs text-[#4be277]"
          style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
        >
          {totalRepos} repositories
        </span>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#bccbb9]" />
        <input
          type="search"
          placeholder="Filter repositories…"
          onChange={(e) => onSearch(e.target.value)}
          className="w-full rounded-xl border border-[#27272a] bg-[#0e0e10] py-2 pl-10 pr-4 text-sm text-[#e5e1e4] placeholder:text-[#bccbb9]/60 transition-all focus:border-[#4be277] focus:outline-none focus:ring-1 focus:ring-[#4be277]/20"
        />
      </div>
    </div>
  );
};
