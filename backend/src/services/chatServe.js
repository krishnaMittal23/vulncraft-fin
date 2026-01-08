const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 30000, // 30 second timeout
});

/**
 * Security Workflow AI Agent
 * Converts natural language prompts into executable React Flow workflows
 * @param {string} message - User's security testing prompt
 * @returns {Promise<object>} - Generated workflow or chat response
 */
async function chat(message) {
  console.log("\n========== SECURITY WORKFLOW AI AGENT ==========");
  console.log(`💬 User prompt: "${message}"`);

  const startTime = Date.now();

  // Security validation: Block internal/localhost targets
  const internalPattern = /(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01]))/i;
  if (internalPattern.test(message)) {
    console.warn("⚠️ Blocked internal/localhost target");
    return {
      success: false,
      error: "Internal or localhost targets are not allowed for security reasons",
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  // Try to detect workflow intent
  const urlPattern = /(https?:\/\/[^\s]+)/i;
  const urlMatch = message.match(urlPattern);
  
  if (urlMatch || /scan|test|security|vulnerability|pentest|audit/i.test(message)) {
    console.log("🤖 Detected security workflow intent, invoking AI agent...");
    
    try {
      // Use LLM as intelligent workflow generator
      const systemPrompt = `You are a security workflow generator for VulnCraft. Convert user prompts into React Flow workflow JSON.

Available security scanner nodes:
- nmap: Port scanning and network discovery
- nikto: Web server scanner
- sqlmap: SQL injection testing
- gobuster: Directory/file brute forcing
- wpscan: WordPress security scanner
- owasp-zap: OWASP ZAP comprehensive web app scanner
- owasp-baseline: OWASP ZAP baseline scan
- owasp-vulnerabilities: OWASP comprehensive vulnerability scan
- flow-chart: Code flow analysis

Terminal nodes (must be last):
- email: Send results via email
- github-issue: Create GitHub issue
- slack: Send to Slack

Rules:
1. Always start with a "trigger" node containing the target URL
2. Chain scanners in logical order (e.g., nmap → nikto → sqlmap)
3. Always end with at least one terminal node (email/github-issue/slack)
4. Use exact node type names from the list above
5. Create edges connecting nodes sequentially
6. Position nodes horizontally (x: 250, 550, 850, etc.)

Return ONLY valid JSON in this exact format:
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": {"x": 250, "y": 200},
      "data": {"dataSource": "Domain", "frequency": "2hr", "sourceUrl": "TARGET_URL"}
    },
    {
      "id": "TOOL-1",
      "type": "TOOL_NAME",
      "position": {"x": 550, "y": 200},
      "data": {}
    },
    {
      "id": "email-1",
      "type": "email",
      "position": {"x": 850, "y": 200},
      "data": {"config": {"email": "security@example.com"}}
    }
  ],
  "edges": [
    {"id": "e1", "source": "trigger-1", "target": "TOOL-1", "type": "smoothstep", "animated": true},
    {"id": "e2", "source": "TOOL-1", "target": "email-1", "type": "smoothstep", "animated": true}
  ],
  "name": "Descriptive workflow name"
}

Example prompts:
- "scan example.com for vulnerabilities" → nmap → nikto → email
- "full web security scan" → nmap → nikto → owasp-zap → sqlmap → email
- "check for SQL injection" → sqlmap → email
- "WordPress security check" → wpscan → email

Return ONLY the JSON, no explanations.`;

      // Retry logic for rate limits
      let response;
      let retries = 3;
      let delay = 1000; // Start with 1 second
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          response = await openai.chat.completions.create({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
            max_tokens: 2000,
            temperature: 0.3,
          });
          break; // Success, exit retry loop
        } catch (apiError) {
          if (apiError.status === 429 && attempt < retries) {
            console.warn(`⚠️ Rate limit hit (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw apiError; // Give up after retries or other errors
          }
        }
      }

      const duration = Date.now() - startTime;

      if (!response?.choices?.[0]?.message?.content) {
        throw new Error('Invalid response from AI agent');
      }

      let content = response.choices[0].message.content.trim();
      
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      }

      // Validate and parse workflow JSON
      let workflow;
      try {
        workflow = JSON.parse(content);
      } catch (parseError) {
        console.error("❌ Failed to parse LLM response as JSON:", content);
        throw new Error('AI agent did not return valid JSON');
      }

      // Validate workflow structure
      if (!workflow.nodes || !Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
        throw new Error('Generated workflow has no nodes');
      }
      if (!workflow.edges || !Array.isArray(workflow.edges)) {
        throw new Error('Generated workflow has no edges');
      }

      // Ensure trigger node exists
      const hasTrigger = workflow.nodes.some(n => n.type === 'trigger');
      if (!hasTrigger) {
        throw new Error('Generated workflow missing trigger node');
      }

      // Ensure at least one terminal node
      const terminalTypes = ['email', 'github-issue', 'slack'];
      const hasTerminal = workflow.nodes.some(n => terminalTypes.includes(n.type));
      if (!hasTerminal) {
        throw new Error('Generated workflow missing terminal node');
      }

      // Extract target URL for security validation
      const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
      const targetUrl = triggerNode?.data?.sourceUrl || triggerNode?.data?.url;
      
      if (targetUrl && internalPattern.test(targetUrl)) {
        console.warn("⚠️ Blocked internal/localhost target in generated workflow");
        return {
          success: false,
          error: "Generated workflow contains internal/localhost target",
          responseTime: duration,
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`✅ AI agent generated workflow: ${workflow.name || 'Security Scan'}`);
      console.log(`📦 Nodes: ${workflow.nodes.length}, Edges: ${workflow.edges.length}`);
      console.log(`🔗 Workflow chain: ${workflow.nodes.map(n => n.type).join(' → ')}`);

      return {
        success: true,
        message: JSON.stringify(workflow),
        responseTime: duration,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error("\n" + "=".repeat(60));
      console.error("❌ AI AGENT WORKFLOW GENERATION FAILED");
      console.error("=".repeat(60));
      console.error(`Error Type: ${error.name || 'Error'}`);
      console.error(`Error Message: ${error.message}`);
      console.error(`HTTP Status: ${error.status || 'N/A'}`);
      console.error(`User Prompt: "${message}"`);
      console.error(`Time Elapsed: ${duration}ms`);
      
      // Special handling for rate limits
      if (error.status === 429) {
        console.error("\n🚨 RATE LIMIT EXCEEDED");
        console.error("   Possible causes:");
        console.error("   - Too many requests in short time");
        console.error("   - Free tier quota exhausted");
        console.error("   - API key has limited requests/minute");
        console.error("\n   Solutions:");
        console.error("   1. Wait a few minutes and try again");
        console.error("   2. Upgrade to a paid API tier");
        console.error("   3. Use a different API key");
        console.error("   4. Implement request throttling");
      }
      
      if (error.stack) {
        console.error(`\nStack Trace:\n${error.stack}`);
      }
      console.error("=".repeat(60));
      console.error("\n⚠️  FALLING BACK TO DEFAULT WORKFLOW\n");
      
      // Fallback to safe default workflow if AI fails
      const fallbackUrl = urlMatch ? urlMatch[1] : "https://example.com";
      const fallbackWorkflow = {
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 250, y: 200 },
            data: { dataSource: "Domain", frequency: "2hr", sourceUrl: fallbackUrl },
          },
          {
            id: "nmap-1",
            type: "nmap",
            position: { x: 550, y: 200 },
            data: {},
          },
          {
            id: "email-1",
            type: "email",
            position: { x: 850, y: 200 },
            data: { config: { email: "security@example.com" } },
          },
        ],
        edges: [
          { id: "e1", source: "trigger-1", target: "nmap-1", type: "smoothstep", animated: true },
          { id: "e2", source: "nmap-1", target: "email-1", type: "smoothstep", animated: true },
        ],
        name: `Basic security scan - ${fallbackUrl}`,
      };

      console.log("📋 Fallback Workflow Details:");
      console.log(`   - Target: ${fallbackUrl}`);
      console.log(`   - Nodes: trigger → nmap → email`);
      console.log(`   - Mode: Basic port scan with email report`);
      console.log("=".repeat(60) + "\n");
      
      return {
        success: true,
        message: JSON.stringify(fallbackWorkflow),
        responseTime: duration,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Not a security workflow - use normal chat
  console.log("💬 No security workflow intent detected, using normal chat...");
  try {
    const response = await openai.chat.completions.create({
        model: "meta-llama/llama-3.2-3b-instruct:free", // More generous rate limits
      messages: [
        { role: "system", content: "You are a helpful security assistant. Keep responses concise." },
        { role: "user", content: message },
      ],
      max_tokens: 500,
    });

    const duration = Date.now() - startTime;

    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from chat service');
    }

    const content = response.choices[0].message.content;
    console.log(`✅ Chat response in ${duration}ms`);
    console.log("==========================================\n");

    return {
      success: true,
      message: content,
      responseTime: duration,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Chat error:`, error.message);
    console.log("==========================================\n");

    return {
      success: false,
      error: error.message,
      responseTime: duration,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { chat };