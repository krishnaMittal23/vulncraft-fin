# VulnCraft — Full Testing Plan

End-to-end manual test plan covering every feature. Work top-to-bottom: Section 0
(setup) gates everything else. Each test has **Steps → Expected → ☐ result**.

> Legend: 🖥️ = browser/UI, 🔌 = API/curl, 🐳 = Docker/shell, ⚙️ = needs extra config (noted).

---

## 0. Prerequisites & smoke checks

**0.1 Start the stack**
- 🐳 Scanners: `cd services && docker compose up -d` → `docker compose ps` shows `services-web-1` (Up) and `vulncraft-owasp-zap` (Up/healthy).
- 🐳 Backend: `cd backend && npm run dev` → logs `Server running on http://localhost:3000` + `MongoDB Connected`.
- 🐳 Frontend: `cd frontend && npm run dev` → Vite serves `http://localhost:5173`.

**0.2 Load the shared secret into your shell (for the 🔌 tests)**
```bash
export SECRET=$(grep '^SCANNER_SHARED_SECRET=' services/.env | cut -d= -f2)
```

**0.3 Smoke checks**

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 0.3.1 | 🔌 `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173` | `200` | ☐ |
| 0.3.2 | 🔌 `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/user` | `401` (auth required = server healthy) | ☐ |
| 0.3.3 | 🔌 `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/nmap/scan/ -X POST` | `401` (scanner auth required) | ☐ |
| 0.3.4 | 🐳 `docker compose exec web which nuclei` | `/usr/local/bin/nuclei` | ☐ |

---

## 1. Authentication (GitHub OAuth + JWT)

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 1.1 | 🖥️ Open `http://localhost:5173` | Landing page renders (Cyber-Sentinel theme), "Continue with GitHub" visible | ☐ |
| 1.2 | 🖥️ Click "Continue with GitHub" | Redirects to `github.com/login/oauth/authorize` with a `state` param in the URL | ☐ |
| 1.3 | 🖥️ Authorize on GitHub | Returns to `/auth/callback?token=…`, then lands in the dashboard logged in (avatar/username shown in sidebar) | ☐ |
| 1.4 | 🖥️ Reload the dashboard | Stays logged in (JWT in localStorage under `token`) | ☐ |
| 1.5 | 🖥️ Click logout | Returns to landing; clicking GitHub again requires a fresh auth (no instant re-login loop) | ☐ |
| 1.6 | 🔌 Call any protected route with a bad token: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/user -H "Authorization: Bearer bad"` | `401` | ☐ |
| 1.7 | 🖥️ (CSRF) While logged out, manually visit `http://localhost:3000/api/auth/github/callback?code=x` (no state) | Redirects to `/?error=invalid_state` (state check blocks it) | ☐ |
| 1.8 | 🖥️ Let the JWT expire (or edit it), then trigger any authed fetch | App auto-clears token and bounces to landing (global 401 recovery) | ☐ |

---

## 2. Settings — LLM API keys

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 2.1 | 🖥️ Sidebar → Settings | LLM API Keys card renders; provider dropdown (OpenAI/OpenRouter/Anthropic/Gemini) | ☐ |
| 2.2 | 🖥️ Add an OpenRouter key (paste, optional label) → Save | Toast "OpenRouter key saved"; key appears in list masked as `••••••••<last4>` | ☐ |
| 2.3 | 🖥️ Add a **second** OpenRouter key | Both rows show (multiple keys per provider allowed) | ☐ |
| 2.4 | 🔌 Confirm encryption at rest — keys are stored as ciphertext/iv/authTag, only `last4` is plaintext (check DB or trust the masked UI) | No raw key ever returned by `GET /api/settings/api-keys` | ☐ |
| 2.5 | 🖥️ Delete a key (trash icon) | Toast "Key removed"; row disappears | ☐ |
| 2.6 | 🖥️ Try saving a too-short key (<8 chars) | Inline error "That key looks too short" | ☐ |

---

