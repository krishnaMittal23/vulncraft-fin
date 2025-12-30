const { OpenAI } = require("openai");
require("dotenv").config();

// Set OPENAI_API_KEY as fallback to prevent OpenAI library warnings
// We're using OpenRouter, so we'll use OPENROUTER_API_KEY as the actual key
if (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENROUTER_API_KEY;
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  // timeout: 60000,
  maxRetries: 2,
});

// Rate limiting and request queue management
let lastApiCall = 0;
const MIN_API_DELAY = 4000; // 4 seconds between calls to avoid rate limits
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 10000, 20000]; // Progressive backoff: 5s, 10s, 20s
const MAX_CHUNK_SIZE = 2500; // Max characters per chunk to stay within token limits
const MAX_ITEMS_PER_CHUNK = 5; // Max items per chunk for arrays

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (timeSinceLastCall < MIN_API_DELAY) {
    const waitTime = MIN_API_DELAY - timeSinceLastCall;
    console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next API call...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastApiCall = Date.now();
}

/**
 * Split data into manageable chunks for LLM processing
 */
function chunkData(data, chunkSize = MAX_ITEMS_PER_CHUNK) {
  if (!data) return [data];
  
  // If data is small enough, return as single chunk
  const dataStr = JSON.stringify(data, null, 2);
  if (dataStr.length <= MAX_CHUNK_SIZE) {
    return [data];
  }
  
  // For arrays, split into chunks
  if (Array.isArray(data)) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks.length > 0 ? chunks : [data];
  }
  
  // For objects with array properties, chunk those arrays
  if (typeof data === 'object' && data !== null) {
    const chunks = [];
    const keys = Object.keys(data);
    
    // Find large arrays in the object
    const largeArrayKeys = keys.filter(key => 
      Array.isArray(data[key]) && data[key].length > chunkSize
    );
    
    if (largeArrayKeys.length > 0) {
      // Split the first large array into chunks
      const arrayKey = largeArrayKeys[0];
      const arrayChunks = chunkData(data[arrayKey], chunkSize);
      
      arrayChunks.forEach((chunk, index) => {
        const chunkObj = { ...data };
        chunkObj[arrayKey] = chunk;
        chunkObj._chunkInfo = {
          chunkIndex: index + 1,
          totalChunks: arrayChunks.length,
          chunkedField: arrayKey
        };
        chunks.push(chunkObj);
      });
      
      return chunks;
    }
  }
  
  // If we can't chunk intelligently, truncate
  return [truncateData(data)];
}

/**
 * Truncate data to reduce token usage and avoid rate limits
 */
function truncateData(data, maxLength = MAX_CHUNK_SIZE) {
  const dataStr = JSON.stringify(data, null, 2);
  if (dataStr.length <= maxLength) {
    return data;
  }
  
  // Try to intelligently truncate
  if (Array.isArray(data)) {
    // For arrays, keep first few items
    const truncated = data.slice(0, MAX_ITEMS_PER_CHUNK);
    return [...truncated, { note: `... and ${data.length - MAX_ITEMS_PER_CHUNK} more items truncated` }];
  }
  
  if (typeof data === 'object' && data !== null) {
    // For objects, truncate long strings and large arrays
    const truncated = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.length > 500) {
        truncated[key] = value.substring(0, 500) + '... [truncated]';
      } else if (Array.isArray(value) && value.length > MAX_ITEMS_PER_CHUNK) {
        truncated[key] = [...value.slice(0, MAX_ITEMS_PER_CHUNK), `... ${value.length - MAX_ITEMS_PER_CHUNK} more items`];
      } else {
        truncated[key] = value;
      }
    }
    return truncated;
  }
  
  return data;
}

/**
 * Merge analysis results from multiple chunks
 */
