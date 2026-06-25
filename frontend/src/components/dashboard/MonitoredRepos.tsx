import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Github,
  Plus,
  Trash2,
  ShieldCheck,
  GitPullRequest,
  Loader2,
  RefreshCw,
  MessageSquare,
  Lock,
  Zap,
} from "lucide-react";
import { BACKEND_URL } from "@/lib/constant";
import { authFetch } from "@/lib/api";

const geist = { fontFamily: "'Geist', sans-serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

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

interface GithubRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  private: boolean;
  html_url: string;
}

interface Onboarding {
  appConfigured: boolean;
  installUrl: string | null;
  webhookAutoRegister: boolean;
}

const MonitoredRepos = () => {
  const [repos, setRepos] = useState<MonitoredRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingRepo, setAddingRepo] = useState(false);
  const [newRepoOwner, setNewRepoOwner] = useState("");
  const [newRepoName, setNewRepoName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [reposLoadFailed, setReposLoadFailed] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState("");

  // Fetch monitored repositories
  const fetchRepos = async () => {
    try {
      setLoading(true);
      const response = await authFetch(`${BACKEND_URL}/api/github/monitored`);

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

  // Fetch onboarding info (one-click GitHub App availability)
  const fetchOnboarding = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/github/onboarding`);
      if (res.ok) setOnboarding(await res.json());
    } catch {
      // non-fatal — manual connect still works
    }
  };

  // Fetch the user's GitHub repos to populate the picker
  const fetchGithubRepos = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/github/repos`);
      if (!res.ok) throw new Error("repos fetch failed");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("unexpected repos response");
      setGithubRepos(data);
      setReposLoadFailed(false);
    } catch {
      setReposLoadFailed(true);
    }
  };

  useEffect(() => {
    fetchRepos();
    fetchOnboarding();
    fetchGithubRepos();
  }, []);

  // Connect (monitor + auto-register webhook) via the Node backend
  const connectRepo = async (owner: string, repo: string) => {
    setAddingRepo(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/github/monitor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to connect repository");

      if (data.monitored?.status === "error") {
        toast.error(`Could not monitor ${owner}/${repo}: ${data.monitored.reason}`);
        return;
      }

      const w = data.webhook?.status;
      if (w === "created") {
        toast.success("Connected — webhook registered automatically");
      } else if (w === "exists") {
        toast.success("Connected — webhook already present");
      } else if (w === "skipped") {
        toast.success("Connected — auto-webhook off (set WEBHOOK_PUBLIC_URL to enable)");
      } else if (w === "error") {
        toast.warning(`Connected, but webhook registration failed: ${data.webhook.reason || ""}`);
      } else {
        toast.success("Connected");
      }

      setNewRepoOwner("");
      setNewRepoName("");
      setSelectedRepo("");
      setShowAddForm(false);
      fetchRepos();
    } catch (error: any) {
      console.error("Error connecting repo:", error);
      toast.error(error.message || "Failed to connect repository");
    } finally {
      setAddingRepo(false);
    }
  };

  // Add new repository (picker or manual fallback)
  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reposLoadFailed) {
      if (!selectedRepo) {
        toast.error("Select a repository to connect");
        return;
      }
      const repo = githubRepos.find((r) => r.full_name === selectedRepo);
      if (!repo) {
        toast.error("Could not resolve the selected repository");
        return;
      }
      await connectRepo(repo.owner.login, repo.name);
      return;
    }

    // Manual fallback
    if (!newRepoOwner.trim() || !newRepoName.trim()) {
      toast.error("Please enter both owner and repository name");
      return;
    }
    await connectRepo(newRepoOwner.trim(), newRepoName.trim());
  };

  // Remove repository
  const handleRemoveRepo = async (repoId: number, fullName: string) => {
    if (!confirm(`Stop monitoring ${fullName}?`)) {
      return;
    }

    try {
      const response = await authFetch(`${BACKEND_URL}/api/github/monitored/${repoId}`, {
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

  return (
    <div
      className="min-h-screen bg-[#09090b] text-[#e5e1e4] p-6 md:p-10"
      style={geist}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitored Repositories</h1>
            <p className="text-[#bccbb9] text-sm mt-1">
              Automatic PR security scanning via GitHub
            </p>
          </div>
          <button
            onClick={() => setShowAddForm((s) => !s)}
            className="self-start sm:self-auto px-5 h-[42px] bg-[#4be277] text-[#003915] rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Connect Repository
          </button>
        </div>

        {/* One-click GitHub App install banner */}
        {onboarding?.appConfigured && onboarding.installUrl && (
          <section className="rounded-xl border border-[#4be277]/30 bg-[#4be277]/[0.06] p-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-[#4be277] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold">Install the GitHub App — one click</p>
                <p className="text-xs text-[#bccbb9] mt-0.5">
                  Pick your repos on GitHub and they're monitored automatically — no webhook setup.
                </p>
              </div>
            </div>
            <button
              onClick={() => window.open(onboarding.installUrl!, "_blank")}
              className="self-start sm:self-auto px-5 h-[42px] bg-[#4be277] text-[#003915] rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Github className="h-4 w-4" />
              Install GitHub App
            </button>
          </section>
        )}

        {/* Connect Repository card */}
        {showAddForm && (
          <section className="rounded-xl border border-[#3f3f46]/50 bg-[#131315] p-6 mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Github className="h-5 w-5 text-[#4be277]" />
              <h2 className="text-lg font-bold">Connect Repository</h2>
            </div>
            <p className="text-sm text-[#bccbb9] mb-6">
              {reposLoadFailed
                ? "Enter the GitHub repository owner and name to start monitoring."
                : "Pick one of your GitHub repositories. We'll register its webhook automatically — no GitHub settings needed."}
            </p>

            <form onSubmit={handleAddRepo} className="space-y-4">
              {!reposLoadFailed ? (
                <div>
                  <label
                    className="block text-xs uppercase tracking-widest text-[#bccbb9] mb-2"
                    style={mono}
                  >
                    Repository
                  </label>
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    disabled={addingRepo}
                    className="w-full bg-[#0f0f10] border border-[#3f3f46]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#4be277] transition-colors disabled:opacity-60"
                    style={mono}
                  >
                    <option value="">
                      {githubRepos.length ? "Select a repository…" : "Loading your repositories…"}
                    </option>
                    {githubRepos.map((r) => (
                      <option key={r.full_name} value={r.full_name}>
                        {r.full_name}
                        {r.private ? "  (private)" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedRepo &&
                    githubRepos.find((r) => r.full_name === selectedRepo)?.private && (
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#bccbb9]" style={mono}>
                        <Lock className="h-3 w-3" /> private repository
                      </p>
                    )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      className="block text-xs uppercase tracking-widest text-[#bccbb9] mb-2"
                      style={mono}
                    >
                      Owner
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., CoderFleet"
                      value={newRepoOwner}
                      onChange={(e) => setNewRepoOwner(e.target.value)}
                      disabled={addingRepo}
                      className="w-full bg-[#0f0f10] border border-[#3f3f46]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#4be277] transition-colors disabled:opacity-60"
                      style={mono}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs uppercase tracking-widest text-[#bccbb9] mb-2"
                      style={mono}
                    >
                      Repository Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., VulnCraft"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      disabled={addingRepo}
                      className="w-full bg-[#0f0f10] border border-[#3f3f46]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#4be277] transition-colors disabled:opacity-60"
                      style={mono}
                    />
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={addingRepo}
                  className="h-[42px] px-5 bg-[#4be277] text-[#003915] rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:hover:scale-100 cursor-pointer"
                >
                  {addingRepo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Connect
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewRepoOwner('');
                    setNewRepoName('');
                    setSelectedRepo('');
                  }}
                  disabled={addingRepo}
                  className="h-[42px] px-5 bg-transparent border border-[#3f3f46] text-[#e5e1e4] rounded-lg font-semibold hover:bg-[#201f22] transition-colors disabled:opacity-60 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Repository list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-[#bccbb9] text-sm py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[#4be277]" /> Loading repositories…
          </div>
        ) : repos.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#3f3f46]/50 rounded-xl bg-[#131315]">
            <ShieldCheck className="h-8 w-8 text-[#4be277] mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">No repositories monitored</h3>
            <p className="text-sm text-[#bccbb9] mb-5">Add one above.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 h-[42px] px-5 bg-[#4be277] text-[#003915] rounded-lg font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Connect Your First Repository
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="rounded-xl border border-[#3f3f46]/50 bg-[#131315] p-5 hover:border-[#4be277]/50 transition-colors"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 h-9 w-9 rounded-lg border border-[#3f3f46]/60 bg-[#0f0f10] flex items-center justify-center">
                      <Github className="h-4 w-4 text-[#4be277]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{repo.name}</p>
                      <p className="text-xs text-[#bccbb9] truncate" style={mono}>
                        {repo.owner}/{repo.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveRepo(repo.id, repo.full_name)}
                    className="shrink-0 p-2 rounded-lg text-[#bccbb9] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    aria-label={`Stop monitoring ${repo.full_name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Metric rows */}
                <div className="space-y-2.5 border-t border-[#27272a] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-[#bccbb9]" style={mono}>
                      Status
                    </span>
                    {repo.is_active ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#4be277]/30 bg-[#4be277]/10 text-[#4be277] text-[11px] uppercase tracking-wide"
                        style={mono}
                      >
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4be277] opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4be277]" />
                        </span>
                        Active
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded border border-[#3f3f46]/60 bg-[#0f0f10] text-[#bccbb9] text-[11px] uppercase tracking-wide"
                        style={mono}
                      >
                        Inactive
                      </span>
                    )}
                  </div>

                  {repo.scan_count !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-[#bccbb9]" style={mono}>
                        Total Scans
                      </span>
                      <span className="text-sm font-semibold text-[#e5e1e4]" style={mono}>
                        {repo.scan_count}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-[#bccbb9]" style={mono}>
                      Added
                    </span>
                    <span className="text-xs text-[#bccbb9]" style={mono}>
                      {new Date(repo.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* View on GitHub */}
                <a
                  href={`https://github.com/${repo.owner}/${repo.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 h-9 bg-transparent border border-[#3f3f46] text-[#e5e1e4] rounded-lg text-sm font-semibold hover:bg-[#201f22] transition-colors"
                >
                  <Github className="h-3.5 w-3.5" />
                  View on GitHub
                </a>
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        <section className="mt-8 rounded-xl border border-[#27272a]/50 bg-[#131315]/60 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-[#4be277]" />
            <h2 className="text-base font-bold">How it works</h2>
          </div>
          <p className="text-xs text-[#bccbb9] mb-4">
            Connecting a repo auto-registers its webhook — no GitHub settings needed.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <GitPullRequest className="h-4 w-4 text-[#4be277] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">PR opened</p>
                <p className="text-xs text-[#bccbb9] mt-0.5">
                  A new Pull Request triggers an automated security scan.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="h-4 w-4 text-[#4be277] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">PR updated</p>
                <p className="text-xs text-[#bccbb9] mt-0.5">
                  Pushing new commits re-runs the scan on the latest changes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-[#4be277] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Scan + comment</p>
                <p className="text-xs text-[#bccbb9] mt-0.5">
                  Results are posted as detailed vulnerability comments on the PR.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MonitoredRepos;
