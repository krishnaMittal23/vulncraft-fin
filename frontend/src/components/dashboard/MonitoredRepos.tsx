import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GitBranch, Plus, Trash2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const DJANGO_SERVICES_URL = "http://localhost:8000";

interface MonitoredRepo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  github_repo_id: number;
  is_active: boolean;
  created_at: string;
  scan_count?: number;
}

const MonitoredRepos = () => {
  const [repos, setRepos] = useState<MonitoredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRepo, setAddingRepo] = useState(false);
  const [newRepoOwner, setNewRepoOwner] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch monitored repositories
  const fetchRepos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${DJANGO_SERVICES_URL}/api/github/monitored/`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch monitored repositories');
      }
      
      const data = await response.json();
      setRepos(data.repositories || []);
    } catch (error) {
      console.error('Error fetching repos:', error);
      toast.error('Failed to load monitored repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  // Add new repository
  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRepoOwner.trim() || !newRepoName.trim()) {
      toast.error('Please enter both owner and repository name');
      return;
    }

    try {
      setAddingRepo(true);
      const response = await fetch(`${DJANGO_SERVICES_URL}/api/github/monitored/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner: newRepoOwner.trim(),
          name: newRepoName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add repository');
      }

      toast.success(`${data.repository.full_name} is now being monitored!`);
      setNewRepoOwner('');
      setNewRepoName('');
      setShowAddForm(false);
      fetchRepos(); // Refresh the list
    } catch (error: any) {
      console.error('Error adding repo:', error);
      toast.error(error.message || 'Failed to add repository');
    } finally {
      setAddingRepo(false);
    }
  };

  // Remove repository
  const handleRemoveRepo = async (repoId: number, fullName: string) => {
    if (!confirm(`Stop monitoring ${fullName}?`)) {
      return;
    }

    try {
      const response = await fetch(`${DJANGO_SERVICES_URL}/api/github/monitored/${repoId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove repository');
      }

      toast.success(`Stopped monitoring ${fullName}`);
      fetchRepos(); // Refresh the list
    } catch (error) {
      console.error('Error removing repo:', error);
      toast.error('Failed to remove repository');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Monitored Repositories</h2>
          <p className="text-muted-foreground mt-2">
            Manage repositories that automatically trigger security scans on PRs
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Repository
        </Button>
      </div>

      {/* Add Repository Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Repository</CardTitle>
            <CardDescription>
              Enter the GitHub repository owner and name to start monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRepo} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Owner</label>
                  <Input
                    placeholder="e.g., CoderFleet"
                    value={newRepoOwner}
                    onChange={(e) => setNewRepoOwner(e.target.value)}
                    disabled={addingRepo}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Repository Name</label>
                  <Input
                    placeholder="e.g., VulnCraft"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    disabled={addingRepo}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={addingRepo}>
                  {addingRepo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Repository'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewRepoOwner('');
                    setNewRepoName('');
                  }}
                  disabled={addingRepo}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Repository List */}
      {repos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No repositories monitored</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add a repository to start receiving automated security scans on Pull Requests
            </p>
            <Button onClick={() => setShowAddForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Your First Repository
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Card key={repo.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{repo.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRepo(repo.id, repo.full_name)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription className="font-mono text-xs">
                  {repo.owner}/{repo.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={repo.is_active ? "default" : "secondary"} className="gap-1">
                    {repo.is_active ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </Badge>
                </div>
                {repo.scan_count !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Scans</span>
                    <span className="font-semibold">{repo.scan_count}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Added</span>
                  <span className="text-xs">
                    {new Date(repo.created_at).toLocaleDateString()}
                  </span>
                </div>
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <GitBranch className="w-3 h-3" />
                    View on GitHub
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>✓ Monitored repositories will trigger automated security scans when:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>A new Pull Request is opened</li>
            <li>An existing PR is updated</li>
            <li>A preview deployment is created (Netlify, Vercel, etc.)</li>
          </ul>
          <p className="pt-2">
            Scan results will be posted automatically as comments on your PRs with detailed vulnerability reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonitoredRepos;
