const axios = require("axios");
const User = require("../models/User");
const { getRedis } = require("../lib/redis");


const getUserRepos = async (userId) => {
  const user = await User.findById(userId);

  if (!user || !user.accessToken) {
    throw new Error("User not authenticated or missing access token");
  }

  const headers = {
    Authorization: `Bearer ${user.accessToken}`,
    Accept: "application/vnd.github+json",
  };

  // Cache the repo list briefly — it's 2+ GitHub API round-trips and rarely
  // changes within a session.
  const redis = getRedis();
  const cacheKey = `repos:${userId}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch { /* cache miss / parse error -> fetch fresh */ }
  }

  // Paginate — GitHub caps per_page at 100, and users can have far more than
  // that (org + collaborator repos). Sort by most-recently-updated so active
  // repos surface first. Cap at 10 pages (1000 repos) as a safety bound.
  const all = [];
  const MAX_PAGES = 10;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await axios.get("https://api.github.com/user/repos", {
      headers,
      params: {
        visibility: "all",
        affiliation: "owner,collaborator,organization_member",
        sort: "updated",
        per_page: 100,
        page,
      },
    });
    all.push(...data);
    if (data.length < 100) break;
  }

  if (redis) {
    try { await redis.set(cacheKey, JSON.stringify(all), "EX", 300); } catch { /* ignore */ }
  }

  return all;
};


const fetchRepoContents = async (owner, repo, path = "", accessToken) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      Accept: "application/vnd.github.v3+json",
    });

    let files = [];

    for (const item of response.data) {
      if (item.type === "file") {
        const fileResponse = await axios.get(item.download_url, {
          responseType: "arraybuffer",
        });
        const fileBuffer = Buffer.from(fileResponse.data);

        // Detect if it's a binary file
        const isBinary = fileBuffer.includes(0);
        if (isBinary) {
          console.log(`Binary file detected: ${item.path}`);
        }

        // TODO: Modify backslash "\n" in response
        files.push({
          path: item.path,
          content: isBinary
            ? fileBuffer.toString("base64")
            : fileBuffer.toString("utf-8"),
          isBinary,
        });
      } else if (item.type === "dir") {
        const subFiles = await fetchRepoContents(
          owner,
          repo,
          item.path,
          accessToken
        );
        files = files.concat(subFiles);
      }
    }

    return files;
  } catch (error) {
    console.error(
      "Error fetching repository contents:",
      error.response?.data || error.message
    );
    throw new Error("Failed to fetch repository contents");
  }
};


const createGitHubIssue = async (owner, repo, title, body, labels = [], accessToken) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
    
    const response = await axios.post(
      url,
      {
        title,
        body,
        labels,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    console.log(`✅ GitHub issue created: #${response.data.number} - ${response.data.html_url}`);
    return {
      success: true,
      issue: {
        number: response.data.number,
        url: response.data.html_url,
        title: response.data.title,
        state: response.data.state,
        created_at: response.data.created_at,
      }
    };
  } catch (error) {
    console.error(
      "❌ Error creating GitHub issue:",
      error.response?.data || error.message
    );
    throw new Error(`Failed to create GitHub issue: ${error.response?.data?.message || error.message}`);
  }
};

/**
 * Create a security scan report issue on GitHub
 * @param {string} userId - MongoDB user ID
 * @param {string} repository - Repository in format "owner/repo"
 * @param {Object} scanData - Scan results data
 * @param {Object} nodeResults - Detailed node execution results with LLM analysis
 * @returns {Promise<Object>} - Created issue data
 */