function mergeChunkedAnalysis(chunkResults, nodeType) {
  if (chunkResults.length === 1) {
    return chunkResults[0];
  }
  
  console.log(`🔄 Merging ${chunkResults.length} chunk analyses...`);
  
  // Initialize merged result with first chunk
  const merged = { ...chunkResults[0] };
  merged.summary = `Analysis completed in ${chunkResults.length} chunks. ` + (merged.summary || '');
  
  // Merge array fields from all chunks
  for (let i = 1; i < chunkResults.length; i++) {
    const chunk = chunkResults[i];
    
    // Merge arrays (vulnerabilities, openPorts, etc.)
    for (const key of Object.keys(chunk)) {
      if (Array.isArray(chunk[key]) && Array.isArray(merged[key])) {
        merged[key] = [...merged[key], ...chunk[key]];
      } else if (typeof chunk[key] === 'object' && chunk[key] !== null && !Array.isArray(chunk[key])) {
        // Merge objects
        merged[key] = { ...merged[key], ...chunk[key] };
      }
    }
    
    // Update critical findings
    if (chunk.criticalFindings && Array.isArray(chunk.criticalFindings)) {
      merged.criticalFindings = [...(merged.criticalFindings || []), ...chunk.criticalFindings];
    }
    
    // Update recommendations
    if (chunk.recommendations && Array.isArray(chunk.recommendations)) {
      merged.recommendations = [...(merged.recommendations || []), ...chunk.recommendations];
    }
    
    // Keep highest risk level
    if (chunk.overallRisk) {
      const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const currentRisk = riskLevels.indexOf(merged.overallRisk || 'LOW');
      const newRisk = riskLevels.indexOf(chunk.overallRisk);
      if (newRisk > currentRisk) {
        merged.overallRisk = chunk.overallRisk;
      }
    }
  }
  
  // Deduplicate arrays
  if (merged.criticalFindings) {
    merged.criticalFindings = [...new Set(merged.criticalFindings)];
  }
  if (merged.recommendations) {
    merged.recommendations = [...new Set(merged.recommendations)];
  }
  
  return merged;
}

/**
 * Make LLM API call with retry logic and exponential backoff
 */
