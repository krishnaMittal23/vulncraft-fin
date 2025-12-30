import useGitHub from "@/hooks/useGithub";
import { useEffect, useMemo, useState } from "react";
import { RepositoryHeader } from "@/components/dashboard/repository/RepositoryHeader";
import { RepositoryBoxCard } from "@/components/dashboard/repository/RepositoryBoxCard";
import { RepositoryLoader } from "@/components/dashboard/repository/RepositoryLoader";
import { RepositoryError } from "@/components/dashboard/repository/RepositoryError";

const RepositoryList = () => {
  const { repos, fetchRepositories, loading, error } = useGitHub();
  const [searchQuery, setSearchQuery] = useState("");

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
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 flex flex-col h-full bg-zinc-950 rounded-xl">
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
              <RepositoryBoxCard key={repo.name} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepositoryList;
