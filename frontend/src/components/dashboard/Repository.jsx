import useGitHub from "@/hooks/useGithub";
import { useEffect, useMemo, useState } from "react";
import { ScanLine } from "lucide-react";
import { RepositoryHeader } from "@/components/dashboard/repository/RepositoryHeader";
import { RepositoryBoxCard } from "@/components/dashboard/repository/RepositoryBoxCard";
import { RepositoryLoader } from "@/components/dashboard/repository/RepositoryLoader";
import { RepositoryError } from "@/components/dashboard/repository/RepositoryError";
import { ChatAssistant } from "@/components/dashboard/repository/ChatAssistant";

const RepositoryList = () => {
  const { repos, fetchRepositories, loading, error } = useGitHub();
  const [searchQuery, setSearchQuery] = useState("");
  const [analyzeRepo, setAnalyzeRepo] = useState(null);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  const filteredRepos = useMemo(() => {
    if (!searchQuery) return repos;

    const query = searchQuery.toLowerCase();
    return repos.filter((repo) => {
      return (
        repo.name.toLowerCase().includes(query) ||
        (repo.language && repo.language.toLowerCase().includes(query)) ||
        (repo.private ? "private" : "public").includes(query)
      );
    });
  }, [repos, searchQuery]);

  if (error) {
    return <RepositoryError error={error} onRetry={fetchRepositories} />;
  }

  return (
    <div
      className="relative flex-1 px-4 py-6 sm:px-6 lg:px-8 flex flex-col h-full rounded-xl bg-[#09090b] text-[#e5e1e4] overflow-hidden"
      style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#4be277]/5 blur-[120px] -z-0" />

      <div className="relative z-10 flex flex-col h-full min-h-0">
        <RepositoryHeader
          totalRepos={filteredRepos.length}
          onSearch={setSearchQuery}
        />

        <div className="mt-6 scrollbar-hidden overflow-y-auto overflow-x-hidden flex-1">
          {loading ? (
            <RepositoryLoader />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {filteredRepos.map((repo) => (
                <RepositoryBoxCard
                  key={repo.name}
                  repo={repo}
                  onAnalyze={setAnalyzeRepo}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scanner status chip */}
        <div className="mt-4 flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#4be277]/30 bg-[#131315] px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4be277] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4be277]" />
            </span>
            <ScanLine className="h-3.5 w-3.5 text-[#4be277]" />
            <span
              className="text-[11px] tracking-[0.1em] text-[#4be277]"
              style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              SCANNER ACTIVE v2.4.1
            </span>
          </div>
        </div>
      </div>

      {/* Code analysis overlay */}
      {analyzeRepo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <ChatAssistant repo={analyzeRepo} onClose={() => setAnalyzeRepo(null)} />
        </div>
      )}
    </div>
  );
};

export default RepositoryList;
