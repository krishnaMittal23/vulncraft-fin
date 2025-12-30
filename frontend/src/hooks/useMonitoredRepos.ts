import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const DJANGO_SERVICES_URL = "http://localhost:8000";

export interface MonitoredRepo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  github_repo_id: number;
  is_active: boolean;
  created_at: string;
  scan_count?: number;
}

export const useMonitoredRepos = () => {
  const [repos, setRepos] = useState<MonitoredRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${DJANGO_SERVICES_URL}/api/github/monitored/`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch monitored repositories');
      }
      
      const data = await response.json();
      setRepos(data.repositories || []);
      return data.repositories;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addRepo = useCallback(async (owner: string, name: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${DJANGO_SERVICES_URL}/api/github/monitored/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add repository');
      }

      toast.success(`${data.repository.full_name} is now being monitored!`);
      
      // Refresh the repos list
      await fetchRepos();
      
      return data.repository;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add repository';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRepos]);

  const removeRepo = useCallback(async (repoId: number, fullName: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${DJANGO_SERVICES_URL}/api/github/monitored/${repoId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove repository');
      }

      toast.success(`Stopped monitoring ${fullName}`);
      
      // Refresh the repos list
      await fetchRepos();
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove repository';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRepos]);

  return {
    repos,
    loading,
    error,
    fetchRepos,
    addRepo,
    removeRepo,
  };
};
