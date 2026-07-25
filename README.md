# 🛡️ VulnCraft - AI-Powered Security Workflow Automation

VulnCraft is a powerful, AI-driven security vulnerability orchestration platform. It allows security teams to visually design and execute automated scanning workflows using industry-standard tools, aggregating the results through Anthropic's Claude LLM to produce actionable, human-readable intelligence.

## 🚀 Key Features

- **Visual Workflow Builder:** Drag-and-drop interface powered by React Flow to design custom security scan pipelines (e.g., Trigger -> Nmap -> Nuclei -> Slack).
- **Extensive Tool Integration:** Natively supports Nmap, Gobuster, SQLMap, WPScan, Nikto, Nuclei, and OWASP ZAP out of the box.
- **AI Security Analysis:** Automatically deduplicates, scores, and analyzes raw scan outputs using Anthropic Claude to generate executive summaries and actionable remediation steps.
- **Real-Time Execution:** Powered by WebSockets (Socket.IO) and BullMQ, providing live streaming console logs as the scanners run.
- **Microservice Architecture:** A scalable Node.js orchestration engine paired with an isolated Python Django microservice for secure tool execution.

## 🏗️ Architecture

VulnCraft's architecture is split across three main environments to ensure stability and security:

1. **Frontend (Vite + React + Tailwind):** 
   A modern, responsive dashboard for managing workflows, viewing reports, and monitoring repositories. Utilizes React Flow for the visual pipeline builder and Socket.IO for real-time live logs. (Recently migrated to modern Javascript!).

2. **Backend Engine (Node.js + Express + MongoDB):** 
   The central brain of the platform. Handles authentication, stores workflows, and manages the execution queue (via BullMQ + Redis). The orchestration engine handles dependency resolution for parallel scanner execution and pipes the final data into the LLM pipeline.

3. **Scanner Microservice (Python + Django):** 
   A dedicated Python application that wraps the raw CLI security tools (Nmap, Gobuster, Nuclei, etc.). It acts as a secure bouncer (handling SSRF & HMAC validation) before safely spawning subprocesses to run the actual scans.

*(For a deep dive into the system's execution pipeline, see `architecture_flow.md`)*

## 🛠️ Technology Stack

- **Frontend:** React 19, React Router, Vite, Tailwind CSS, Radix UI, React Flow, Socket.io-client.
- **Backend:** Node.js, Express, MongoDB (Mongoose), BullMQ, Redis, Socket.IO, Anthropic SDK.
- **Microservices:** Python, Django, Subprocess CLI execution.

## 🏃 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- MongoDB instance running locally or via Atlas
- Redis instance running locally
- Anthropic API Key (for the AI reporting pipeline)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/krishnaMittal23/vulncraft-fin.git
   cd vulncraft-fin
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   # Create a .env file based on .env.example with your MongoDB URI, Redis URL, and Anthropic Key
   npm run dev
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   # Set up your frontend environment variables if needed
   npm run dev
   ```

4. **Python Microservice Setup:**
   ```bash
   cd services
   pip install -r requirements.txt
   python manage.py runserver
   ```

Your backend API will typically run on `http://localhost:5000` and your frontend on `http://localhost:5173`. 

## 🛡️ Important Security Notice

VulnCraft is an active exploitation and scanning orchestration framework. **Do not use this tool against targets you do not have explicit, written authorization to test.** The developers assume no liability for misuse.
