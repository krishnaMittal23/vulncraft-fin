# 🛡️ VulnCraft V2 - Automated Vulnerability Scanning in GitHub CI/CD Pipelines

<div align="center">

![VulnCraft](https://img.shields.io/badge/VulnCraft-v2.0-blue?style=flat-square&logo=shield)
![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-ISC-orange?style=flat-square)

An enterprise-grade **automated vulnerability scanning platform** that integrates seamlessly with **GitHub CI/CD pipelines**. Create complex security workflows with a visual no-code interface, monitor repositories in real-time via webhooks, and get detailed security reports directly in pull requests.

[Features](#-features) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Workflow System](#-workflow-system) • [GitHub Integration](#-github-integration)

</div>


## TEAM UNFAZED:
- Krishna Mittal
- Rudransh Pratap Singh
- Ashish Singh
- Nikhil Yadav

---

## 🎯 Overview

VulnCraft V2 revolutionizes security testing by automating vulnerability scanning directly in your GitHub workflow. Unlike traditional security tools, VulnCraft provides a **visual, drag-and-drop workflow builder** that allows developers and security teams to create custom security scanning pipelines without writing a single line of code.

### Core Philosophy
**Security should be effortless, not bureaucratic.** With VulnCraft, security scanning becomes an integral part of your CI/CD pipeline, not an afterthought.

### Key Differentiators

- 🎨 **Visual Workflow Designer**: React Flow-based UI for building complex security workflows with drag-and-drop simplicity
- 🔀 **Series & Parallel Scanning**: Execute security tests sequentially or in parallel for maximum efficiency
- ⚙️ **Fully Customizable**: Add, modify, and configure scan parameters and tools on-the-fly without code
- 🔧 **Multi-Tool Integration**: OWASP, Nmap, Gobuster, SQLmap, and extensible tool ecosystem
- 🪝 **Smart Repository Monitoring**: Webhook-powered automatic scanning on PRs with instant feedback
- 📊 **Detailed Security Reports**: Comprehensive, user-scoped reports sent via email or PR comments
- 🤖 **AI-Powered Analysis** (Upcoming): MCP Server integration for prompt-based workflow generation
- ☁️ **Cloud-Ready**: Designed for GCP deployment with scalable architecture

---

## ✨ Core Features

### 1. **Visual Workflow Builder** 🎨
   - **React Flow-based UI**: Intuitive drag-and-drop interface for designing security workflows
   - **No-Code Complexity**: Create enterprise-grade security pipelines without programming knowledge
   - **Pre-built Scan Templates**: Predefined workflows for common security assessments
   - **Save & Reuse**: Store workflows for recurring security assessments
   - **Version Control**: Track workflow modifications and rollback capabilities

### 2. **Multi-Tool Security Scanning** 🔧
   - **OWASP Testing**: Comprehensive OWASP Top 10 vulnerability detection
   - **Nmap Integration**: Network scanning and port discovery
   - **Gobuster Integration**: Web directory and subdomain enumeration
   - **SQLmap Integration**: Advanced SQL injection detection and exploitation
   - **Bandit & Safety**: Python dependency vulnerability scanning
   - **Custom Tool Support**: Add and configure custom security tools
   - **Flexible Parameters**: Modify scan settings without redeploying

### 3. **Series & Parallel Execution** 🔀
   - **Sequential Scanning**: Run tests one after another with data dependencies
   - **Parallel Processing**: Execute multiple scans simultaneously for speed
   - **Conditional Branching**: Route scan results to different test paths based on findings
   - **Smart Scheduling**: Optimize test order based on dependencies and expected runtime
   - **Resource Management**: Intelligent allocation of scanning resources
   - **Execution Timeline**: Visual representation of scan progress and timing

### 4. **GitHub Repository Monitoring** 🪝
   - **Custom GitHub App**: Install VulnCraft as a GitHub App on your repositories
   - **Webhook Integration**: Automatic triggers on key events (push, PR, deployment)
   - **PR Monitoring**: Real-time tracking of pull request security status
   - **Automatic Scanning**: Security tests run automatically on repository changes
   - **PR Comment Reports**: Security findings posted directly in PR discussions
   - **Issue Management**: Automatic GitHub issue creation for critical vulnerabilities
   - **Non-Blocking Checks**: Detailed reports without blocking merges

### 5. **Smart Deployment Scanning** 🚀
   - **Ephemeral Deployment Handling**: Automatically scan temporary preview deployments
   - **Netlify/Vercel Integration**: Monitor preview environments for vulnerabilities
   - **Deployment Webhooks**: Automatic scanning when deployments are created
   - **Performance Testing**: Scan for security issues in live deployments
   - **Cleanup Management**: Automatic cleanup after scanning completes
   - **Deployment Metadata Tracking**: Link scans to specific deployments and commits

### 6. **Comprehensive Reporting System** 📊
   - **User-Scoped Reports**: Each user has secure access to their scan results
   - **Detailed Findings**: Vulnerabilities with severity, impact, and remediation guidance
   - **Multiple Export Formats**: PDF, HTML, JSON, CSV for different stakeholders
   - **Email Delivery**: Send reports directly to team members
   - **Report Scheduling**: Automatic generation and delivery on set schedules
   - **Historical Tracking**: Monitor vulnerability trends over time
   - **Comparison Reports**: Track remediation progress between scans

### 7. **Intelligent Code Analysis** 🤖
   - **AI-Powered Insights**: OpenRouter integration (Google Gemini 2.0 Flash)
   - **Context-Aware Analysis**: Understand code intent and security implications
   - **Multi-Language Support**: Analyze Python, JavaScript, TypeScript, Java, C#, Go, and more
   - **Vulnerability Explanation**: Get detailed explanations of security issues
   - **Remediation Suggestions**: AI-generated code fix recommendations
   - **Chat Interface**: Ask follow-up questions about vulnerabilities in real-time

### 8. **User Authentication & Access Control** 🔐
   - **Firebase Authentication**: Secure multi-factor authentication
   - **GitHub OAuth**: One-click sign-in with GitHub
   - **Session Management**: Secure session handling with Passport.js
   - **Role-Based Access**: Different permissions for different team members
   - **Organization Support**: Multi-team workspace management

### 9. **Real-time Collaboration** 💬
   - **Socket.IO Integration**: Real-time updates across all connected clients
   - **Live Notifications**: Instant alerts on new vulnerabilities
   - **Workflow Execution Updates**: Watch scans execute in real-time
   - **Shared Dashboards**: Team members see the same data simultaneously
   - **Presence Tracking**: Know who's currently reviewing reports

### 10. **MCP Server Integration** (🔥 Upcoming)
   - **Prompt-Based Workflow Generation**: Create workflows by describing what you need
   - **Automatic Workflow Creation**: AI generates optimal scanning pipelines
   - **Execution Management**: Run generated workflows with one click
   - **Report Generation**: Automatic report creation and delivery
   - **Minimal Effort Security**: Go from security need to detailed report in minutes

---

## 🏗️ Architecture

### System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│           VulnCraft V2 - GitHub-Integrated Security Platform          │
└──────────────────────────────────────────────────────────────────────┘

                          GITHUB ECOSYSTEM
    ┌─────────────────────────────────────────────────────────────┐
    │                                                               │
    │  Repository    ────→  Push Event                             │
    │                                                               │
    │  Pull Request  ────→  PR Opened Event  ────→  Webhook       │
    │                       PR Updated Event ────→  Triggered     │
    │                                                               │
    │  Deployment    ────→  Netlify/Vercel Preview Ready ─────→  │
    │                       (Auto-Deployment Webhook)             │
    │                                                               │
    └──────────────┬────────────────────────────────────────────────┘
                   │
                   │ Custom GitHub App
                   │ (VulnCraft Webhook Handler)
                   ↓
    ┌─────────────────────────────────────────────────────────────┐
    │              VulnCraft Backend - Webhook Receiver            │
    │  (Node.js Express + MongoDB)                                │
    │                                                               │
    │  ┌─────────────────────────────────────────────────────┐   │
    │  │  Webhook Handler                                    │   │
    │  │  • Validate GitHub signature                        │   │
    │  │  • Parse event payload                              │   │
    │  │  • Determine scanning requirements                  │   │
    │  │  • Trigger appropriate workflow                     │   │
    │  └──────────────┬──────────────────────────────────────┘   │
    │                 │                                            │
    │  ┌──────────────┴──────────────────────────────────────┐   │
    │  │  Workflow Execution Engine                          │   │
    │  │  • Load workflow definition                         │   │
    │  │  • Build execution graph                            │   │
    │  │  • Execute scans (series/parallel)                  │   │
    │  │  • Aggregate results                                │   │
    │  └──────────────┬──────────────────────────────────────┘   │
    │                 │                                            │
    │  ┌──────────────┴──────────────────────────────────────┐   │
    │  │  Security Scanning Services                         │   │
    │  │  • OWASP Testing                                    │   │
    │  │  • Nmap Network Scanning                            │   │
    │  │  • Gobuster Web Enumeration                         │   │
    │  │  • SQLmap SQL Injection Testing                     │   │
    │  │  • Code Analysis                                    │   │
    │  └──────────────┬──────────────────────────────────────┘   │
    │                 │                                            │
    │  ┌──────────────┴──────────────────────────────────────┐   │
    │  │  Report Generation & Distribution                   │   │
    │  │  • Compile findings                                 │   │
    │  │  • Generate formatted reports                       │   │
    │  │  • Send PR comments                                 │   │
    │  │  • Email delivery                                   │   │
    │  │  • Store in MongoDB                                 │   │
    │  └──────────────┬──────────────────────────────────────┘   │
    │                 │                                            │
    │                 └─→ Post to GitHub PR Comments              │
    │                 └─→ Create GitHub Issues                    │
    │                 └─→ Send Email Reports                      │
    └─────────────────────────────────────────────────────────────┘
         │                              │                    │
         │                              │                    │
         ↓                              ↓                    ↓
    React Frontend              MongoDB Database       Python Django
    (Workflow Builder)          (Reports, Users)        (Security Tools)
    (Dashboard)                 (Workflow Defs)         (Nmap, SQLmap, etc)
    (Real-time UI)              (Scan History)          (OWASP Tests)
```

### GitHub Integration Flow

```
┌──────────────────────────────────────────────────────────────────┐
│           GITHUB REPOSITORY MONITORING & SCANNING FLOW             │
└──────────────────────────────────────────────────────────────────┘

USER INSTALLS VULNCRAFT GITHUB APP ON REPO
        │
        ↓
┌──────────────────────────────┐
│  GitHub App Registration     │
│  • Permissions configured    │
│  • Webhook URL set           │
│  • Events subscribed         │
│    - push                    │
│    - pull_request            │
│    - deployment_status       │
└───────────┬──────────────────┘
            │
            │ Developer pushes code
            │ or opens a PR
            │
            ↓
    ┌───────────────────┐
    │  PR Created       │
    │  ↓               │
    │  GitHub sends    │
    │  webhook event   │
    │  to VulnCraft    │
    └────────┬──────────┘
             │
             ↓
    ┌─────────────────────────────────────┐
    │  VulnCraft Webhook Handler          │
    │  • Validate GitHub signature        │
    │  • Extract PR info                  │
    │  • Get user's configured workflow   │
    └────────┬────────────────────────────┘
             │
             ↓
    ┌─────────────────────────────────────┐
    │  Trigger Ephemeral Deployment       │
    │  • Check if preview available       │
    │  • Netlify/Vercel deployment        │
    │  • Wait for deployment ready        │
    └────────┬────────────────────────────┘
             │
             ↓ Deployment ready webhook
    ┌─────────────────────────────────────┐
    │  START SECURITY SCANNING             │
    │  Execute Workflow Nodes:             │
    │                                     │
    │  [Series/Parallel Execution]        │
    │  ├─ OWASP Testing                  │
    │  ├─ Nmap Scanning                  │
    │  ├─ SQLmap Testing                 │
    │  ├─ Gobuster Enumeration           │
    │  ├─ Dependency Checks               │
    │  └─ Code Analysis                  │
    │                                     │
    │  (with real-time progress updates)  │
    └────────┬────────────────────────────┘
             │
             ↓
    ┌─────────────────────────────────────┐
    │  Generate Security Report            │
    │  • Compile all findings              │
    │  • Calculate risk scores             │
    │  • Create remediation suggestions    │
    │  • Format for PR comments            │
    └────────┬────────────────────────────┘
             │
             ↓
    ┌─────────────────────────────────────┐
    │  POST RESULTS TO PR                  │
    │  • Comment on PR with findings       │
    │  • Highlight critical issues         │
    │  • Provide remediation guidance      │
    │  • Include scan timeline             │
    │  • Add link to full report           │
    └────────┬────────────────────────────┘
             │
             ├─→ MODERATOR REVIEWS
             │   ├─ Reads PR comments
             │   ├─ Checks detailed report
             │   └─ Makes merge decision
             │
             └─→ GITHUB ISSUE CREATION
                 ├─ Critical findings → auto-issue
                 └─ Link to PR scan results
```

### Workflow Execution with Series & Parallel

```
┌──────────────────────────────────────────────────────────────┐
│       WORKFLOW EXECUTION: SERIES vs PARALLEL                  │
└──────────────────────────────────────────────────────────────┘

SCENARIO 1: SERIES EXECUTION (Sequential)
============================================

User Input (GitHub Repo URL)
        │
        ↓
    ┌─────────────────────┐
    │ Node 1: OWASP Test  │ (5 min)
    │ Findings: 3 issues  │
    └──────────┬──────────┘
               │ (Pass findings)
               ↓
    ┌─────────────────────┐
    │ Node 2: SQLmap      │ (3 min)
    │ Findings: 1 issue   │
    └──────────┬──────────┘
               │ (Pass findings)
               ↓
    ┌─────────────────────┐
    │ Node 3: Nmap        │ (2 min)
    │ Findings: 2 issues  │
    └──────────┬──────────┘
               │
               ↓
    TOTAL TIME: 10 minutes
    Report: All 6 findings compiled


SCENARIO 2: PARALLEL EXECUTION
===============================

User Input (GitHub Repo URL)
        │
        ├─→ ┌─────────────────────┐
        │   │ Node 1: OWASP Test  │ (5 min) ─┐
        │   │ Findings: 3 issues  │          │
        │   └─────────────────────┘          │
        │                                    │
        ├─→ ┌─────────────────────┐          │
        │   │ Node 2: SQLmap      │ (3 min) ─┤
        │   │ Findings: 1 issue   │          │
        │   └─────────────────────┘          │
        │                                    │
        ├─→ ┌─────────────────────┐          │
        │   │ Node 3: Nmap        │ (2 min) ─┤
        │   │ Findings: 2 issues  │          │
        │   └─────────────────────┘          │
        │                                    │
        └─────────────────────────────────────┤
                                              ↓
                    TOTAL TIME: 5 minutes (parallel)
                    Report: All 6 findings compiled


SCENARIO 3: CONDITIONAL BRANCHING
===================================

User Input
    │
    ├─→ ┌─────────────────────────┐
    │   │ Node 1: Quick OWASP     │
    │   │ (15 sec check)          │
    │   └──────────┬──────────────┘
    │              │
    │              ├─→ IF Critical Issues Found
    │              │
    │              ├─→ ┌──────────────────┐
    │              │   │ Branch A:        │
    │              │   │ Deep SQLmap      │
    │              │   │ Full Nmap Scan   │
    │              │   │ Code Analysis    │
    │              │   └──────────────────┘
    │              │
    │              └─→ IF No Critical Issues
    │
    │              └─→ ┌──────────────────┐
    │                  │ Branch B:        │
    │                  │ Quick Report     │
    │                  │ Email Only       │
    │                  └──────────────────┘

Result: Optimize scan time based on initial findings
```

### Data Flow: PR Comment Generation

```
┌─────────────────────────────────────────────────────────────┐
│        PR COMMENT & REPORT GENERATION FLOW                   │
└─────────────────────────────────────────────────────────────┘

Scan Results Aggregated
        │
        ├─→ Severity Classification
        │   ├─ CRITICAL (Score: 9-10)
        │   ├─ HIGH (Score: 7-8)
        │   ├─ MEDIUM (Score: 4-6)
        │   └─ LOW (Score: 1-3)
        │
        ├─→ Grouping by Category
        │   ├─ Web Vulnerabilities
        │   ├─ Infrastructure Issues
        │   ├─ Dependency Vulnerabilities
        │   └─ Code Quality Issues
        │
        ├─→ Remediation Suggestions
        │   ├─ Reference OWASP/CWE
        │   ├─ Code examples (if available)
        │   └─ Best practices
        │
        └─→ Format for Multiple Outputs
                │
                ├─→ PR Comment Format
                │   └─ GitHub Markdown
                │   └─ Color-coded severity
                │   └─ Collapsible sections
                │   └─ Link to full report
                │
                ├─→ Email Format
                │   └─ HTML email
                │   └─ PDF attachment
                │   └─ Summary + Details
                │
                └─→ Database Storage
                    └─ Searchable findings
                    └─ Trend tracking
                    └─ User history
```

---

## � Workflow System

### What Makes VulnCraft Workflows Special?

Unlike traditional security tools that run fixed test suites, VulnCraft lets you build **custom security pipelines** tailored to your specific needs.

### Workflow Components

#### Node Types

1. **Scanner Nodes**
   - `OWASP`: Automated OWASP testing
   - `NMAP`: Network scanning and port discovery
   - `GOBUSTER`: Web enumeration and directory brute-forcing
   - `SQLMAP`: SQL injection detection
   - `DEPENDENCY_SCAN`: Python/Node.js dependency checking
   - `CODE_ANALYSIS`: AI-powered code analysis

2. **Utility Nodes**
   - `CONDITIONAL`: Branch based on previous results
   - `PARALLEL`: Execute multiple nodes simultaneously
   - `REPORT_GENERATION`: Compile findings into reports
   - `NOTIFICATION`: Send emails or webhooks
   - `DELAY`: Wait for specific conditions

3. **Data Transformation Nodes**
   - `FILTER`: Filter findings by severity
   - `AGGREGATE`: Combine results from multiple scans
   - `FORMAT`: Transform data for output

### Example Workflows

#### Workflow 1: Quick PR Security Check
```
Start
  ├─ Quick OWASP Test (parallel)
  ├─ Dependency Check (parallel)
  └─ Code Analysis (parallel)
    │
    ├─→ IF critical findings
    │   └─ Deep SQLmap Testing
    │   └─ Full Nmap Scan
    │
    └─→ Generate Report
        └─ Post to PR as comment
        └─ Email to team
```

#### Workflow 2: Comprehensive Security Assessment
```
Start
  ├─ OWASP Full Test Suite
  ├─ Nmap Network Scan
  ├─ Gobuster Directory Enumeration
  ├─ SQLmap SQL Injection Testing
  ├─ Dependency Vulnerability Check
  └─ Code Quality Analysis
    │
    ├─→ Aggregate All Findings
    ├─→ Classify by Severity
    ├─→ Generate PDF Report
    └─→ Email + GitHub Issue Creation
```

#### Workflow 3: Continuous Monitoring
```
Scheduled Daily (at 2 AM)
  ├─ Full Application Scan
  │   ├─ Infrastructure Testing
  │   ├─ Web App Testing
  │   └─ Code Analysis
    │
    ├─→ Compare with previous scan
    ├─→ Identify new vulnerabilities
    ├─→ Generate trend report
    └─→ Email if new issues found
```

### Scan Parameters (Fully Customizable)

**OWASP Testing Parameters:**
```json
{
  "testCategories": ["A01", "A02", "A03", "A04"],
  "depth": "comprehensive",
  "timeout": 300,
  "parallel": true
}
```

**Nmap Scanning Parameters:**
```json
{
  "scanType": "-sV -sC -O",
  "ports": "1-65535",
  "timing": "T3",
  "outputFormat": "json"
}
```

**SQLmap Parameters:**
```json
{
  "technique": ["UNION", "BOOLEAN", "TIME"],
  "level": 5,
  "risk": 3,
  "maxRequests": 10000
}
```

**Gobuster Parameters:**
```json
{
  "wordlist": "medium",
  "threads": 50,
  "statusCodes": ["200", "204", "301", "302"],
  "extensions": ["php", "html", "js", "txt"]
}
```

---

## Docker Image uploaded on dockerhub:

[VulnCraft Docker](https://hub.docker.com/r/r8dra/vulncraft)



## 🪝 GitHub Integration System

### Custom GitHub App

VulnCraft integrates as a **GitHub App**, not just OAuth. This enables:

- ✅ No need for personal access tokens
- ✅ Granular permissions control
- ✅ Webhook subscriptions to specific events
- ✅ Installation per repository or organization
- ✅ Audit trail for all actions

### Webhook Events & Triggers

| Event | Trigger | Action |
|-------|---------|--------|
| `push` | Code pushed to any branch | Trigger configured workflow |
| `pull_request.opened` | New PR created | Run security checks |
| `pull_request.synchronize` | PR updated with new commits | Re-run security checks |
| `deployment_status.success` | Netlify/Vercel preview ready | Auto-scan deployment |
| `pull_request_review` | Code review requested | Optional additional scans |

### Workflow: From PR to Report in 5 Steps

```
Step 1: PR Created
   └─ Developer opens pull request with code changes

Step 2: Webhook Triggered
   └─ GitHub sends webhook to VulnCraft
   └─ VulnCraft identifies user's configured workflow

Step 3: Ephemeral Deployment Scanning
   └─ Wait for Netlify/Vercel preview deployment
   └─ Run security scans on live preview environment

Step 4: Parallel Security Testing
   └─ Execute workflow nodes in series/parallel
   └─ Real-time progress updates via Socket.IO
   └─ Aggregate all findings

Step 5: Report & Feedback
   └─ Post comprehensive comment on PR
   └─ Create GitHub issues for critical findings
   └─ Email detailed report to team
   └─ Non-blocking - allows merge with warnings
```

### PR Comment Format Example

```markdown
## 🛡️ Security Scan Report - PR #42

**Scan Status:** ✅ Complete (5m 23s)

### 📊 Summary
- **Total Issues:** 8
- **Critical:** 1  🔴
- **High:** 3     🟠
- **Medium:** 4   🟡

### 🔴 Critical Issues

**1. SQL Injection in /api/users/search**
- **Severity:** CRITICAL (CVSS 9.8)
- **Tool:** SQLmap
- **Description:** Unvalidated SQL query parameter allows injection
- **Remediation:** Use parameterized queries
- **Reference:** [OWASP A03:2021](https://owasp.org/Top10/A03_2021-Injection/)

### 🟠 High Priority Issues
[... more details ...]

### 📎 Attachments
- [Download Full Report](https://vulncraft.io/reports/pr-42.pdf)
- [View Dashboard](https://vulncraft.io/dashboard)

---
*Scanned by VulnCraft • [Configure](https://github.com/settings/installations)*
```

---

```
VulnCraft-V2/
│
├── 📂 frontend/                          # React TypeScript Frontend
│   ├── 📄 package.json                   # Frontend dependencies
│   ├── 📄 vite.config.ts                 # Vite build configuration
│   ├── 📄 tsconfig.json                  # TypeScript configuration
│   ├── 📄 tailwind.config.js             # Tailwind CSS config
│   ├── 📄 eslint.config.js               # ESLint rules
│   ├── 📄 index.html                     # HTML entry point
│   ├── 📄 FIREBASE_SETUP.md              # Firebase setup guide
│   ├── 📂 public/                        # Static assets
│   ├── 📂 src/
│   │   ├── 📄 main.tsx                   # React entry point
│   │   ├── 📄 App.tsx                    # Main App component
│   │   ├── 📄 App.css                    # Global styles
│   │   ├── 📄 index.css                  # Base styles
│   │   │
│   │   ├── 📂 pages/                     # Page-level components
│   │   │   ├── Auth.tsx                  # Authentication page
│   │   │   ├── Dashboard.tsx             # Main dashboard
│   │   │   ├── LLMTester.tsx             # AI code analyzer
│   │   │   └── Workflowbuilder.tsx       # Workflow designer
│   │   │
│   │   ├── 📂 components/                # Reusable UI components
│   │   │   ├── 📂 auth/                  # Authentication components
│   │   │   ├── 📂 dashboard/             # Dashboard widgets
│   │   │   ├── 📂 intelligence/          # Analytics components
│   │   │   ├── 📂 workflowbuilder/       # Workflow UI components
│   │   │   ├── 📂 shared/                # Shared utilities
│   │   │   └── 📂 ui/                    # UI library (Radix + Tailwind)
│   │   │
│   │   ├── 📂 contexts/                  # React Context providers
│   │   │   └── User/Auth context managers
│   │   │
│   │   ├── 📂 hooks/                     # Custom React hooks
│   │   │   └── useAuth, useWebSocket, etc.
│   │   │
│   │   ├── 📂 routes/                    # Route definitions
│   │   │   └── Protected & public routes
│   │   │
│   │   ├── 📂 lib/                       # Utilities & helpers
│   │   │   └── API clients, validators, formatters
│   │   │
│   │   ├── 📂 types/                     # TypeScript type definitions
│   │   │   ├── api.ts
│   │   │   ├── workflow.ts
│   │   │   └── ...
│   │   │
│   │   └── 📂 assets/                    # Images, icons
│   │
│   └── 📄 .env                            # Environment variables
│
├── 📂 backend/                           # Node.js Express Backend
│   ├── 📄 package.json                   # Backend dependencies
│   ├── 📄 server.js                      # Express server entry
│   ├── 📄 .env                           # Environment variables
│   │
│   └── 📂 src/
│       ├── 📄 app.js                     # Express app setup
│       │
│       ├── 📂 routes/                    # API endpoint definitions
│       │   ├── 📄 authRoute.js           # /api/auth
│       │   ├── 📄 codeRoute.js           # /api/code
│       │   ├── 📄 workflowRoute.js       # /api/workflows
│       │   ├── 📄 chatRoute.js           # /api/chat
│       │   ├── 📄 githubRoute.js         # /api/github
│       │   ├── 📄 flowChartRoute.js      # /api/flowchart
│       │   └── 📄 reportRoute.js         # /api/reports
│       │
│       ├── 📂 controllers/               # Request handlers
│       │   ├── 📄 authCont.js            # Auth logic
│       │   ├── 📄 codeCont.js            # Code analysis handlers
│       │   ├── 📄 workflowCont.js        # Workflow management
│       │   ├── 📄 chatCont.js            # Chat handlers
│       │   ├── 📄 githubCont.js          # GitHub integration
│       │   ├── 📄 firebaseAuthCont.js    # Firebase auth
│       │   ├── 📄 flowChartCont.js       # Flowchart handling
│       │   └── 📄 reportCont.js          # Report generation
│       │
│       ├── 📂 services/                  # Business logic
│       │   ├── 📄 analysisServe.js       # AI-powered code analysis
│       │   │   ├─ analyzeCode()          # Security analysis
│       │   │   ├─ getQueryAboutCode()    # Chat-based analysis
│       │   │   └─ generateCodeAnalysisPrompt()
│       │   │
│       │   ├── 📄 workflowExecutionServe.js
│       │   │   ├─ executeWorkflow()      # Main execution logic
│       │   │   ├─ executeNode()          # Individual node execution
│       │   │   └─ validateWorkflow()     # Validation
│       │   │
│       │   ├── 📄 githubServe.js         # GitHub API integration
│       │   │   ├─ getUserRepos()
│       │   │   ├─ scanRepository()
│       │   │   └─ monitorPRs()
│       │   │
│       │   ├── 📄 chatServe.js           # Real-time chat
│       │   ├── 📄 authServe.js           # Authentication
│       │   ├── 📄 emailServe.js          # Email notifications
│       │   ├── 📄 reportAnalysisServe.js # Report generation
│       │   ├── 📄 flowChartServe.js      # Flowchart operations
│       │   ├── 📄 ephemeralDeployer.js   # Deployment handling
│       │   └── 📄 firebaseAuthServe.js   # Firebase integration
│       │
│       ├── 📂 models/                    # MongoDB schemas
│       │   ├── 📄 User.js                # User model
│       │   ├── 📄 Workflow.js            # Workflow definition
│       │   ├── 📄 Report.js              # Report model
│       │   └── 📄 CodeAnalysis.js        # Analysis cache
│       │
│       ├── 📂 config/                    # Configuration
│       │   ├── 📄 firebaseConfig.js      # Firebase setup
│       │   └── 📄 passport.js            # Passport strategies
│       │
│       ├── 📂 middlewares/               # Express middlewares
│       │   ├── 📄 authMiddleware.js      # Auth verification
│       │   └── 📄 firebaseAuthMiddleware.js
│       │
│       ├── 📂 lib/                       # Constants & utilities
│       │   └── 📄 constant.js            # App constants
│       │
│       └── 📂 utils/                     # Utility functions
│           ├── 📄 fixDuplicateFirebaseUids.js
│           ├── 📄 syncFirebaseUsers.js
│           └── 📄 validateGitHubConfig.js
│
├── 📂 services/                          # Python Django Backend
│   ├── 📄 manage.py                      # Django management
│   ├── 📄 requirements.txt                # Python dependencies
│   ├── 📄 docker-compose.yml              # Docker configuration
│   ├── 📄 Dockerfile                      # Docker image
│   ├── 📄 db.sqlite3                      # SQLite dev database
│   │
│   ├── 📂 vulncraft/                     # Django project settings
│   │   ├── 📄 settings.py                # Project configuration
│   │   ├── 📄 urls.py                    # Root URL routing
│   │   ├── 📄 wsgi.py                    # WSGI app
│   │   └── 📄 asgi.py                    # ASGI app
│   │
│   ├── 📂 github_integration/            # GitHub PR monitoring app
│   │   ├── 📄 models.py                  # Database models
│   │   ├── 📄 views.py                   # HTTP handlers
│   │   ├── 📄 urls.py                    # URL routing
│   │   ├── 📄 services/
│   │   │   └── GitHub webhook handlers
│   │   ├── 📄 github_app_auth.py         # GitHub OAuth
│   │   ├── 📄 admin.py                   # Django admin
│   │   ├── 📄 apps.py                    # App config
│   │   ├── 📄 README.md                  # Integration guide
│   │   └── 📂 migrations/                # Database migrations
│   │
│   ├── 📂 Vulnar/                        # Vulnerability assessment app
│   │   ├── 📄 models.py
│   │   ├── 📄 views.py
│   │   ├── 📄 urls.py
│   │   ├── 📄 services/
│   │   │   └── Security scanning logic
│   │   ├── 📄 admin.py
│   │   └── 📄 apps.py
│   │
│   └── 📂 Gobuster/                      # Web enumeration app
│       ├── 📄 models.py
│       ├── 📄 views.py
│       ├── 📄 urls.py
│       ├── 📄 services/
│       │   └── Subdomain enumeration
│       ├── 📄 admin.py
│       └── 📄 apps.py
│
├── 📂 scripts/                           # Utility scripts
│   ├── 📄 start_owasp_services.bat       # Windows startup
│   ├── 📄 test_owasp_integration.py      # Integration tests
│   ├── 📄 validate_owasp_integration.sh  # Validation script
│   ├── 📄 test_github_integration.sh     # GitHub tests
│   ├── 📄 test_webhook.py                # Webhook testing
│   └── 📄 setup_github_integration.sh    # Setup guide
│
├── 📄 README.md                          # This file
├── 📄 TODO.txt                           # Task tracking
├── 📄 temp.txt                           # Temporary notes
└── 📄 tempu.txt                          # Temporary notes

```

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have:
- **Node.js** (v18+)
- **npm** or **yarn**
- **Python** (v3.9+)
- **Docker** & **Docker Compose**
- **MongoDB** (local or cloud)
- **Firebase** account for authentication
- **GitHub** OAuth application
- **OpenRouter API** key for AI analysis

### 1. Clone the Repository

```bash
git clone https://github.com/singhashish9963/VulnCraft-V2.git
cd VulnCraft-V2
```

### 2. Environment Setup

#### Frontend (.env)
```bash
cd frontend
cat > .env << 'EOF'
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
EOF
```

#### Backend (.env)
```bash
cd ../backend
cat > .env << 'EOF'
MONGO_URI=mongodb://localhost:27017/vulncraft
SESSION_SECRET=your_secret_key_here
FRONTEND_URL=http://localhost:5173
OPENROUTER_API_KEY=your_openrouter_api_key
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EOF
```

#### Python Services (.env)
```bash
cd ../services
cat > .env << 'EOF'
DEBUG=True
SECRET_KEY=your_django_secret_key
DATABASE_URL=postgresql://user:password@localhost:5432/vulncraft
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_APP_ID=your_github_app_id
GITHUB_APP_PRIVATE_KEY=your_github_app_private_key
NETLIFY_API_TOKEN=your_netlify_token
OWASP_ZAP_URL=http://localhost:8080
EOF
```

### 3. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Backend
```bash
cd ../backend
npm install
```

#### Python Services
```bash
cd ../services
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
```

### 4. Start Services

#### Start MongoDB (if not using Docker)
```bash
# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

#### Start Docker Services
```bash
cd services
docker compose up -d
```

#### Start Backend
```bash
cd backend
npm run dev
# Backend will run on http://localhost:3000
```

#### Start Frontend
```bash
cd frontend
npm run dev
# Frontend will run on http://localhost:5173
```

#### Start Python Services
```bash
cd services
python manage.py runserver
# Django will run on http://localhost:8000
```

### 5. Verify Installation

```bash
# Check backend health
curl http://localhost:3000/api/health

# Check frontend accessibility
open http://localhost:5173

# Check Django
open http://localhost:8000/admin
```

---

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "name": "John Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

#### GitHub OAuth
```http
GET /api/auth/github
# Redirects to GitHub OAuth flow
```

---

### Code Analysis Endpoints

#### Analyze Code for Vulnerabilities
```http
POST /api/code/security
Content-Type: application/json
Authorization: Bearer {token}

{
  "code": "function vulnerable() { eval(userInput); }",
  "language": "javascript"
}

Response:
{
  "analysis": {
    "vulnerabilities": [
      {
        "title": "Code Injection via eval()",
        "severity": "HIGH",
        "description": "Using eval() with untrusted input",
        "impact": "Remote code execution",
        "remediation": "Replace eval() with safer alternatives"
      }
    ]
  }
}
```

#### Chat About Code
```http
POST /api/code/query
Content-Type: application/json
Authorization: Bearer {token}

{
  "code": [
    {
      "path": "src/auth.js",
      "content": "..."
    }
  ],
  "question": "How do I secure this authentication flow?"
}

Response:
{
  "answer": "..."
}
```

---

### Workflow Endpoints

#### Create Workflow
```http
POST /api/workflows
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Security Assessment Pipeline",
  "description": "Complete security workflow",
  "nodes": [
    {
      "id": "node1",
      "type": "CODE_ANALYSIS",
      "data": { "language": "javascript" }
    },
    {
      "id": "node2",
      "type": "REPORT_GENERATION",
      "data": { "format": "pdf" }
    }
  ],
  "edges": [
    {
      "source": "node1",
      "target": "node2"
    }
  ]
}

Response:
{
  "_id": "workflow_123",
  "name": "Security Assessment Pipeline",
  "createdAt": "2024-01-10T10:00:00Z"
}
```

#### Get All Workflows
```http
GET /api/workflows
Authorization: Bearer {token}

Response:
{
  "workflows": [
    {
      "_id": "workflow_123",
      "name": "Security Assessment Pipeline",
      "status": "active"
    }
  ]
}
```

#### Execute Workflow
```http
POST /api/workflows/:id/execute
Content-Type: application/json
Authorization: Bearer {token}

{
  "input": {
    "code": "...",
    "targetRepository": "https://github.com/user/repo"
  }
}

Response (WebSocket updates):
{
  "executionId": "exec_456",
  "status": "running",
  "currentNode": "node1",
  "progress": 25
}
```

#### Update Workflow
```http
PUT /api/workflows/:id
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Updated Name",
  "nodes": [...],
  "edges": [...]
}
```

#### Delete Workflow
```http
DELETE /api/workflows/:id
Authorization: Bearer {token}
```

---

### GitHub Integration Endpoints

#### Get User Repositories
```http
GET /api/github/repos
Authorization: Bearer {token}

Response:
{
  "repositories": [
    {
      "id": 123,
      "name": "my-repo",
      "url": "https://github.com/user/my-repo",
      "language": "JavaScript"
    }
  ]
}
```

#### Scan Repository
```http
POST /api/github/scan
Content-Type: application/json
Authorization: Bearer {token}

{
  "repoUrl": "https://github.com/user/my-repo",
  "includeSecrets": true,
  "includeDependencies": true
}

Response:
{
  "scanId": "scan_789",
  "status": "scanning",
  "results": {...}
}
```

#### Monitor PRs
```http
GET /api/github/prs/:owner/:repo
Authorization: Bearer {token}

Response:
{
  "pullRequests": [
    {
      "number": 42,
      "title": "Add new feature",
      "securityStatus": "pending"
    }
  ]
}
```

---

### Report Endpoints

#### Generate Report
```http
POST /api/reports/generate
Content-Type: application/json
Authorization: Bearer {token}

{
  "workflowExecutionId": "exec_456",
  "format": "pdf",
  "includeMetrics": true,
  "includeRecommendations": true
}

Response:
{
  "reportId": "report_123",
  "url": "https://cdn.example.com/reports/report_123.pdf",
  "generatedAt": "2024-01-10T10:00:00Z"
}
```

#### Get Report
```http
GET /api/reports/:id
Authorization: Bearer {token}

Response:
{
  "_id": "report_123",
  "title": "Security Assessment Report",
  "executionDate": "2024-01-10T10:00:00Z",
  "vulnerabilities": [...],
  "recommendations": [...]
}
```

---

### WebSocket Events

#### Connect
```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to server');
});
```

#### Workflow Updates
```javascript
socket.on('workflow:executing', (data) => {
  // {executionId, nodeId, status, progress}
  console.log(`Workflow ${data.executionId} is executing node ${data.nodeId}`);
});

socket.on('workflow:completed', (data) => {
  // {executionId, results, completedAt}
  console.log('Workflow completed');
});
```

#### Chat Messages
```javascript
socket.emit('chat:message', {
  message: 'How do I fix SQL injection?',
  conversationId: 'conv_123'
});

socket.on('chat:response', (data) => {
  // {response, conversationId}
  console.log('AI Response:', data.response);
});
```

---

---

## 🔐 Security Features

### Authentication & Authorization
- ✅ Firebase Authentication with MFA support
- ✅ GitHub OAuth integration (Sign in with GitHub)
- ✅ Custom GitHub App for repository integration
- ✅ JWT token-based API access
- ✅ Session management with Passport.js
- ✅ CORS configuration for cross-origin requests
- ✅ Secure webhook signature validation

### Vulnerability Detection
- ✅ OWASP Top 10 mapping
- ✅ CWE (Common Weakness Enumeration) classification
- ✅ Severity-based risk scoring (CRITICAL, HIGH, MEDIUM, LOW)
- ✅ Multi-language code analysis
- ✅ Network vulnerability detection (Nmap)
- ✅ Web application scanning (OWASP, SQLmap)
- ✅ Dependency vulnerability checking (Bandit, Safety)

### Data Protection
- ✅ Encrypted database connections
- ✅ Secure password hashing
- ✅ API rate limiting
- ✅ Input validation and sanitization
- ✅ HTTPS/TLS support
- ✅ User-scoped data access (no cross-user data leakage)
- ✅ Audit logging for all actions
- ✅ Secure report delivery (email encryption)

### CI/CD Integration Security
- ✅ Non-blocking security checks (don't block PR merges)
- ✅ Detailed PR comments without exposing sensitive data
- ✅ Automated issue creation for critical findings
- ✅ Audit trail of all workflow executions
- ✅ Webhook signature validation

---

## 🛠️ Technology Stack

### Frontend - Visual Workflow Builder
| Technology | Purpose | Version |
|-----------|---------|---------|
| **React** | UI framework | 19.x |
| **TypeScript** | Type safety | Latest |
| **React Flow** | Workflow visualization | 11.x |
| **Vite** | Build tool & dev server | 5.x |
| **Tailwind CSS** | Styling | 4.x |
| **Radix UI** | Component library | Latest |
| **React Hook Form** | Form handling | 7.x |
| **Socket.IO Client** | Real-time communication | 4.x |
| **Zod** | Data validation | Latest |
| **Axios** | HTTP client | Latest |

### Backend - Orchestration & Webhook Handler
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Express.js** | Web framework | 4.x |
| **Node.js** | Runtime | 18+ |
| **MongoDB** | NoSQL database | 5.x |
| **Mongoose** | ODM for MongoDB | 8.x |
| **Socket.IO** | Real-time WebSocket | 4.x |
| **Passport.js** | Authentication | 0.7.x |
| **Firebase Admin SDK** | User management | 13.x |
| **OpenRouter** | LLM API gateway | Latest |
| **Nodemailer** | Email service | 6.x |
| **Morgan** | Request logging | Latest |
| **Axios** | HTTP client | Latest |

### Security Tools - Python Services (Django)
| Tool | Purpose | Integration |
|------|---------|-------------|
| **Nmap** | Network scanning | python-nmap |
| **OWASP ZAP** | Web security testing | python-owasp-zap-v2.4 |
| **SQLmap** | SQL injection testing | Direct integration |
| **Gobuster** | Web enumeration | Direct integration |
| **Bandit** | Python code security | Direct integration |
| **Safety** | Dependency vulnerability checker | Direct integration |
| **CycloneDX** | SBOM generation | cyclonedx-bom |
| **PyGithub** | GitHub API interaction | PyGithub |

### Python Backend
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Django** | Web framework | Latest |
| **PostgreSQL** | Database | 14+ |
| **Celery** | Task queue | Latest |
| **python-nmap** | Network scanning | Latest |
| **python-owasp-zap** | Web app scanning | v2.4 |
| **PyJWT** | JWT handling | Latest |
| **python-dotenv** | Environment config | Latest |
| **Requests** | HTTP client | Latest |

### DevOps & Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **PostgreSQL** | Persistent database |
| **MongoDB** | Document database |
| **GCP** | Cloud platform (target) |
| **GitHub App** | Custom integration |
| **Netlify/Vercel** | Preview deployment monitoring |

### LLM & AI
| Service | Purpose |
|---------|---------|
| **OpenRouter** | LLM API gateway |
| **Google Gemini 2.0 Flash** | Code analysis & explanations |

---

## 📚 API Quick Reference

### Workflow Management

**Create Workflow**
```http
POST /api/workflows
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Quick Security Check",
  "description": "OWASP + Dependency checks",
  "nodes": [
    {
      "id": "node1",
      "type": "OWASP",
      "data": {
        "depth": "comprehensive",
        "timeout": 300
      }
    },
    {
      "id": "node2",
      "type": "DEPENDENCY_SCAN",
      "data": { }
    }
  ],
  "edges": [
    { "source": "node1", "target": "node2" }
  ]
}
```

**Execute Workflow on GitHub**
```http
POST /api/workflows/:id/execute
Authorization: Bearer {token}

{
  "githubUrl": "https://github.com/user/repo",
  "targetBranch": "main",
  "triggerSource": "pr"
}

Response: WebSocket connection with real-time updates
```

### Scan Reporting

**Get Report**
```http
GET /api/reports/:executionId
Authorization: Bearer {token}

Response:
{
  "executionId": "exec_123",
  "timestamp": "2024-01-10T10:00:00Z",
  "workflowName": "Quick Security Check",
  "status": "completed",
  "executionTime": 325,
  "findings": [
    {
      "id": "vuln_001",
      "title": "SQL Injection Vulnerability",
      "severity": "CRITICAL",
      "score": 9.8,
      "tool": "SQLmap",
      "description": "Unvalidated user input in database query",
      "remediation": "Use parameterized queries or prepared statements",
      "references": ["OWASP A03:2021-Injection", "CWE-89"]
    }
  ],
  "summary": {
    "total": 8,
    "critical": 1,
    "high": 3,
    "medium": 4,
    "low": 0
  }
}
```

**Send Report via Email**
```http
POST /api/reports/:executionId/email
Authorization: Bearer {token}

{
  "recipients": ["team@example.com", "security@example.com"],
  "format": "pdf",
  "includeDetails": true,
  "includeRemediationGuide": true
}
```

### GitHub Integration

**Get Monitored Repos**
```http
GET /api/github/repos
Authorization: Bearer {token}

Response:
{
  "repositories": [
    {
      "id": "gh_123",
      "name": "my-app",
      "url": "https://github.com/user/my-app",
      "monitoringEnabled": true,
      "workflowId": "wf_123",
      "lastScan": "2024-01-10T08:00:00Z",
      "lastScanStatus": "completed",
      "vulnerabilityCount": {
        "critical": 1,
        "high": 3,
        "medium": 4
      }
    }
  ]
}
```

**Configure Repository Monitoring**
```http
POST /api/github/monitor/:repoId
Authorization: Bearer {token}

{
  "workflowId": "wf_123",
  "enablePRComments": true,
  "autoCreateIssues": true,
  "severityThreshold": "HIGH",
  "notifyEmail": "security@example.com"
}
```

**Get PR Scan Results**
```http
GET /api/github/repos/:owner/:repo/prs/:prNumber/scan
Authorization: Bearer {token}

Response:
{
  "prNumber": 42,
  "scanId": "exec_456",
  "status": "completed",
  "scanTime": 120,
  "findings": [...],
  "prComment": {
    "id": "github_comment_123",
    "url": "https://github.com/user/repo/pull/42#issuecomment-xxx",
    "postedAt": "2024-01-10T09:30:00Z"
  }
}
```

### Real-time WebSocket Events

**Connect to Execution Feed**
```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  // Join execution room
  socket.emit('workflow:join', {
    executionId: 'exec_123'
  });
});

// Workflow execution progress
socket.on('workflow:progress', (data) => {
  console.log(`Node ${data.nodeId}: ${data.status}`);
  // {
  //   executionId: "exec_123",
  //   nodeId: "node1",
  //   status: "running|completed|failed",
  //   progress: 45,
  //   findings: {...}
  // }
});

// New finding detected
socket.on('workflow:finding', (data) => {
  // {
  //   nodeId: "node1",
  //   finding: { ... }
  // }
});

// Workflow complete
socket.on('workflow:completed', (data) => {
  // {
  //   executionId: "exec_123",
  //   status: "success|failed",
  //   totalTime: 325,
  //   totalFindings: 8,
  //   reportId: "rep_123"
  // }
});
```

---

## 🌟 Use Cases

### Use Case 1: Startup Development Team
**Scenario**: A small team building a SaaS application

**Solution**:
1. Install VulnCraft on GitHub repo
2. Configure simple workflow: OWASP + Dependency Check
3. Every PR automatically scanned
4. Results posted as PR comments
5. Team reviews and fixes before merging

**Result**: Security integrated into development workflow with minimal overhead

### Use Case 2: Enterprise Security Audit
**Scenario**: Large organization needs to audit multiple applications

**Solution**:
1. Create comprehensive workflow with all tools
2. Run against 10+ applications
3. Generate compliance reports
4. Track vulnerabilities over time
5. Share insights across security team

**Result**: Centralized security posture visibility

### Use Case 3: Continuous Security Monitoring
**Scenario**: Organization wants daily/weekly security assessments

**Solution**:
1. Create workflow with scheduled execution
2. Set up automatic daily scans at 2 AM
3. Email reports to security team
4. Auto-create GitHub issues for critical findings
5. Dashboard shows vulnerability trends

**Result**: Proactive vulnerability detection

### Use Case 4: Compliance Requirements
**Scenario**: Need to demonstrate OWASP compliance for certification

**Solution**:
1. Design workflow based on OWASP requirements
2. Automated testing of compliance controls
3. Generate compliance reports
4. Maintain audit trail of all tests
5. Use AI analysis for detailed remediation

**Result**: Compliance documentation ready for auditors

## 🤖 MCP Server (Next-Generation Security Intelligence)

### What is MCP Server?

The **Model Context Protocol (MCP) Server** integration transforms how users interact with VulnCraft. Instead of manually designing workflows, users simply describe what they want to secure, and VulnCraft's AI automatically:

1. **Understands** your security requirements from natural language
2. **Designs** optimal scanning workflows
3. **Executes** the workflows automatically
4. **Reports** findings with remediation suggestions

### How It Works

```
User Prompt
   │
   ├─ "I need to audit my Node.js API for OWASP vulnerabilities"
   │
   ↓
MCP Server (AI Analysis)
   │
   ├─ Parse natural language requirement
   ├─ Identify relevant tools needed
   │  ├─ Nmap for infrastructure
   │  ├─ OWASP for web app testing
   │  ├─ SQLmap for injection testing
   │  └─ Code analysis for best practices
   │
   ├─ Generate optimal workflow
   │  └─ Structure: Dependency check → Parallel scans → Report
   │
   ↓
Automatic Workflow Creation & Execution
   │
   ├─ Save workflow definition
   ├─ Execute immediately
   ├─ Real-time progress updates
   │
   ↓
Intelligent Report Generation
   │
   ├─ Compile all findings
   ├─ Prioritize by risk
   ├─ AI-powered remediation suggestions
   └─ Send to user/email
```

### Example MCP Interactions

**Interaction 1: Quick Security Check**
```
User: "Scan my GitHub repo for known vulnerabilities"

MCP Response:
✓ Created workflow: "GitHub Repo Vulnerability Scan"
✓ Executing: Dependency Check → Code Analysis → Report
⏳ Progress: 45% complete
📊 Findings so far: 3 issues (1 high, 2 medium)
📧 Report will be emailed when complete
```

**Interaction 2: Compliance Audit**
```
User: "I need to be PCI-DSS compliant for my payment processing system"

MCP Response:
✓ Created workflow: "PCI-DSS Compliance Assessment"
✓ Workflow nodes:
  - Network security scan (Nmap)
  - Web app vulnerability test (OWASP)
  - SQL injection testing (SQLmap)
  - Encryption & data protection analysis
  - Access control verification
✓ Executing...
```

**Interaction 3: Continuous Monitoring**
```
User: "Set up automated daily security scans for all my repos"

MCP Response:
✓ Created workflow: "Automated Daily Security Scan"
✓ Scheduled: Every day at 2:00 AM UTC
✓ Scope: All 5 repositories in your organization
✓ Report delivery: Email to security@company.com
✓ Escalation: Create GitHub issues for critical findings
```

### Key Benefits

- ⚡ **Minimal Effort**: Describe what you need, not how to test it
- 🎯 **Expert-Level Workflows**: AI designs optimal scanning strategies
- 🔄 **Automatic Scheduling**: Set it and forget it
- 📊 **Intelligent Reporting**: Context-aware vulnerability prioritization
- 🧠 **Learning System**: Improves recommendations over time

---

## 🚀 Deployment Guide

### Local Development

See [Quick Start](#-quick-start) section for detailed setup instructions.

### Docker Deployment

#### Build and Run

```bash
# Build backend image
cd backend
docker build -t vulncraft-backend:latest .

# Build Python services
cd ../services
docker build -t vulncraft-services:latest .

# Start all services
docker compose up -d

# Check logs
docker compose logs -f backend
docker compose logs -f services
```

#### Docker Compose Configuration

```yaml
services:
  backend:
    image: vulncraft-backend:latest
    ports:
      - "3000:3000"
    environment:
      - MONGO_URI=mongodb://mongo:27017/vulncraft
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    depends_on:
      - mongo
  
  services:
    image: vulncraft-services:latest
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/vulncraft
    depends_on:
      - postgres
  
  mongo:
    image: mongo:latest
    volumes:
      - mongo_data:/data/db
  
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### GCP Deployment (Recommended)

#### Prerequisites
- GCP account with billing enabled
- Google Cloud CLI installed
- Docker images pushed to Google Container Registry

#### Deploy to Cloud Run

```bash
# Deploy backend
gcloud run deploy vulncraft-backend \
  --image gcr.io/PROJECT_ID/vulncraft-backend:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars MONGO_URI=mongodb://...

# Deploy Python services
gcloud run deploy vulncraft-services \
  --image gcr.io/PROJECT_ID/vulncraft-services:latest \
  --platform managed \
  --region us-central1
```

#### Deploy to GKE (Kubernetes)

```bash
# Create cluster
gcloud container clusters create vulncraft-cluster \
  --zone us-central1-a \
  --num-nodes 3

# Deploy using kubectl
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/services-deployment.yaml
```

---

## 📚 Documentation & Guides

- [Firebase Setup Guide](./frontend/FIREBASE_SETUP.md)
- [GitHub Integration Guide](./services/github_integration/README.md)
- [Workflow Builder User Guide](./docs/WORKFLOW_BUILDER.md)
- [API Reference](./docs/API.md)
- [Security Best Practices](./docs/SECURITY.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)

---

## 🧪 Testing & Quality

### Running Tests

```bash
# Frontend
cd frontend
npm run lint
npm run test

# Backend
cd backend
npm test

# Python Services
cd services
python manage.py test
```

### Integration Tests

```bash
# GitHub Integration
bash scripts/test_github_integration.sh

# OWASP Integration
bash scripts/test_owasp_integration.sh

# Webhook Testing
python scripts/test_webhook.py
```

---

## 🐛 Troubleshooting

### Common Issues

#### Webhook Not Triggering

**Problem**: GitHub webhooks not received

**Solution**:
1. Verify GitHub App is installed on repository
2. Check webhook delivery in GitHub settings
3. Ensure VulnCraft backend is accessible from GitHub (not localhost)
4. Verify webhook signature validation in logs

#### Ephemeral Deployment Scanning Fails

**Problem**: Temporary deployments not being scanned

**Solution**:
1. Check Netlify/Vercel API token in `.env`
2. Verify deployment webhook is configured
3. Check deployment status in logs
4. Ensure VulnCraft has deployment detection enabled

#### Scan Timeouts

**Problem**: Scans timing out before completion

**Solution**:
1. Reduce scope of OWASP testing
2. Increase timeout values in workflow parameters
3. Run heavy scans (Nmap) separately
4. Check resource limits in Docker/GCP

#### MongoDB Connection Issues

**Problem**: MongoDB connection failed

**Solution**:
```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Or via Docker
docker exec vulncraft-mongo mongosh --eval "db.adminCommand('ping')"
```

## 📊 Comparison with Other Tools

| Feature | VulnCraft | OWASP ZAP | Burp Suite | GitHub Advanced Security |
|---------|-----------|-----------|-----------|------------------------|
| **Visual Workflow Builder** | ✅ | ❌ | ❌ | ❌ |
| **GitHub Integration** | ✅ | ❌ | ✅ (paid) | ✅ (limited) |
| **Multi-tool Orchestration** | ✅ | ❌ | ❌ | ❌ |
| **Series & Parallel Scans** | ✅ | ❌ | ❌ | ❌ |
| **AI-Powered Analysis** | ✅ | ❌ | ❌ | ❌ |
| **Customizable Parameters** | ✅ | ✅ | ✅ | Limited |
| **PR Comment Reports** | ✅ | ❌ | ❌ | ✅ |
| **Email Delivery** | ✅ | ❌ | ❌ | ❌ |
| **No-Code Workflow Design** | ✅ | ❌ | ❌ | ❌ |
| **MCP Server (Prompt-based)** | ✅ (Soon) | ❌ | ❌ | ❌ |
| **Cost** | Free/OSS | Free | $$$$ | $$$ |

---

## 💡 Key Statistics

- **🔧 5+** Security tools integrated
- **🎨 100%** No-code workflow design
- **⚡ 3-5x** Faster than manual security testing
- **📊 Real-time** Progress tracking via WebSocket
- **📧 100%** Automated report delivery
- **🔐 0** Cross-user data exposure
- **🪝 Webhook** Integration with GitHub, Netlify, Vercel

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Frontend: ESLint + Prettier
- Backend: Airbnb style guide
- Python: PEP 8

---




## 🙏 Acknowledgments

- **OpenRouter** for LLM API access
- **Google** for Gemini 2.0 Flash model
- **OWASP** for security standards
- **GitHub** for API and OAuth
- **Firebase** for authentication infrastructure
- **Radix UI** for accessible components
- **TailwindCSS** for utility-first CSS

---




<div align="center">

**Made with ❤️ by Team UnFazed**

[Website](https://vulncraft.io) • [GitHub](https://github.com/singhashish9963/VulnCraft-V2) • [Issues](https://github.com/singhashish9963/VulnCraft-V2/issues)

</div>
