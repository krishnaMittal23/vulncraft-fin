import { useState, useCallback } from "react";
import { BACKEND_URL } from "@/lib/constant";
import useAuth from "@/hooks/useAuth";

interface RepoFile {
  path: string;
  content: string;
  isBinary: boolean;
}

interface CodeAnalysisResponse {
  response: {
    summary: string;
    key_features: string[];
    potential_issues: string[];
    best_practices: string[];
  };
}

interface UseGithubCodeAnalysisReturn {
  repoFiles: RepoFile[];
  analysis: CodeAnalysisResponse | null;
  loadingRepo: boolean;
  loadingAnalysis: boolean;
  error: string | null;
  fetchRepositoryContents: (repo: string) => Promise<void>;
  analyzeCode: (question: string) => Promise<void>;
}

export const useGithubCodeAnalysis = (): UseGithubCodeAnalysisReturn => {
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [analysis, setAnalysis] = useState<CodeAnalysisResponse | null>(null);
  const [loadingRepo, setLoadingRepo] = useState<boolean>(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchRepositoryContents = useCallback(
    async (repo: string) => {
      const owner = user?.username;

      setLoadingRepo(true);
      setError(null);
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/github/repo/${owner}/${repo}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch repository contents: ${response.statusText}`
          );
        }

        const repoFiles = await response.json();
        setRepoFiles(repoFiles);
        return repoFiles;
      } catch (err: any) {
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
    async (question: string) => {
      if (!repoFiles.length) {
        setError("No repository files loaded");
        return;
      }

      setLoadingAnalysis(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/code/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
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
      } catch (err: any) {
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