const createSecurityReportIssue = async (userId, repository, scanData, nodeResults = []) => {
  try {
    const user = await User.findById(userId);
    
    if (!user || !user.accessToken) {
      throw new Error("User not authenticated or missing access token");
    }

    const [owner, repo] = repository.split("/");
    
    if (!owner || !repo) {
      throw new Error("Invalid repository format. Expected 'owner/repo'");
    }

    // Calculate total findings
    const totalFindings = Object.values(scanData).reduce((total, scan) => {
      return total + (scan.total_findings || 0);
    }, 0);
    
    // Generate issue title
    const title = `🔒 Security Scan Report - ${totalFindings} Finding${totalFindings !== 1 ? 's' : ''} Detected`;
    
    // Generate issue body
    let body = `# Automated Security Scan Report\n\n`;
    body += `**Scan Date:** ${new Date().toLocaleString()}\n`;
    body += `**Total Findings:** ${totalFindings}\n\n`;
    body += `---\n\n`;

    // Add Gobuster results
    if (scanData.gobuster) {
      body += `## 🔍 Directory & File Enumeration (Gobuster)\n\n`;
      body += `**Target URL:** ${scanData.gobuster.target_url || 'N/A'}\n`;
      body += `**Scan Date:** ${scanData.gobuster.scan_date || 'N/A'}\n`;
      body += `**Total Found:** ${scanData.gobuster.total_findings || 0}\n\n`;
      
      if (scanData.gobuster.directories_found?.length > 0) {
        body += `### 📁 Directories Found (${scanData.gobuster.directories_found.length})\n\n`;
        body += `| Path | Status Code |\n`;
        body += `|------|-------------|\n`;
        scanData.gobuster.directories_found.forEach(dir => {
          body += `| \`${dir.path}\` | ${dir.status} |\n`;
        });
        body += `\n`;
      }
      
      if (scanData.gobuster.files_found?.length > 0) {
        body += `### 📄 Files Found (${scanData.gobuster.files_found.length})\n\n`;
        body += `| Path | Status Code |\n`;
        body += `|------|-------------|\n`;
        scanData.gobuster.files_found.forEach(file => {
          body += `| \`${file.path}\` | ${file.status} |\n`;
        });
        body += `\n`;
      }

      // Add detailed analysis if available
      const gobusterNode = nodeResults.find(n => n.nodeType === 'gobuster');
      if (gobusterNode?.detailedAnalysis) {
        body += `### 📊 Detailed Analysis\n\n`;
        body += `${gobusterNode.detailedAnalysis.summary || gobusterNode.detailedAnalysis}\n\n`;
      }

      body += `---\n\n`;
    }

    // Add Nmap results
    if (scanData.nmap?.nmap_scan) {
      const nmapData = scanData.nmap.nmap_scan;
      body += `## 🌐 Port Scan (Nmap)\n\n`;
      body += `**Open Ports:** ${nmapData.open_ports?.length || 0}\n\n`;
      
      if (nmapData.open_ports?.length > 0) {
        body += `| Port | Protocol | State | Service |\n`;
        body += `|------|----------|-------|--------|\n`;
        nmapData.open_ports.forEach(port => {
          body += `| ${port.port} | ${port.protocol} | ${port.state} | ${port.service} |\n`;
        });
        body += `\n`;
      }

      // Add detailed analysis if available
      const nmapNode = nodeResults.find(n => n.nodeType === 'nmap');
      if (nmapNode?.detailedAnalysis) {
        body += `### 📊 Detailed Analysis\n\n`;
        body += `${nmapNode.detailedAnalysis.summary || nmapNode.detailedAnalysis}\n\n`;
      }

      body += `---\n\n`;
    }

    // Add SQLMap results
    if (scanData.sqlmap?.sqlmap_scan) {
      const sqlmapData = scanData.sqlmap.sqlmap_scan;
      body += `## 💉 SQL Injection Test (SQLMap)\n\n`;
      body += `**Vulnerable:** ${sqlmapData.vulnerable ? '⚠️ YES' : '✅ NO'}\n\n`;
      
      if (sqlmapData.vulnerabilities?.length > 0) {
        body += `### ⚠️ Vulnerabilities Detected\n\n`;
        sqlmapData.vulnerabilities.forEach((vuln, index) => {
          body += `${index + 1}. ${vuln}\n`;
        });
        body += `\n`;
      }
      
      if (sqlmapData.dbms) {
        body += `**Database Type:** ${sqlmapData.dbms}\n\n`;
      }

      // Add detailed analysis if available
      const sqlmapNode = nodeResults.find(n => n.nodeType === 'sqlmap');
      if (sqlmapNode?.detailedAnalysis) {
        body += `### 📊 Detailed Analysis\n\n`;
        body += `${sqlmapNode.detailedAnalysis.summary || sqlmapNode.detailedAnalysis}\n\n`;
      }

      body += `---\n\n`;
    }

    // Add Nikto results
    if (scanData.nikto?.nikto_scan) {
      const niktoData = scanData.nikto.nikto_scan;
      body += `## 🔐 Web Server Scan (Nikto)\n\n`;
      
      if (niktoData.vulnerabilities?.length > 0) {
        body += `**Vulnerabilities Found:** ${niktoData.vulnerabilities.length}\n\n`;
        niktoData.vulnerabilities.forEach((vuln, index) => {
          body += `${index + 1}. ${vuln}\n`;
        });
        body += `\n`;
      }

      // Add detailed analysis if available
      const niktoNode = nodeResults.find(n => n.nodeType === 'nikto');
      if (niktoNode?.detailedAnalysis) {
        body += `### 📊 Detailed Analysis\n\n`;
        body += `${niktoNode.detailedAnalysis.summary || niktoNode.detailedAnalysis}\n\n`;
      }

      body += `---\n\n`;
    }

    // Add WPScan results
    if (scanData.wpscan?.wpscan_results) {
      const wpscanData = scanData.wpscan.wpscan_results;
      body += `## 🔌 WordPress Scan (WPScan)\n\n`;
      
      if (wpscanData.vulnerabilities?.length > 0) {
        body += `**Vulnerabilities Found:** ${wpscanData.vulnerabilities.length}\n\n`;
        wpscanData.vulnerabilities.forEach((vuln, index) => {
          body += `${index + 1}. ${vuln.title || vuln}\n`;
        });
        body += `\n`;
      }

      if (wpscanData.interesting_findings?.length > 0) {
        body += `**Interesting Findings:** ${wpscanData.interesting_findings.length}\n\n`;
        wpscanData.interesting_findings.forEach((finding, index) => {
          body += `${index + 1}. ${finding}\n`;
        });
        body += `\n`;
      }

      // Add detailed analysis if available
      const wpscanNode = nodeResults.find(n => n.nodeType === 'wpscan');
      if (wpscanNode?.detailedAnalysis) {
        body += `### 📊 Detailed Analysis\n\n`;
        body += `${wpscanNode.detailedAnalysis.summary || wpscanNode.detailedAnalysis}\n\n`;
      }

      body += `---\n\n`;
    }

    // Add OWASP scan results
    if (scanData.owasp || scanData.owasp_scan) {
      const owaspData = scanData.owasp || scanData.owasp_scan;
      body += `## 🛡️ OWASP Security Analysis\n\n`;
      body += `**Risk Rating:** ${owaspData.risk_rating || 'Unknown'}\n`;
      body += `**Total Vulnerabilities:** ${owaspData.total_vulnerabilities || 0}\n`;
      body += `**Scan Status:** ${owaspData.scan_status || 'Unknown'}\n\n`;

      // OWASP ZAP results
      if (owaspData.zap_scan) {
        const zapData = owaspData.zap_scan;
        body += `### 🕷️ OWASP ZAP Scan Results\n\n`;
        
        if (zapData.risk_counts) {
          body += `**Risk Breakdown:**\n`;
          body += `- 🔴 High: ${zapData.risk_counts.High || 0}\n`;
          body += `- 🟠 Medium: ${zapData.risk_counts.Medium || 0}\n`;
          body += `- 🟡 Low: ${zapData.risk_counts.Low || 0}\n`;
          body += `- ℹ️ Informational: ${zapData.risk_counts.Informational || 0}\n\n`;
        }

        if (zapData.vulnerabilities?.length > 0) {
          body += `**Top Vulnerabilities:**\n\n`;
          zapData.vulnerabilities.slice(0, 10).forEach((vuln, index) => {
            body += `${index + 1}. **${vuln.name || vuln.alert}** (${vuln.risk})\n`;
            if (vuln.description) {
              body += `   - ${vuln.description.substring(0, 100)}...\n`;
            }
            if (vuln.solution) {
              body += `   - **Solution:** ${vuln.solution.substring(0, 100)}...\n`;
            }
            body += `\n`;
          });
        }
      }

      // OWASP Top 10 analysis
      if (owaspData.owasp_top10_analysis) {
        const top10Data = owaspData.owasp_top10_analysis;
        body += `### 📊 OWASP Top 10 Compliance\n\n`;
        body += `**Compliance Score:** ${top10Data.compliance_score || 0}%\n\n`;
        
        if (top10Data.vulnerable_categories?.length > 0) {
          body += `**Vulnerable Categories:**\n`;
          top10Data.vulnerable_categories.forEach(category => {
            const categoryData = top10Data.categories[category];
            if (categoryData) {
              body += `- **${category}:** ${categoryData.name}\n`;
              if (categoryData.details?.length > 0) {
                categoryData.details.forEach(detail => {
                  body += `  - ${detail}\n`;
                });
              }
            }
          });
          body += `\n`;
        }
      }

      // Security headers analysis
      if (owaspData.security_headers) {
        const headersData = owaspData.security_headers;
        body += `### 🔒 Security Headers Analysis\n\n`;
        body += `**Security Score:** ${headersData.security_score || 0}%\n\n`;
        
        if (headersData.missing_headers && Object.keys(headersData.missing_headers).length > 0) {
          body += `**Missing Security Headers:**\n`;
          Object.entries(headersData.missing_headers).forEach(([header, info]) => {
            body += `- **${header}:** ${info.description} (Risk: ${info.risk})\n`;
          });
          body += `\n`;
        }

        if (headersData.present_headers && Object.keys(headersData.present_headers).length > 0) {
          body += `**Present Security Headers:**\n`;
          Object.entries(headersData.present_headers).forEach(([header, info]) => {
            body += `- **${header}:** ${info.description}\n`;
          });
          body += `\n`;
        }
      }

      // SSL/TLS analysis
      if (owaspData.ssl_analysis) {
        const sslData = owaspData.ssl_analysis;
        body += `### 🔐 SSL/TLS Analysis\n\n`;
        body += `**SSL Enabled:** ${sslData.ssl_enabled ? 'Yes' : 'No'}\n`;
        if (sslData.protocol) {
          body += `**Protocol:** ${sslData.protocol}\n`;
        }
        if (sslData.security_assessment) {
          body += `**Security Level:** ${sslData.security_assessment}\n`;
        }
        body += `\n`;
      }

      // Add detailed analysis if available
      const owaspNode = nodeResults.find(n => 
        ['owasp-vulnerabilities', 'owasp-zap', 'owasp-baseline', 'owasp-dependency-check'].includes(n.nodeType)
      );
      if (owaspNode?.detailedAnalysis) {
        body += `### 📊 Detailed OWASP Analysis\n\n`;
        body += `${owaspNode.detailedAnalysis.summary || owaspNode.detailedAnalysis}\n\n`;
      }

      body += `---\n\n`;
    }

    // Add recommendations section
    body += `## 📋 Security Recommendations\n\n`;
    
    const recommendations = [];
    
    if (scanData.gobuster?.directories_found?.length > 0 || scanData.gobuster?.files_found?.length > 0) {
      recommendations.push("🔒 Restrict access to sensitive directories and files");
      recommendations.push("📝 Review exposed paths and remove unnecessary files");
    }
    
    if (scanData.nmap?.nmap_scan?.open_ports?.length > 0) {
      recommendations.push("🔐 Close unnecessary open ports");
      recommendations.push("🛡️ Implement firewall rules to restrict access");
    }
    
    if (scanData.sqlmap?.sqlmap_scan?.vulnerable) {
      recommendations.push("⚠️ **CRITICAL**: Patch SQL injection vulnerabilities immediately");
      recommendations.push("💾 Use parameterized queries and prepared statements");
      recommendations.push("🔍 Implement input validation and sanitization");
    }
    
    if (scanData.nikto?.nikto_scan?.vulnerabilities?.length > 0) {
      recommendations.push("🔄 Update web server software to latest version");
      recommendations.push("🛠️ Apply security patches for identified vulnerabilities");
    }
    
    if (scanData.wpscan?.wpscan_results) {
      recommendations.push("📦 Update WordPress core, plugins, and themes");
      recommendations.push("🔑 Use strong passwords and enable 2FA");
    }
    
    if (scanData.owasp || scanData.owasp_scan) {
      const owaspData = scanData.owasp || scanData.owasp_scan;
      if (owaspData.risk_rating === 'CRITICAL' || owaspData.risk_rating === 'HIGH') {
        recommendations.push("🛡️ **URGENT**: Address OWASP security vulnerabilities immediately");
      }
      if (owaspData.security_headers?.missing_headers) {
        recommendations.push("🔒 Implement missing security headers");
      }
      if (owaspData.owasp_top10_analysis?.vulnerable_categories?.length > 0) {
        recommendations.push("📊 Address OWASP Top 10 vulnerability categories");
      }
      if (owaspData.ssl_analysis?.security_assessment === 'WEAK') {
        recommendations.push("🔐 Upgrade SSL/TLS configuration");
      }
      recommendations.push("🛡️ Regular OWASP security assessments");
      recommendations.push("📚 Security training for development team");
    }
    
    // Add general recommendations
    recommendations.push("📊 Conduct regular security audits");
    recommendations.push("🔐 Implement Web Application Firewall (WAF)");
    recommendations.push("📈 Set up security monitoring and alerting");
    recommendations.push("🎓 Train development team on secure coding practices");
    
    recommendations.forEach((rec, index) => {
      body += `${index + 1}. ${rec}\n`;
    });
    
    body += `\n---\n\n`;
    body += `## 📌 Additional Information\n\n`;
    body += `- **Platform:** VulnCraft\n`;
    body += `- **Scan Type:** Automated Workflow\n`;
    body += `- **Report Generated:** ${new Date().toLocaleString()}\n\n`;
    body += `> ⚠️ **Note:** This is an automated security report. Please review all findings carefully and verify before taking action.\n\n`;
    body += `---\n\n`;
    body += `*🤖 This issue was automatically created by **VulnCraft Security Platform***\n`;

    // Determine labels based on findings
    const labels = ['security', 'automated-scan'];
    
    if (totalFindings > 20) {
      labels.push('critical');
    } else if (totalFindings > 10) {
      labels.push('high-priority');
    }
    
    if (scanData.sqlmap?.sqlmap_scan?.vulnerable) {
      labels.push('vulnerability', 'sql-injection');
    }
    
    if (scanData.nmap?.nmap_scan?.open_ports?.length > 5) {
      labels.push('network-security');
    }

    // Create the issue
    const result = await createGitHubIssue(owner, repo, title, body, labels, user.accessToken);
    
    return result;
  } catch (error) {
    console.error("❌ Error creating security report issue:", error);
    throw error;
  }
};

