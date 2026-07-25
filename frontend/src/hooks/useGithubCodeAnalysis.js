import { useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/constant";
import { authHeaders } from "@/lib/api";
import useAuth from "@/hooks/useAuth";




export const useGithubCodeAnalysis = ()=> {
  const [repoFiles, setRepoFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const fetchRepositoryContents = useCallback(
    async (repo) => {
      const owner = user?.username;

      setLoadingRepo(true);
      setError(null);
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/github/repo/${owner}/${repo}`,
          { headers: { ...authHeaders() } }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch repository contents: ${response.statusText}`
          );
        }

        const repoFiles = await response.json();
        setRepoFiles(repoFiles);
        return repoFiles;
      } catch (err) {
        const errorMessage =
          err.message || "Failed to fetch repository contents";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoadingRepo(false);
      }
    },
    [user]
  );

  const analyzeCode = useCallback(
    async (question) => {
      if (!repoFiles.length) {
        setError("No repository files loaded");
        return;
      }

      setLoadingAnalysis(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/code/query`, {
          method: "POST", headers: { ...authHeaders() },
          body: JSON.stringify({
            question,
            code: repoFiles,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to analyze code: ${response.statusText}`);
        }

        const data = await response.json();
        setAnalysis(data);
        return data;
      } catch (err) {
        const errorMessage = err.message || "Failed to analyze code";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoadingAnalysis(false);
      }
    },
    [repoFiles]
  );

  return {
    repoFiles,
    analysis,
    loadingRepo,
    loadingAnalysis,
    error,
    fetchRepositoryContents,
    analyzeCode,
  };
};