## 3. Workflow builder

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 3.1 | 🖥️ Sidebar → Workflows → create/open a workflow | Builder (ReactFlow) loads with a trigger node | ☐ |
| 3.2 | 🖥️ Set data source to **Domain**, open the add-node menu | Scan nodes listed incl. **Web Hygiene**, **Nuclei**, Gobuster, Nmap, SQLMap, WPScan, OWASP ZAP/Baseline/Dependency | ☐ |
| 3.3 | 🖥️ Add a node and connect it to the trigger | Node renders with its icon/label (Web Hygiene = ShieldCheck, Nuclei = Radar) | ☐ |
| 3.4 | 🖥️ Try adding an incompatible node for the data source | Blocked / not offered (compatibility matrix) | ☐ |
| 3.5 | 🖥️ Save the workflow | Persists; reload shows the saved nodes/edges | ☐ |

---

## 4. Scan nodes (per-tool) — run via the Django API directly

Use a **public, container-reachable** target. `http://example.com` and
`http://scanme.nmap.org` work; `testphp.vulnweb.com` may time out from the container.
All require the `X-Scanner-Secret` header.

| # | Tool | Command | Expected | ☐ |
|---|------|---------|----------|---|
| 4.1 | Web Hygiene | `curl -s -X POST http://localhost:8000/api/gobuster/web-hygiene/ -H "Content-Type: application/json" -H "X-Scanner-Secret: $SECRET" -d '{"url":"http://example.com"}'` | `scan_completed:true`, `findings[]` with missing headers + "No HTTP-to-HTTPS redirect", `overallRisk` set | ☐ |
| 4.2 | Web Hygiene (TLS) | same as 4.1 but `"url":"https://example.com"` | `tls.protocol`, `cipher_suite`, `certificate_not_after`, `certificate_days_remaining` populated | ☐ |
| 4.3 | Nuclei | `curl -s --max-time 300 -X POST http://localhost:8000/api/gobuster/nuclei/ -H "Content-Type: application/json" -H "X-Scanner-Secret: $SECRET" -d '{"url":"http://example.com","timeout":200}'` | `scan_completed:true`, `findings[]` with `template_id`/`severity`/`matched_at`, `finding_counts` | ☐ |
| 4.4 | Gobuster | `…/api/gobuster/scan/ -d '{"url":"http://scanme.nmap.org"}'` | JSON with directories/files (may be empty on modern sites — that's expected) | ☐ |
| 4.5 | Nmap | `…/api/nmap/scan/ -d '{"target":"scanme.nmap.org","arguments":"-F"}'` | Port scan result JSON | ☐ |
| 4.6 | Nmap (allowlist) | `…/api/nmap/scan/ -d '{"target":"scanme.nmap.org","arguments":"-sV -p 80,443"}'` | Runs (allowed flags) | ☐ |
| 4.7 | OWASP ZAP | `…/api/gobuster/owasp/ -d '{"url":"http://example.com"}'` (slow, minutes) | `zap_scan`, `security_headers`, `ssl_analysis`, **`discovered_urls[]`** (crawled routes surfaced), `risk_rating` | ☐ |
| 4.8 | OWASP Baseline | `…/api/gobuster/owasp-baseline/ -d '{"url":"http://example.com"}'` | Passive scan result | ☐ |
| 4.9 | WPScan / Nikto / SQLMap | via `…/api/gobuster/scan/` with the relevant flags | Tool output JSON (target-dependent) | ☐ |

---

## 5. Workflow execution + live progress

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 5.1 | 🖥️ Build a Domain workflow: trigger → Web Hygiene → (optional) Nuclei. Set target `http://example.com`. Run it. | Live progress streams (Socket.IO): node started/completed events, logs appear | ☐ |
| 5.2 | 🖥️ Watch the run to completion | Each node completes; a Report is generated with LLM analysis per security node | ☐ |
| 5.3 | 🔌 (Socket auth) Connect a socket WITHOUT a JWT in the handshake | Connection rejected (`Unauthorized`) | ☐ |
| 5.4 | 🔌 (Room authz) Try to `join-workflow` for a workflow you don't own | Join denied (server logs "denied join"); no events leak | ☐ |

---

## 6. Reports

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 6.1 | 🖥️ Sidebar → Security Reports | List of reports with risk/status | ☐ |
| 6.2 | 🖥️ Click a report row | Opens dedicated detail page `/dashboard/report/:id` | ☐ |
| 6.3 | 🖥️ Review the detail page | Shows overall risk, per-node findings, LLM recommendations, raw scan data; web-hygiene/nuclei findings render | ☐ |
| 6.4 | 🖥️ Open a report from a run that used a saved LLM key | Analysis present (used your key via the pool) | ☐ |

---

## 7. Repositories (code analysis)

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 7.1 | 🖥️ Sidebar → Repositories | Your GitHub repos list (search/filter) | ☐ |
| 7.2 | 🖥️ Open a repo / "Analyze" overlay | Fetches repo code; chat/analysis assistant works | ☐ |
| 7.3 | 🖥️ Ask the assistant a question about the code | LLM responds (uses your OpenRouter key/pool) | ☐ |
| 7.4 | 🔌 Oversized body: POST >10MB to an LLM route | `413`/rejected (body cap 10MB) | ☐ |

---

## 8. Monitored repos & seamless onboarding (Phase 4)

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 8.1 | 🖥️ Sidebar → Monitored | Page loads; "Connect Repository" button | ☐ |
| 8.2 | 🖥️ Open Connect form | Repo **picker dropdown** populated from your GitHub repos (private repos tagged) | ☐ |
| 8.3 | 🖥️ Select a repo → Connect | Toast reflects webhook status. In pure-local dev (no `WEBHOOK_PUBLIC_URL`) → "auto-webhook off…"; the monitored record needs Django `GITHUB_TOKEN` to resolve the repo (see §12) | ☐ |
| 8.4 | ⚙️ With `GITHUB_APP_SLUG` set in `backend/.env` + backend restart | "Install GitHub App — one click" banner appears; button opens the App install page | ☐ |
| 8.5 | 🖥️ Delete a monitored repo | Removed from the list | ☐ |
| 8.6 | 🔌 `curl http://localhost:3000/api/github/onboarding -H "Authorization: Bearer <JWT>"` | `{appConfigured, installUrl, webhookAutoRegister}` reflects your env | ☐ |

---

## 9. ⚙️ Webhook / PR-scan flow (needs a public URL)

Requires `WEBHOOK_PUBLIC_URL` (e.g. ngrok pointing at Django :8000) + matching
`GITHUB_WEBHOOK_SECRET` in both `.env` files + Django `GITHUB_TOKEN`.

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 9.1 | ⚙️ Set `WEBHOOK_PUBLIC_URL`, restart backend, Connect a repo you own | Toast "webhook registered automatically"; the hook appears in the repo's GitHub Settings → Webhooks | ☐ |
| 9.2 | ⚙️ Open a PR on that repo | Django receives `pull_request`; an initial "VulnCraft Security Scan" comment is posted | ☐ |
| 9.3 | ⚙️ Trigger a preview deploy (or send a `deployment_status` success) | Scans run on the preview URL; results posted as a PR comment | ☐ |
| 9.4 | 🔌 Send a webhook with a bad/missing signature | `403` invalid signature (and rejected outright if secret unset) | ☐ |

---

## 10. Security hardening verification (Phase 2)

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 10.1 | 🔌 Scan with NO secret: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/api/gobuster/scan/ -H "Content-Type: application/json" -d '{"url":"http://example.com"}'` | `401` | ☐ |
| 10.2 | 🔌 SSRF localhost: `…/api/nmap/scan/ -H "X-Scanner-Secret: $SECRET" -d '{"target":"127.0.0.1"}'` | `400` "disallowed (internal) address" | ☐ |
| 10.3 | 🔌 SSRF metadata: same with `"target":"169.254.169.254"` | `400` disallowed | ☐ |
| 10.4 | 🔌 SSRF RFC1918: same with `"target":"10.0.0.1"` | `400` disallowed | ☐ |
| 10.5 | 🔌 Nmap injection: `…/api/nmap/scan/ -H "X-Scanner-Secret: $SECRET" -d '{"target":"scanme.nmap.org","arguments":"-oN /tmp/x"}'` | `400` "Disallowed nmap argument: -oN" | ☐ |
| 10.6 | 🔌 Rate limit (execute): fire `POST /api/workflows/:id/execute` >20× in 15 min | Eventually `429` | ☐ |
| 10.7 | 🔌 Rate limit (LLM): hammer `/api/chat` >40× in 15 min | Eventually `429` | ☐ |
| 10.8 | 🐳 `docker compose exec web printenv DEBUG` | `False` | ☐ |
| 10.9 | 🐳 Unset `DJANGO_SECRET_KEY` and boot with `DEBUG=False` | Django refuses to start (ImproperlyConfigured = fail-closed) | ☐ |
| 10.10 | 🔌 Helmet headers: `curl -sI http://localhost:3000/api/auth/user` | Security headers present (e.g. `X-Content-Type-Options: nosniff`) | ☐ |

---

## 11. LLM key-pool fallback

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 11.1 | 🖥️ Add a deliberately invalid OpenRouter key FIRST, then a valid one | Requests still succeed — pool rotates past the bad key on 401/429 | ☐ |
| 11.2 | ⚙️ Set `OPENROUTER_FALLBACK_MODELS` and force a model error | Falls back to the next model | ☐ |
| 11.3 | 🖥️ Remove all keys (DB) but keep env `OPENROUTER_API_KEY` | Env key still used (env fallback) | ☐ |

---

## 12. Notifications (workflow output nodes)

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 12.1 | 🖥️ Add an **Email** node, run a workflow | Report email sent (needs `EMAIL_*` env, Gmail app password) | ☐ |
| 12.2 | 🖥️ Add a **GitHub Issue** node on a repo you own, run | Issue created with the security report (uses your OAuth token) | ☐ |
| 12.3 | 🖥️ Add a **Slack** node with a webhook URL, run | Message posted to Slack | ☐ |

---

## 13. Negative / edge cases

| # | Steps | Expected | ☐ |
|---|-------|----------|---|
| 13.1 | 🔌 Scan with malformed JSON body | `400` invalid JSON | ☐ |
| 13.2 | 🔌 Scan with missing `url`/`target` | `400` "URL/Target is required" | ☐ |
| 13.3 | 🖥️ Run a workflow with no security nodes | Completes; no detailed analysis attempted | ☐ |
| 13.4 | 🔌 Nuclei when binary missing (old image) | Graceful `scan_completed:false` "nuclei not installed" (not a crash) | ☐ |
| 13.5 | 🖥️ Connect form when GitHub repos fail to load | Falls back to manual owner/name inputs | ☐ |

---

## 14. Known local-dev limitations (not bugs)

- `testphp.vulnweb.com` often times out **from inside the container**; use `example.com` / `scanme.nmap.org`.
- `WEBHOOK_PUBLIC_URL` empty → webhook auto-registration **skips** (by design). Section 9 needs ngrok/public URL.
- `GITHUB_APP_SLUG` empty → no one-click App banner (manual connect still works).
- Django `GITHUB_TOKEN` empty → `POST /api/github/monitor` returns `monitored.status:"error" 401` because Django validates the repo via the GitHub API.
- OWASP ZAP / SQLMap / WPScan runs are **slow** (minutes); use generous client timeouts.
- The 4 audit commits are **not pushed** — push with `git push coderfleet main` (classifier blocks automated pushes due to secrets still in history).

---

## Sign-off

| Area | Pass? | Notes |
|------|-------|-------|
| Auth | ☐ | |
| Settings/LLM keys | ☐ | |
| Workflow builder | ☐ | |
| Scan nodes | ☐ | |
| Execution + live progress | ☐ | |
| Reports | ☐ | |
| Repositories | ☐ | |
| Monitored/onboarding | ☐ | |
| Webhook/PR flow ⚙️ | ☐ | |
| Security hardening | ☐ | |
| LLM fallback | ☐ | |
| Notifications | ☐ | |