/**
 * Idempotently register the VulnCraft webhook on a repo using the user's OAuth
 * token, so PR/deployment events reach the Django receiver without the user
 * configuring anything in GitHub settings. No-ops cleanly when no public
 * webhook URL is configured (e.g. pure-local dev).
 */
const ensureRepoWebhook = async (owner, repo, accessToken) => {
  const publicUrl = process.env.WEBHOOK_PUBLIC_URL;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!publicUrl) {
    return { status: "skipped", reason: "WEBHOOK_PUBLIC_URL not configured" };
  }
  const hookUrl = `${publicUrl.replace(/\/$/, "")}/api/github/webhook/`;
  const base = `https://api.github.com/repos/${owner}/${repo}/hooks`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
  };
  try {
    const { data: hooks } = await axios.get(base, { headers });
    const existing = Array.isArray(hooks)
      ? hooks.find((h) => h.config?.url === hookUrl)
      : null;
    if (existing) return { status: "exists", id: existing.id, url: hookUrl };

    const { data: created } = await axios.post(
      base,
      {
        name: "web",
        active: true,
        events: ["pull_request", "deployment_status"],
        config: { url: hookUrl, content_type: "json", secret, insecure_ssl: "0" },
      },
      { headers }
    );
    return { status: "created", id: created.id, url: hookUrl };
  } catch (error) {
    return {
      status: "error",
      reason: error.response?.data?.message || error.message,
    };
  }
};

