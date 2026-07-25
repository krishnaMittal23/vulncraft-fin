import { useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/constant";
import { authFetch } from "@/lib/api";
const useGitHub = () => {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRepositories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`${BACKEND_URL}/api/github/repos`);
      if (!response.ok) throw new Error("Failed to fetch repositories");
      const repo = await response.json();
      setRepos(repo);
      // Store full repository name in "owner/repo" format for GitHub API
      const repoFullNameList = Array.isArray(repo)
        ? repo.map((repo) => repo.full_name || `${repo.owner?.login}/${repo.name}`)
        : [];
      localStorage.setItem("repos", JSON.stringify(repoFullNameList));
    } catch (err) {
      setError(err.message || "Failed to fetch repositories");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    repos,
    loading,
    error,
    fetchRepositories,
  };
};

export default useGitHub;
