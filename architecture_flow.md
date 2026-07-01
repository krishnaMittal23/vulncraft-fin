# 🗺️ VulnCraft - Complete File Architecture Flow

This diagram visualizes how every major file in the VulnCraft system interacts with each other. It traces the journey of a user request from the Express backend, through the BullMQ queue, into the Execution Engine, across the network to the Python Django microservice, and finally through the AI pipeline.

```mermaid
graph TD
    %% ==========================================
    %% 1. ENTRY POINTS & SETUP
    %% ==========================================
    subgraph "Server Initialization"
        ServerJS["backend/server.js<br>(Entry Point)"]
        AppJS["backend/src/app.js<br>(Express Config & Routes)"]
        ReaperJS["backend/src/lib/reaper.js<br>(Zombie Report Cleaner)"]
    end
    
    ServerJS -->|Imports & Uses| AppJS
    ServerJS -->|Starts background job| ReaperJS

    %% ==========================================
    %% 2. API CONTROLLERS & MODELS (Phase 1 & 2)
    %% ==========================================
    subgraph "API Controllers (The Waiters)"
        AuthCont["backend/src/controllers/authCont.js<br>(OAuth Login)"]
        WorkflowCont["backend/src/controllers/workflowCont.js<br>(CRUD & Execute)"]
        ReportCont["backend/src/controllers/reportCont.js<br>(Fetch Reports)"]
    end
    
    subgraph "MongoDB Models (The Filing Cabinets)"
        UserModel["backend/src/models/User.js"]
        WorkflowModel["backend/src/models/Workflow.js"]
        ReportModel["backend/src/models/Report.js"]
    end

    AppJS -->|Routes Requests| AuthCont
    AppJS -->|Routes Requests| WorkflowCont
    AppJS -->|Routes Requests| ReportCont

    AuthCont -->|Reads/Writes| UserModel
    WorkflowCont -->|Reads/Writes| WorkflowModel
    ReportCont -->|Reads| ReportModel
    ReaperJS -->|Cleans| ReportModel

    %% ==========================================
    %% 3. QUEUE SYSTEM (Phase 3)
    %% ==========================================
    subgraph "Queue System (BullMQ)"
        WorkflowQueue["backend/src/lib/workflowQueue.js<br>(BullMQ Spindle)"]
        RedisLib["backend/src/lib/redis.js<br>(Redis Connection)"]
    end

    WorkflowQueue -->|Uses| RedisLib
    WorkflowCont -->|When 'Run' is clicked<br>enqueueWorkflow()| WorkflowQueue
    ServerJS -->|On startup<br>startWorkflowWorker()| WorkflowQueue

    %% ==========================================
    %% 4. EXECUTION ENGINE (Phase 4)
    %% ==========================================
    subgraph "Execution Orchestrator (The Chef)"
        ExecServe["backend/src/services/workflowExecutionServe.js<br>(The 2,300-line Engine)"]
    end

    WorkflowQueue -->|Worker dequeues job| ExecServe
    ExecServe -->|Creates 'running' report| ReportModel
    ExecServe -.->|Emits live logs| SocketIO((Socket.IO Client))

    %% ==========================================
    %% 5. PYTHON DJANGO MICROSERVICE (Phase 5)
    %% ==========================================
    subgraph "Python Scanner Microservice"
        VulnUrls["services/vulncraft/urls.py<br>(Main Router)"]
        GobusterUrls["services/Gobuster/urls.py<br>(App Router)"]
        SecurityPy["services/vulncraft/security.py<br>(Bouncer: SSRF & HMAC)"]
        ViewsPy["services/Gobuster/views.py<br>(HTTP Handlers & Runners)"]
        
        %% Individual tool wrappers in services/
        OWASPPy["services/Gobuster/services/owasp_scanner.py"]
        NucleiPy["services/Gobuster/services/nuclei_runner.py"]
        WebHygPy["services/Gobuster/services/web_hygiene.py"]
        CodeScanPy["services/Gobuster/services/code_scan.py"]
    end

    ExecServe ==>|axios.post()| VulnUrls
    VulnUrls --> GobusterUrls
    GobusterUrls --> SecurityPy
    SecurityPy -->|If valid| ViewsPy
    
    ViewsPy -->|Runs via subprocess| OWASPPy
    ViewsPy -->|Runs via subprocess| NucleiPy
    ViewsPy -->|Runs via subprocess| WebHygPy
    ViewsPy -->|Runs via subprocess| CodeScanPy
    ViewsPy -->|Runs directly| CLI((Nmap, Gobuster, SQLMap CLI))

    ViewsPy ==>|Returns JSON Data| ExecServe

    %% ==========================================
    %% 6. CONSUMER NODES
    %% ==========================================
    subgraph "Consumer Services"
        EmailServe["backend/src/services/emailServe.js"]
        GithubServe["backend/src/services/githubServe.js"]
    end

    ExecServe -->|After scanners finish| EmailServe
    ExecServe -->|After scanners finish| GithubServe
    ExecServe -->|Direct API Call| SlackWebhook((Slack API))

    %% ==========================================
    %% 7. AI PIPELINE (Phase 6)
    %% ==========================================
    subgraph "AI Reporting Pipeline"
        ReportAnalysis["backend/src/services/reportAnalysisServe.js<br>(Node-level LLM Analysis)"]
        ReportPipeline["backend/src/services/reportPipelineServe.js<br>(Final Clean & Aggregate)"]
        LLM["backend/src/lib/llm.js<br>(Claude API Wrapper)"]
    end

    ExecServe -->|Analyzes single scanner| ReportAnalysis
    ExecServe -->|Builds final summary| ReportPipeline
    ReportAnalysis -->|Calls Anthropic| LLM
    ReportPipeline -->|Calls Anthropic| LLM
    
    ReportPipeline -->|Saves final data| ReportModel
    ExecServe -->|Emits 'workflow-completed'| SocketIO
```

### How to Read This Diagram
1. Follow the flow starting from `server.js` (Top Left).
2. Trace API requests entering `app.js` and being routed to the Controllers.
3. Watch as a workflow execution moves from `workflowCont.js` into the `workflowQueue.js` waiting list.
4. The background worker picks it up and hands it to the massive `workflowExecutionServe.js` engine.
5. The engine makes heavy HTTP requests over to the Python Django `urls.py`.
6. The Python `security.py` validates the request, and `views.py` runs the CLI tools.
7. Data flows back to `workflowExecutionServe.js`, where it is pushed to the `reportPipelineServe.js` for AI processing via `llm.js`.
8. Finally, the completed report is saved to `Report.js` in MongoDB.