async function makeLLMRequest(systemPrompt, userPrompt, attemptNumber = 0) {
  await waitForRateLimit();
  
  try {
    const response = await openai.chat.completions.create({
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 2000, // Limit response size
    });

    const content = response.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error("Failed to parse LLM response - no JSON found");
  } catch (error) {
    const isRateLimit = error.message?.includes('rate limit') || 
                        error.message?.includes('429') || 
                        error.status === 429 ||
                        error.code === 'rate_limit_exceeded';
    
    if (isRateLimit && attemptNumber < MAX_RETRIES) {
      const retryDelay = RETRY_DELAYS[attemptNumber];
      console.warn(`⚠️ Rate limit hit (attempt ${attemptNumber + 1}/${MAX_RETRIES}). Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      lastApiCall = 0; // Reset rate limit timer
      return makeLLMRequest(systemPrompt, userPrompt, attemptNumber + 1);
    }
    
    throw error;
  }
}

/**
 * Process data in chunks with LLM analysis
 */
async function analyzeDataInChunks(data, nodeType, analysisFunction) {
  // Split data into chunks
  const chunks = chunkData(data);
  
  if (chunks.length === 1) {
    console.log(`📦 Processing single chunk for ${nodeType}`);
    return await analysisFunction(chunks[0]);
  }
  
  console.log(`📦 Processing ${chunks.length} chunks for ${nodeType}...`);
  const chunkResults = [];
  
  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`  📝 Analyzing chunk ${i + 1}/${chunks.length}...`);
      const result = await analysisFunction(chunks[i], i + 1, chunks.length);
      chunkResults.push(result);
      
      // Extra delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        console.log(`  ⏸️  Waiting before next chunk...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ❌ Error analyzing chunk ${i + 1}:`, error.message);
      
      // If one chunk fails due to rate limiting, return what we have
      if (error.message?.includes('rate limit') || error.status === 429) {
        console.warn(`  ⚠️  Stopping chunk analysis due to rate limit`);
        break;
      }
      
      // Add error result for this chunk
      chunkResults.push({
        summary: `Chunk ${i + 1} analysis failed`,
        error: error.message
      });
    }
  }
  
  // Merge all chunk results
  if (chunkResults.length > 0) {
    return mergeChunkedAnalysis(chunkResults, nodeType);
  }
  
  throw new Error('All chunks failed to analyze');
}

/**
 * Generate detailed analysis for Nmap scan results
 */
async function analyzeNmapResults(nmapData, chunkIndex = null, totalChunks = null) {
  console.log("🔍 Analyzing Nmap scan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a cybersecurity expert analyzing network scan results. Analyze the following Nmap scan data${chunkInfo} and provide a detailed security assessment.

Nmap Scan Data:
${JSON.stringify(nmapData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of findings (2-3 sentences)",
  "openPorts": [
    {
      "port": "port number/protocol",
      "service": "service name and version",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "concerns": ["list of security concerns"],
      "recommendations": ["list of security recommendations"]
    }
  ],
  "overallRisk": "HIGH|MEDIUM|LOW",
  "criticalFindings": ["list of critical issues"],
  "recommendations": ["list of general recommendations"]
}

Focus on:
- Security implications of open ports
- Outdated or vulnerable service versions
- Services that shouldn't be exposed
- Potential attack vectors
- Recommended security measures

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a cybersecurity expert specializing in network security analysis.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing Nmap results:", error.message);
    
    return {
      summary: "Analysis failed due to rate limiting or API error. Raw data available in report.",
      error: error.message,
      rawData: nmapData
    };
  }
}

/**
 * Generate detailed analysis for SQLMap scan results
 */
async function analyzeSQLMapResults(sqlmapData, chunkIndex = null, totalChunks = null) {
  console.log("🔍 Analyzing SQLMap scan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a web application security expert analyzing SQL injection scan results. Analyze the following SQLMap scan data${chunkInfo} and provide a detailed security assessment.

SQLMap Scan Data:
${JSON.stringify(sqlmapData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of SQL injection findings (2-3 sentences)",
  "vulnerabilities": [
    {
      "parameter": "vulnerable parameter name",
      "injectionType": "type of SQL injection",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "exploitability": "How easily this can be exploited",
      "potentialImpact": ["list of potential impacts"],
      "recommendations": ["list of remediation steps"]
    }
  ],
  "databaseInfo": {
    "dbms": "database management system",
    "version": "version if available",
    "implications": "security implications of this DBMS"
  },
  "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW",
  "criticalActions": ["immediate actions to take"],
  "recommendations": ["detailed security recommendations"]
}

Focus on:
- Severity and exploitability of SQL injection
- Data exposure risks
- Potential for privilege escalation
- Impact on data integrity and confidentiality
- Recommended fixes and security measures

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a web application security expert specializing in SQL injection vulnerabilities.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing SQLMap results:", error.message);
    
    return {
      summary: "Analysis failed due to rate limiting or API error. Raw data available in report.",
      error: error.message,
      rawData: sqlmapData
    };
  }
}

/**
 * Generate detailed analysis for Gobuster scan results
 */
async function analyzeGobusterResults(gobusterData, chunkIndex = null, totalChunks = null) {
  console.log("🔍 Analyzing Gobuster scan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a web security expert analyzing directory enumeration results. Analyze the following Gobuster scan data${chunkInfo} and provide a detailed security assessment.

Gobuster Scan Data:
${JSON.stringify(gobusterData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of findings (2-3 sentences)",
  "exposedDirectories": [
    {
      "path": "directory path",
      "statusCode": "HTTP status code",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "concerns": ["security concerns"],
      "recommendations": ["security recommendations"]
    }
  ],
  "exposedFiles": [
    {
      "path": "file path",
      "statusCode": "HTTP status code",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "concerns": ["security concerns"],
      "recommendations": ["security recommendations"]
    }
  ],
  "overallRisk": "HIGH|MEDIUM|LOW",
  "criticalFindings": ["critical exposed resources"],
  "recommendations": ["general security recommendations"]
}

Focus on:
- Sensitive directories or files exposed
- Administrative panels or endpoints
- Configuration files or backups
- Information disclosure risks
- Recommended access controls

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a web security expert specializing in web application reconnaissance.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing Gobuster results:", error.message);
    
    return {
      summary: "Analysis failed due to rate limiting or API error. Raw data available in report.",
      error: error.message,
      rawData: gobusterData
    };
  }
}

/**
 * Generate detailed analysis for WPScan results
 */
async function analyzeWPScanResults(wpscanData, chunkIndex = null, totalChunks = null) {
  console.log("🔍 Analyzing WPScan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a WordPress security expert analyzing WordPress vulnerability scan results. Analyze the following WPScan data${chunkInfo} and provide a detailed security assessment.

WPScan Data:
${JSON.stringify(wpscanData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of WordPress security status (2-3 sentences)",
  "wordpressVersion": {
    "version": "WordPress version",
    "vulnerabilities": ["known vulnerabilities"],
    "severity": "CRITICAL|HIGH|MEDIUM|LOW"
  },
  "plugins": [
    {
      "name": "plugin name",
      "version": "version if available",
      "vulnerabilities": ["list of vulnerabilities"],
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "recommendations": ["remediation steps"]
    }
  ],
  "themes": [
    {
      "name": "theme name",
      "vulnerabilities": ["list of vulnerabilities"],
      "severity": "CRITICAL|HIGH|MEDIUM|LOW"
    }
  ],
  "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW",
  "criticalActions": ["immediate actions required"],
  "recommendations": ["detailed security recommendations"]
}

Focus on:
- Outdated WordPress core version
- Vulnerable plugins and themes
- Security misconfigurations
- Recommended updates and patches
- Best security practices

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a WordPress security expert specializing in WordPress vulnerability assessment.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing WPScan results:", error.message);
    
    return {
      summary: "Analysis failed due to rate limiting or API error. Raw data available in report.",
      error: error.message,
      rawData: wpscanData
    };
  }
}

/**
 * Generate detailed analysis for Nikto results
 */
async function analyzeNiktoResults(niktoData, chunkIndex = null, totalChunks = null) {
  console.log("🔍 Analyzing Nikto scan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a web server security expert analyzing web vulnerability scan results. Analyze the following Nikto scan data${chunkInfo} and provide a detailed security assessment.

Nikto Scan Data:
${JSON.stringify(niktoData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of web server security findings (2-3 sentences)",
  "serverInfo": {
    "webServer": "web server software and version",
    "issues": ["security issues with server configuration"]
  },
  "vulnerabilities": [
    {
      "title": "vulnerability title",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "description": "detailed description",
      "impact": "potential security impact",
      "recommendations": ["remediation steps"]
    }
  ],
  "misconfigurations": [
    {
      "issue": "misconfiguration found",
      "severity": "HIGH|MEDIUM|LOW",
      "impact": "security impact",
      "fix": "how to fix"
    }
  ],
  "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW",
  "criticalFindings": ["most critical issues"],
  "recommendations": ["prioritized security recommendations"]
}

Focus on:
- Server software vulnerabilities
- Security headers missing
- Information disclosure
- Common web server misconfigurations
- SSL/TLS issues
- Recommended hardening measures

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a web server security expert specializing in web server vulnerability assessment.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing Nikto results:", error.message);
    
    return {
      summary: "Analysis failed due to rate limiting or API error. Raw data available in report.",
      error: error.message,
      rawData: niktoData
    };
  }
}

/**
 * Main function to generate detailed report for any node type
 */
async function generateDetailedNodeReport(nodeType, nodeData) {
  console.log(`\n📊 Generating detailed report for ${nodeType} node...`);
  
  // Check if LLM analysis is disabled
  if (process.env.DISABLE_LLM_ANALYSIS === 'true') {
    console.log("⚠️ LLM analysis is disabled via environment variable");
    return {
      summary: "LLM analysis disabled. Raw data available in report.",
      rawData: nodeData
    };
  }
  
  // Check if API key is missing
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("⚠️ OPENROUTER_API_KEY not configured. Skipping LLM analysis.");
    return {
      summary: "LLM analysis skipped (API key not configured). Raw data available in report.",
      rawData: nodeData
    };
  }
  
  try {
    switch (nodeType) {
      case "nmap":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeNmapResults);
      
      case "sqlmap":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeSQLMapResults);
      
      case "gobuster":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeGobusterResults);
      
      case "wpscan":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeWPScanResults);
      
      case "nikto":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeNiktoResults);
      
      case "owasp-vulnerabilities":
      case "owasp-zap":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeOWASPZapResults);
      
      case "owasp-baseline":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeOWASPComprehensiveResults);
      
      case "owasp-dependency-check":
        return await analyzeDataInChunks(nodeData, nodeType, analyzeOWASPDependencyResults);
      
      case "email":
      case "github-issue":
      case "slack":
        // These don't need security analysis
        return {
          summary: `${nodeType} notification sent successfully`,
          status: "completed",
          details: nodeData
        };
      
      default:
        return {
          summary: `${nodeType} execution completed`,
          rawData: nodeData
        };
    }
  } catch (error) {
    console.error(`Error generating detailed report for ${nodeType}:`, error);
    return {
      summary: `Report generation failed for ${nodeType}`,
      error: error.message,
      rawData: nodeData
    };
  }
}

/**
 * Generate detailed analysis for OWASP ZAP scan results
 */
async function analyzeOWASPZapResults(owaspData, chunkIndex = null, totalChunks = null) {
  console.log("🛡️ Analyzing OWASP ZAP scan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a cybersecurity expert analyzing OWASP ZAP scan results. Analyze the following OWASP ZAP data${chunkInfo} and provide a detailed security assessment.

OWASP ZAP Scan Data:
${JSON.stringify(owaspData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of OWASP ZAP findings (2-3 sentences)",
  "risk_assessment": {
    "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW",
    "risk_score": "numerical score 1-100",
    "confidence_level": "HIGH|MEDIUM|LOW"
  },
  "vulnerabilities": [
    {
      "name": "vulnerability name",
      "risk": "HIGH|MEDIUM|LOW|INFORMATIONAL",
      "confidence": "HIGH|MEDIUM|LOW",
      "description": "detailed description",
      "impact": "potential impact description",
      "solution": "remediation steps",
      "affected_urls": ["list of affected URLs"],
      "cwe": "CWE reference if available",
      "owasp_category": "OWASP Top 10 category if applicable"
    }
  ],
  "owasp_top10_findings": [
    {
      "category": "A01|A02|A03|etc",
      "name": "category name",
      "found": true|false,
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "details": ["specific findings"]
    }
  ],
  "security_headers": {
    "missing_headers": ["list of missing security headers"],
    "present_headers": ["list of present security headers"],
    "recommendations": ["header configuration recommendations"]
  },
  "ssl_tls_analysis": {
    "ssl_enabled": true|false,
    "protocol_version": "version if available",
    "security_level": "STRONG|MODERATE|WEAK",
    "recommendations": ["SSL/TLS recommendations"]
  },
  "recommendations": [
    {
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "action": "specific action to take",
      "timeline": "immediate|short-term|long-term"
    }
  ],
  "compliance_status": {
    "owasp_top10_compliance": "percentage compliant",
    "security_headers_compliance": "percentage compliant",
    "overall_security_posture": "EXCELLENT|GOOD|FAIR|POOR"
  }
}

Focus on:
- Critical security vulnerabilities requiring immediate attention
- OWASP Top 10 compliance assessment
- Security configuration issues
- Actionable remediation steps with clear priorities
- Business impact and risk assessment

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are an OWASP security expert specializing in web application vulnerability assessment and ZAP scan analysis.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing OWASP ZAP results:", error);
    throw error;
  }
}

/**
 * Generate detailed analysis for OWASP comprehensive scan results
 */
async function analyzeOWASPComprehensiveResults(owaspData, chunkIndex = null, totalChunks = null) {
  console.log("🔍 Analyzing OWASP comprehensive scan results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a senior cybersecurity consultant analyzing comprehensive OWASP security scan results. Analyze the following comprehensive OWASP data${chunkInfo} and provide an executive-level security assessment.

Comprehensive OWASP Scan Data:
${JSON.stringify(owaspData, null, 2)}

Provide a detailed executive report in the following JSON format:
{
  "executive_summary": "High-level summary for executives and stakeholders",
  "overall_security_posture": {
    "rating": "CRITICAL|HIGH|MEDIUM|LOW",
    "score": "numerical score 1-100",
    "trend": "IMPROVING|STABLE|DEGRADING"
  },
  "critical_findings": [
    {
      "finding": "critical issue description",
      "impact": "business impact",
      "urgency": "IMMEDIATE|HIGH|MEDIUM",
      "estimated_effort": "hours/days to fix"
    }
  ],
  "risk_breakdown": {
    "application_security": {
      "vulnerabilities_found": "number",
      "risk_level": "CRITICAL|HIGH|MEDIUM|LOW",
      "key_issues": ["list of key application security issues"]
    },
    "infrastructure_security": {
      "ssl_tls_status": "SECURE|WEAK|INSECURE",
      "security_headers": "COMPLETE|PARTIAL|MISSING",
      "key_issues": ["list of infrastructure security issues"]
    },
    "compliance_status": {
      "owasp_top10": "percentage compliant",
      "security_standards": "percentage compliant",
      "gaps": ["list of compliance gaps"]
    }
  },
  "business_impact_analysis": {
    "data_exposure_risk": "HIGH|MEDIUM|LOW",
    "service_availability_risk": "HIGH|MEDIUM|LOW",
    "compliance_risk": "HIGH|MEDIUM|LOW",
    "reputation_risk": "HIGH|MEDIUM|LOW",
    "financial_impact": "HIGH|MEDIUM|LOW"
  },
  "remediation_roadmap": [
    {
      "phase": "Immediate (0-30 days)",
      "actions": ["list of immediate actions"],
      "priority": "CRITICAL",
      "resources_needed": "team/time requirements"
    },
    {
      "phase": "Short-term (1-3 months)",
      "actions": ["list of short-term actions"],
      "priority": "HIGH",
      "resources_needed": "team/time requirements"
    },
    {
      "phase": "Long-term (3-12 months)",
      "actions": ["list of long-term actions"],
      "priority": "MEDIUM",
      "resources_needed": "team/time requirements"
    }
  ],
  "resource_requirements": {
    "security_team_hours": "estimated hours needed",
    "development_team_hours": "estimated hours needed",
    "external_consultants": "if external help needed",
    "tools_and_technologies": ["list of tools that may be needed"]
  },
  "success_metrics": [
    {
      "metric": "measurable security improvement",
      "target": "specific target value",
      "timeline": "when to achieve target"
    }
  ]
}

Focus on:
- Executive-level insights and business impact
- Clear prioritization of security issues
- Actionable remediation roadmap with timelines
- Resource requirements and cost implications
- Measurable success criteria

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a senior cybersecurity consultant specializing in comprehensive security assessments and executive reporting.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing OWASP comprehensive results:", error);
    throw error;
  }
}

/**
 * Generate detailed analysis for OWASP Dependency Check results
 */
async function analyzeOWASPDependencyResults(dependencyData, chunkIndex = null, totalChunks = null) {
  console.log("📦 Analyzing OWASP Dependency Check results...");
  
  const chunkInfo = chunkIndex ? ` (Chunk ${chunkIndex}/${totalChunks})` : '';
  
  const prompt = `You are a software security expert analyzing OWASP Dependency Check results. Analyze the following dependency vulnerability data${chunkInfo} and provide a detailed security assessment.

OWASP Dependency Check Data:
${JSON.stringify(dependencyData, null, 2)}

Provide a detailed report in the following JSON format:
{
  "summary": "Brief overview of dependency security status (2-3 sentences)",
  "dependency_overview": {
    "total_dependencies": "number of dependencies analyzed",
    "vulnerable_dependencies": "number with known vulnerabilities",
    "risk_level": "CRITICAL|HIGH|MEDIUM|LOW"
  },
  "critical_vulnerabilities": [
    {
      "dependency": "dependency name and version",
      "cve": "CVE identifier",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "cvss_score": "CVSS score if available",
      "description": "vulnerability description",
      "affected_versions": "versions affected",
      "fixed_version": "first version with fix",
      "exploitability": "how easily exploitable",
      "impact": "potential impact"
    }
  ],
  "supply_chain_risks": {
    "outdated_dependencies": "number of outdated dependencies",
    "maintenance_status": ["dependencies that are no longer maintained"],
    "license_issues": ["dependencies with license concerns"],
    "risk_assessment": "overall supply chain risk level"
  },
  "remediation_plan": [
    {
      "priority": "IMMEDIATE|HIGH|MEDIUM|LOW",
      "dependency": "dependency name",
      "action": "update|replace|remove",
      "recommended_version": "version to upgrade to",
      "effort_estimate": "time/complexity estimate",
      "testing_requirements": "what testing is needed"
    }
  ],
  "security_policies": {
    "update_strategy": "recommended update strategy",
    "monitoring_recommendations": "how to monitor for new vulnerabilities",
    "approval_process": "process for evaluating new dependencies"
  },
  "compliance_impact": {
    "regulatory_requirements": ["compliance frameworks affected"],
    "audit_findings": ["potential audit issues"],
    "documentation_needs": ["documentation required for compliance"]
  }
}

Focus on:
- Critical vulnerabilities requiring immediate patching
- Supply chain security risks and mitigation strategies
- Practical remediation steps with effort estimates
- Long-term dependency management recommendations
- Compliance and audit considerations

Return only valid JSON, no additional text.`;

  try {
    return await makeLLMRequest(
      "You are a software security expert specializing in dependency vulnerability analysis and supply chain security.",
      prompt
    );
  } catch (error) {
    console.error("Error analyzing OWASP Dependency results:", error);
    throw error;
  }
}

module.exports = {
  generateDetailedNodeReport,
  analyzeNmapResults,
  analyzeSQLMapResults,
  analyzeGobusterResults,
  analyzeWPScanResults,
  analyzeNiktoResults,
  analyzeOWASPZapResults,
  analyzeOWASPComprehensiveResults,
  analyzeOWASPDependencyResults,
};