import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BACKEND_URL } from "@/lib/constant";
import { authHeaders, authFetch } from "@/lib/api";

const mono = { fontFamily: "'JetBrains Mono', monospace" };

interface ApiKey {
  id: string;
  provider: string;
  label: string;
  last4: string;
  updatedAt: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

const Settings = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");

  const fetchKeys = async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/settings/api-keys`);
      if (!res.ok) throw new Error("Failed to load keys");
      const data = await res.json();
      setKeys(data.keys || []);
      setProviders(data.providers || []);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim().length < 8) {
      toast.error("That key looks too short");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ provider, key: apiKey.trim(), label: label.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save");
      }
      toast.success(`${PROVIDER_LABELS[provider] || provider} key saved`);
      setApiKey("");
      setLabel("");
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/settings/api-keys/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Key removed");
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      toast.error("Failed to delete key");
    }
  };

  return (
    <div
      className="min-h-screen bg-[#09090b] text-[#e5e1e4] p-6 md:p-10"
      style={{ fontFamily: "'Geist', sans-serif" }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-[#bccbb9] text-sm mt-1">
            Manage your account and integrations.
          </p>
        </div>

        {/* LLM API Keys card */}
        <section className="rounded-xl border border-[#3f3f46]/50 bg-[#131315] p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-5 w-5 text-[#4be277]" />
            <h2 className="text-lg font-bold">LLM API Keys</h2>
          </div>
          <p className="text-sm text-[#bccbb9] mb-6">
            Bring your own keys — encrypted at rest, only the last 4 characters
            shown after saving. You can add <span className="text-[#4be277]">multiple
            keys per provider</span> (e.g. several OpenRouter accounts); requests
            automatically fall back to the next key when one is rate-limited or out of credits.
          </p>

          {/* Add key form */}
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-3 items-end mb-8"
          >
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#bccbb9] mb-2" style={mono}>
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-[#0f0f10] border border-[#3f3f46]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#4be277] transition-colors"
              >
                {(providers.length ? providers : Object.keys(PROVIDER_LABELS)).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p] || p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#bccbb9] mb-2" style={mono}>
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className="w-full bg-[#0f0f10] border border-[#3f3f46]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#4be277] transition-colors"
                style={mono}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-[42px] px-5 bg-[#4be277] text-[#003915] rounded-lg font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:hover:scale-100 cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save
            </button>
            <div className="md:col-span-3">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Optional label (e.g. Personal, Work account)"
                className="w-full bg-[#0f0f10] border border-[#3f3f46]/60 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#4be277] transition-colors"
              />
            </div>
          </form>

          {/* Saved keys list */}
          <div>
            <h3 className="text-xs uppercase tracking-widest text-[#bccbb9] mb-3" style={mono}>
              Saved keys
            </h3>
            {loading ? (
              <div className="flex items-center gap-2 text-[#bccbb9] text-sm py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#3f3f46]/50 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-[#4be277] mx-auto mb-2" />
                <p className="text-sm text-[#bccbb9]">No API keys yet. Add one above.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#27272a]">
                {keys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded border border-[#4be277]/30 bg-[#4be277]/10 text-[#4be277] text-[11px] uppercase tracking-wide" style={mono}>
                        {PROVIDER_LABELS[k.provider] || k.provider}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {k.label || PROVIDER_LABELS[k.provider] || k.provider}
                        </p>
                        <p className="text-xs text-[#bccbb9]" style={mono}>
                          ••••••••{k.last4}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(k.id)}
                      className="p-2 rounded-lg text-[#bccbb9] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      aria-label="Delete key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
