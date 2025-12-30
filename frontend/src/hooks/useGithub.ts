import { useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/constant";
import type { Repository } from "@/types";
import useAuth from "./useAuth";

const useGitHub = () => {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoFiles, setRepoFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRepositories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/github/repos`, {
        credentials: "include",
      });
      const repo = await response.json();
      setRepos(repo);
      // Store full repository name in "owner/repo" format for GitHub API
      const repoFullNameList = repo.map((repo: any) => repo.full_name || `${repo.owner?.login}/${repo.name}`);
      localStorage.setItem("repos", JSON.stringify(repoFullNameList));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRepositoryContents = useCallback(async (repo: string) => {
    const { user } = useAuth();
    const owner = user?.username;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/github/repo/${owner}/${repo}`,
        {
          credentials: "include",
        }
      );
      const repoFiles = await response.json();
      setRepoFiles(repoFiles);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to fetch repository contents"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    repos,
    repoFiles,
    loading,
    error,
    fetchRepositories,
    fetchRepositoryContents,
  };
};

export default useGitHub;