/**
 * One-click connect: record the repo as monitored (in the Django service) and
 * auto-register its webhook in one call.
 */
// All calls to the Django monitored endpoints carry the shared scanner secret;
// those endpoints are now locked to it (no longer publicly reachable).
const djangoHeaders = () => ({
  "Content-Type": "application/json",
  "X-Scanner-Secret": process.env.SCANNER_SHARED_SECRET,
});

const monitorRepository = async (userId, owner, repo) => {
  const user = await User.findById(userId);
  if (!user || !user.accessToken) {
    throw new Error("GitHub not linked");
  }

  let monitored;
  try {
    const resp = await axios.post(
      `${process.env.DJANGO_BACKEND_URL}/api/github/monitored/`,
      { owner, name: repo, user_id: userId },
      { headers: djangoHeaders(), validateStatus: () => true }
    );
    monitored =
      resp.status < 300
        ? { status: "ok", data: resp.data }
        : { status: "error", reason: resp.data?.error || `HTTP ${resp.status}` };
  } catch (error) {
    monitored = { status: "error", reason: error.message };
  }

  const webhook = await ensureRepoWebhook(owner, repo, user.accessToken);
  return { monitored, webhook };
};

/** List monitored repos (proxied to Django with the scanner secret). */
const listMonitoredRepos = async () => {
  const resp = await axios.get(
    `${process.env.DJANGO_BACKEND_URL}/api/github/monitored/`,
    { headers: djangoHeaders(), validateStatus: () => true }
  );
  if (resp.status >= 300) throw new Error(resp.data?.error || `HTTP ${resp.status}`);
  return resp.data;
};

/** Stop monitoring a repo (proxied to Django with the scanner secret). */
const unmonitorRepo = async (repoId) => {
  const resp = await axios.delete(
    `${process.env.DJANGO_BACKEND_URL}/api/github/monitored/${repoId}/`,
    { headers: djangoHeaders(), validateStatus: () => true }
  );
  if (resp.status >= 300) throw new Error(resp.data?.error || `HTTP ${resp.status}`);
  return resp.data;
};

/**
 * Report how the seamless onboarding paths are configured, so the UI can show
 * the right call-to-action (one-click GitHub App install vs. manual connect).
 */
const getOnboardingInfo = () => {
  const slug = process.env.GITHUB_APP_SLUG;
  return {
    appConfigured: !!slug,
    installUrl: slug ? `https://github.com/apps/${slug}/installations/new` : null,
    webhookAutoRegister: !!process.env.WEBHOOK_PUBLIC_URL,
  };
};

module.exports = {
  fetchRepoContents,
  getUserRepos,
  createGitHubIssue,
  createSecurityReportIssue,
  ensureRepoWebhook,
  monitorRepository,
  listMonitoredRepos,
  unmonitorRepo,
  getOnboardingInfo,
};
