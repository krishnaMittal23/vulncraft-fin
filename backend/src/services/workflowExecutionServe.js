const axios = require("axios");
const Report = require("../models/Report");
const Workflow = require("../models/Workflow");
const User = require("../models/User");
const { sendScanReport } = require("./emailServe");
const { generateDetailedNodeReport } = require("./reportAnalysisServe");
const { createSecurityReportIssue } = require("./githubServe");

const DJANGO_BACKEND_URL = process.env.DJANGO_BACKEND_URL || "http://localhost:8000";

/**
 * Execute a workflow
 * @param {string} workflowId - Workflow ID
 * @param {string} userId - User ID
 * @param {Object} io - Socket.IO instance
 * @returns {Promise<Object>} - Execution report
 */
async function executeWorkflow(workflowId, userId, io = null) {
  console.log(`\n========== WORKFLOW EXECUTION START ==========`);
  console.log(`Workflow ID: ${workflowId}`);
  console.log(`User ID: ${userId}`);

  // Emit log helper
  const emitLog = (level, message, nodeType = null) => {
    if (io) {
      io.to(`workflow-${workflowId}`).emit('execution-log', {
        timestamp: new Date(),
        level,
        message,
        nodeType,
        source: 'backend',
      });
    }
    console.log(`[${level.toUpperCase()}] ${message}`);
  };

  try {
    // Fetch workflow
    const workflow = await Workflow.findOne({ _id: workflowId, userId });
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    emitLog('info', `📋 Workflow: ${workflow.name}`);
    emitLog('info', `📦 Nodes: ${workflow.nodes.length}, Edges: ${workflow.edges.length}`);

    // Find trigger node
    const triggerNode = workflow.nodes.find(node => node.type === "trigger");
    if (!triggerNode) {
      throw new Error("No trigger node found in workflow");
    }

    // Check both 'url' and 'sourceUrl' for compatibility
    const targetUrl = triggerNode.data?.sourceUrl || triggerNode.data?.url;
    if (!targetUrl) {
      console.error("Trigger node data:", JSON.stringify(triggerNode.data, null, 2));
      throw new Error("No target URL specified in trigger node");
    }

    emitLog('info', `🎯 Target: ${targetUrl}`);

    // Create report
    const report = new Report({
      workflowId: workflow._id,
      userId,
      workflowName: workflow.name,
      targetUrl,
      status: "running",
      startTime: new Date(),
    });
    await report.save();

    emitLog('info', `📄 Report created: ${report._id}`);

    // Emit workflow started event
    if (io) {
      io.to(`workflow-${workflowId}`).emit('workflow-started', {
        workflowId,
        reportId: report._id,
        totalNodes: workflow.nodes.length,
        executionMode: 'parallel', // TODO: detect from workflow structure
      });
    }

    // Execute nodes in order
    const executionResults = await executeNodes(workflow.nodes, workflow.edges, targetUrl, report, io, workflowId, emitLog);

    // Calculate findings
    const findings = calculateFindings(executionResults);

    // Update report
    report.status = "completed";
    report.endTime = new Date();
    report.duration = report.endTime - report.startTime;
    report.results = executionResults;
    report.findings = findings;
    report.nodeResults = executionResults.nodeResults;
    report.executionErrors = executionResults.errors;
    
    await report.save();

    emitLog('info', `✅ Workflow execution completed`);
    emitLog('info', `⏱️  Duration: ${report.duration}ms`);
    emitLog('info', `🔍 Total findings: ${findings.total}`);

    // Emit workflow completed event
    if (io) {
      io.to(`workflow-${workflowId}`).emit('workflow-completed', {
        workflowId,
        reportId: report._id,
        duration: report.duration,
        findings,
      });
    }

    console.log(`==========================================\n`);

    return report;

  } catch (error) {
    emitLog('error', `❌ Workflow execution failed: ${error.message}`);
    
    // Try to update report if it exists
    try {
      const report = await Report.findOne({ workflowId, status: "running" });
      if (report) {
        report.status = "failed";
        report.endTime = new Date();
        report.executionErrors.push({
          message: error.message,
          timestamp: new Date(),
        });
        await report.save();
      }
    } catch (updateError) {
      console.error("Failed to update report:", updateError);
    }

    // Emit workflow failed event
    if (io) {
      io.to(`workflow-${workflowId}`).emit('workflow-failed', {
        workflowId,
        error: error.message,
      });
    }

    throw error;
  }
}

/**
 * Execute workflow nodes
 */
async function executeNodes(nodes, edges, targetUrl, report, io = null, workflowId = null, emitLog = () => {}) {
  const results = {
    nodeResults: [],
    errors: [],
    scanData: {},
  };

  // Build execution order based on edges
  const executionOrder = buildExecutionOrder(nodes, edges);
  emitLog('info', `🔄 Execution order: ${executionOrder.map(n => n.type).join(' -> ')}`);

  for (const node of executionOrder) {
    // Skip trigger node
    if (node.type === "trigger") continue;

    const startTime = new Date();
    emitLog('info', `🔧 Executing node: ${node.type} (${node.id})`, node.type);

    // Emit node started event
    if (io && workflowId) {
      io.to(`workflow-${workflowId}`).emit('node-started', {
        nodeId: node.id,
        nodeType: node.type,
        executionLevel: 1,
      });
    }

    try {
      let output = null;

      // Execute based on node type
      switch (node.type) {
        case "gobuster":
          output = await runGobuster(targetUrl, emitLog);
          break;
        case "nmap":
          output = await runNmap(targetUrl, emitLog);
          break;
        case "sqlmap":
          output = await runSQLMap(targetUrl, node.data, emitLog);
          break;
        case "wpscan":
          output = await runWPScan(targetUrl, emitLog);
          break;
        case "nikto":
          output = await runNikto(targetUrl, emitLog);
          break;
        case "owasp-vulnerabilities":
          output = await runOWASPCheck(targetUrl, emitLog);
          break;
        case "owasp-zap":
          output = await runOWASPZap(targetUrl, node.data);
          break;
        case "owasp-baseline":
          output = await runOWASPBaseline(targetUrl);
          break;
        case "owasp-dependency-check":
          output = await runOWASPDependencyCheck(targetUrl);
          break;
        case "flow-chart":
          output = await generateFlowchart(results.scanData);
          break;
        case "email":
          output = await sendEmail(node.data, results.scanData);
          break;
        case "github-issue":
          output = await createGithubIssue(node.data, results.scanData, results.nodeResults, report.userId);
          break;
        case "slack":
          output = await sendSlackNotification(node.data, results.scanData);
          break;
        default:
          console.log(`⚠️  Unknown node type: ${node.type}`);
          output = { message: "Node type not implemented" };
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      emitLog('info', `✅ Node completed in ${duration}ms`, node.type);

      // Emit node completed event
      if (io && workflowId) {
        io.to(`workflow-${workflowId}`).emit('node-completed', {
          nodeId: node.id,
          nodeType: node.type,
          duration,
        });
      }

      // Generate detailed report for security scan nodes
      let detailedAnalysis = null;
      const securityNodes = ["nmap", "sqlmap", "gobuster", "wpscan", "nikto"];
      
      if (securityNodes.includes(node.type) && output) {
        try {
          emitLog('info', `📊 Generating detailed analysis for ${node.type}...`, node.type);
          detailedAnalysis = await generateDetailedNodeReport(node.type, output);
          emitLog('info', `✅ Detailed analysis generated for ${node.type}`, node.type);
        } catch (analysisError) {
          emitLog('warning', `⚠️ Failed to generate detailed analysis: ${analysisError.message}`, node.type);
          detailedAnalysis = {
            summary: "Detailed analysis generation failed",
            error: analysisError.message
          };
        }
      }

      results.nodeResults.push({
        nodeId: node.id,
        nodeType: node.type,
        status: "completed",
        output,
        detailedAnalysis, // Add detailed LLM-generated analysis
        startTime,
        endTime,
        duration,
      });

      // Store scan data for later nodes
      if (output) {
        results.scanData[node.type] = output;
      }

    } catch (error) {
      const endTime = new Date();
      emitLog('error', `❌ Node failed: ${error.message}`, node.type);

      // Emit node failed event
      if (io && workflowId) {
        io.to(`workflow-${workflowId}`).emit('node-failed', {
          nodeId: node.id,
          nodeType: node.type,
          error: error.message,
          duration: endTime - startTime,
        });
      }

      results.nodeResults.push({
        nodeId: node.id,
        nodeType: node.type,
        status: "failed",
        output: null,
        startTime,
        endTime,
        duration: endTime - startTime,
      });

      results.errors.push({
        nodeId: node.id,
        nodeType: node.type,
        message: error.message,
        timestamp: new Date(),
      });
    }
  }

  return results;
}

/**
 * Build execution order from nodes and edges
 */
function buildExecutionOrder(nodes, edges) {
  // Simple topological sort
  const order = [];
  const visited = new Set();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Visit all target nodes first (dependencies)
    const outgoing = edges.filter(e => e.source === nodeId);
    outgoing.forEach(edge => visit(edge.target));

    order.unshift(node);
  }

  // Start with trigger node
  const triggerNode = nodes.find(n => n.type === "trigger");
  if (triggerNode) {
    visit(triggerNode.id);
  }

  return order;
}

/**
 * Call Django backend for Gobuster scan
 */
async function runGobuster(url) {
  console.log(`📤 Calling Gobuster service...`);
  try {
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/scan/`, {
      url,
      run_nikto: false,
      run_nmap: false,
    }, {
      timeout: 300000, // 5 minutes
    });
    
    const totalFindings = response.data.total_findings || 0;
    const directories = response.data.directories_found || [];
    const files = response.data.files_found || [];
    
    console.log(`📥 Gobuster found: ${totalFindings} items`);
    
    if (response.data.scan_errors) {
      console.warn(`⚠️  Gobuster warning: ${response.data.scan_errors}`);
    }
    
    // Log sample findings
    if (directories.length > 0) {
      console.log(`   📁 Directories: ${directories.slice(0, 3).map(d => d.path || d).join(', ')}${directories.length > 3 ? '...' : ''}`);
    }
    if (files.length > 0) {
      console.log(`   📄 Files: ${files.slice(0, 3).map(f => f.path || f).join(', ')}${files.length > 3 ? '...' : ''}`);
    }
    
    // Generate intelligence for discovered paths
    const directoryIntelligence = generateDirectoryIntelligence(directories, files);
    console.log(`🧠 Generated intelligence for ${directoryIntelligence.length} paths`);
    
    // Count critical findings
    const criticalPaths = directoryIntelligence.filter(d => d.sensitivityLevel === 'critical');
    if (criticalPaths.length > 0) {
      console.log(`   ⚠️  ${criticalPaths.length} CRITICAL paths found: ${criticalPaths.slice(0, 3).map(p => p.path).join(', ')}`);
    }
    
    // Add intelligence to response
    response.data.directory_intelligence = directoryIntelligence;
    
    return response.data;
  } catch (error) {
    console.error(`❌ Gobuster error:`, error.message);
    if (error.response) {
      console.error(`   Response status: ${error.response.status}`);
      console.error(`   Response data:`, error.response.data);
    }
    throw new Error(`Gobuster scan failed: ${error.message}`);
  }
}

/**
 * Call Django backend for Nmap scan
 */
async function runNmap(url) {
  console.log(`📤 Calling Nmap service...`);
  try {
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/scan/`, {
      url,
      run_nmap: true,
      run_gobuster: false,
      run_nikto: false,
    }, {
      timeout: 300000,
    });
    
    const totalFindings = response.data.total_findings || 0;
    const openPorts = response.data.nmap_scan?.open_ports || [];
    
    console.log(`📥 Nmap found: ${totalFindings} open ports`);
    
    if (openPorts.length > 0) {
      console.log(`   🔓 Ports: ${openPorts.map(p => `${p.port}/${p.protocol} (${p.service})`).slice(0, 3).join(', ')}${openPorts.length > 3 ? '...' : ''}`);
    }
    
    // Generate intelligence for discovered ports
    const portIntelligence = generatePortIntelligence(openPorts);
    console.log(`🧠 Generated intelligence for ${portIntelligence.length} ports`);
    
    // Count high-risk ports
    const highRiskPorts = portIntelligence.filter(p => p.riskScore >= 70);
    if (highRiskPorts.length > 0) {
      console.log(`   ⚠️  ${highRiskPorts.length} HIGH-RISK ports found: ${highRiskPorts.map(p => `${p.port} (risk: ${p.riskScore})`).slice(0, 3).join(', ')}`);
    }
    
    // Add intelligence to response
    if (response.data.nmap_scan) {
      response.data.nmap_scan.port_intelligence = portIntelligence;
    }
    
    // Return full response data to preserve total_findings
    return response.data;
  } catch (error) {
    console.error(`Nmap error:`, error.message);
    throw new Error(`Nmap scan failed: ${error.message}`);
  }
}

/**
 * Generate SQLMap vulnerability intelligence
 * Analyzes SQL injection findings and provides security context
 */
function generateSQLMapIntelligence(sqlmapScan) {
  if (!sqlmapScan || !sqlmapScan.vulnerable) {
    return [];
  }

  const vulnerabilities = sqlmapScan.vulnerabilities || [];
  const injectionPoints = sqlmapScan.injection_points || [];
  
  const intelligence = [];
  const seenVulnerabilities = new Set(); // Track unique vulnerabilities

  // Parse vulnerabilities if they're strings (common SQLMap output format)
  let parsedItems = [];
  
  if (injectionPoints.length > 0) {
    parsedItems = injectionPoints;
  } else if (vulnerabilities.length > 0) {
    // Check if vulnerabilities are strings that need parsing
    if (typeof vulnerabilities[0] === 'string') {
      // Parse string-based vulnerability output
      let currentVuln = null;
      vulnerabilities.forEach(line => {
        if (line.toLowerCase().includes('parameter:')) {
          if (currentVuln) parsedItems.push(currentVuln);
          currentVuln = { parameter: line.split(':')[1]?.trim() };
        } else if (line.toLowerCase().includes('type:') && currentVuln) {
          currentVuln.type = line.split(':')[1]?.trim();
        } else if (line.toLowerCase().includes('title:') && currentVuln) {
          currentVuln.title = line.split(':')[1]?.trim();
        } else if (line.toLowerCase().includes('payload:') && currentVuln) {
          currentVuln.payload = line.split(':')[1]?.trim();
        }
      });
      if (currentVuln) parsedItems.push(currentVuln);
    } else {
      // Already objects
      parsedItems = vulnerabilities;
    }
  } else {
    // Fallback to basic vulnerability info
    parsedItems = [{ parameter: 'detected', type: sqlmapScan.vulnerability_type }];
  }

  parsedItems.forEach(item => {
    const parameter = item.parameter || item.name || 'Unknown Parameter';
    const injectionType = item.type || item.injection_type || item.title || sqlmapScan.vulnerability_type || 'SQL Injection';
    const payload = item.payload || item.test_payload || 'N/A';

    // Create unique key for deduplication
    const uniqueKey = `${parameter}:${injectionType}`;
    
    // Skip if we've already processed this parameter + injection type combination
    if (seenVulnerabilities.has(uniqueKey)) {
      return; // Skip duplicate
    }
    seenVulnerabilities.add(uniqueKey);

    // Determine severity based on injection type and exploitability
    let severity = 'HIGH';
    let riskScore = 75;
    
    if (injectionType.toLowerCase().includes('boolean') || injectionType.toLowerCase().includes('time')) {
      severity = 'CRITICAL';
      riskScore = 95;
    } else if (injectionType.toLowerCase().includes('error')) {
      severity = 'CRITICAL';
      riskScore = 90;
    } else if (injectionType.toLowerCase().includes('union')) {
      severity = 'CRITICAL';
      riskScore = 98;
    }

    // Build security implications
    const securityImplications = [
      'Unauthorized database access possible',
      'Data exfiltration risk',
      'Potential for data modification or deletion',
      'Authentication bypass may be achievable'
    ];

    if (sqlmapScan.dbms) {
      securityImplications.push(`Target DBMS: ${sqlmapScan.dbms}`);
    }

    // Attack scenarios
    const attackScenarios = [
      'Extract sensitive data (users, passwords, credit cards)',
      'Modify or delete database records',
      'Execute administrative operations',
      'Read local files from the server',
      'Potentially execute OS commands'
    ];

    // Remediation steps
    const remediationSteps = [
      'Implement parameterized queries (prepared statements)',
      'Use ORM frameworks instead of raw SQL',
      'Apply input validation and sanitization',
      'Implement least privilege principle for database accounts',
      'Enable Web Application Firewall (WAF)',
      'Regular security audits and penetration testing',
      'Keep database software up to date'
    ];

    // Exploitation complexity
    let exploitationComplexity = 'MEDIUM';
    if (injectionType.toLowerCase().includes('union') || injectionType.toLowerCase().includes('error')) {
      exploitationComplexity = 'LOW';
    } else if (injectionType.toLowerCase().includes('time') || injectionType.toLowerCase().includes('boolean')) {
      exploitationComplexity = 'MEDIUM';
    }

    // Technical details
    const technicalDetails = {
      parameter,
      injectionType,
      payload: payload.substring(0, 100) + (payload.length > 100 ? '...' : ''),
      dbms: sqlmapScan.dbms || 'Unknown',
      exploitationComplexity,
      dataExtractionPossible: true,
      authenticatedRequired: false
    };

    // Business impact
    const businessImpact = [
      'Data breach and loss of confidentiality',
      'Regulatory compliance violations (GDPR, PCI-DSS)',
      'Reputational damage',
      'Financial losses from data theft',
      'Legal liabilities',
      'Service disruption potential'
    ];

    intelligence.push({
      parameter,
      injectionType,
      severity,
      riskScore,
      securityImplications,
      attackScenarios,
      remediationSteps,
      technicalDetails,
      businessImpact,
      cvss: riskScore / 10,
      exploitable: true,
      verified: true
    });
  });

  console.log(`   📊 Processed ${parsedItems.length} items, generated ${intelligence.length} unique vulnerabilities (filtered ${parsedItems.length - intelligence.length} duplicates)`);
  
  return intelligence;
}

/**
 * Call Django backend for SQLMap scan with enhanced logging and error handling
 */
async function runSQLMap(url, nodeData) {
  console.log(`\n📤 Starting SQLMap scan...`);
  console.log(`🎯 Target URL: ${url}`);
  
  try {
    // Use testUrl if provided, otherwise use the main URL
    const testUrl = nodeData?.testUrl || url;
    
    if (testUrl !== url) {
      console.log(`🔗 Test URL: ${testUrl}`);
    }
    
    console.log(`⏳ Sending request to Django backend... (may take 2-3 minutes)`);
    
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/scan/`, {
      url,
      test_url: testUrl,
      run_sqlmap: true,
      run_gobuster: false,
      run_nmap: false,
      run_nikto: false,
      run_wpscan: false,
    }, {
      timeout: 600000, // 5 minute timeout
    });
    
    console.log(`✅ SQLMap response received`);
    
    // Extract SQLMap results
    const sqlmapScan = response.data.sqlmap_scan || {};
    const totalFindings = response.data.total_findings || 0;
    
    // Log detailed results
    if (sqlmapScan.vulnerable) {
      console.log(`� VULNERABLE! SQL Injection detected`);
      console.log(`   Type: ${sqlmapScan.vulnerability_type || 'Unknown'}`);
      console.log(`   Findings: ${sqlmapScan.vulnerabilities?.length || 0} details`);
      console.log(`   Injection Points: ${sqlmapScan.injection_points?.length || 0}`);
      if (sqlmapScan.dbms) {
        console.log(`   DBMS: ${sqlmapScan.dbms}`);
      }
    } else if (sqlmapScan.error) {
      console.log(`⚠️ SQLMap scan error: ${sqlmapScan.error}`);
    } else {
      console.log(`✅ No SQL injection vulnerabilities detected`);
    }
    
    console.log(`📊 Total findings: ${totalFindings}`);
    
    // Generate SQL injection intelligence
    if (sqlmapScan.vulnerable) {
      console.log(`\n🧠 Generating SQL injection intelligence...`);
      const sqlIntelligence = generateSQLMapIntelligence(sqlmapScan);
      console.log(`   ✓ Generated intelligence for ${sqlIntelligence.length} vulnerability/vulnerabilities`);
      
      if (sqlIntelligence.length > 0) {
        const criticalVulns = sqlIntelligence.filter(v => v.severity === 'CRITICAL');
        const highVulns = sqlIntelligence.filter(v => v.severity === 'HIGH');
        
        console.log(`   📊 Severity breakdown:`);
        console.log(`      🔴 CRITICAL: ${criticalVulns.length}`);
        console.log(`      🟠 HIGH: ${highVulns.length}`);
        
        if (criticalVulns.length > 0) {
          console.log(`   ⚠️  CRITICAL vulnerabilities found!`);
          criticalVulns.forEach(v => {
            console.log(`      - ${v.parameter}: ${v.injectionType}`);
          });
        }
      }
      
      // Add intelligence to response
      response.data.sqlmap_intelligence = sqlIntelligence;
    }
    
    return response.data;
    
  } catch (error) {
    console.error(`❌ SQLMap scan failed:`, error.message);
    
    // Log additional error details
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data).substring(0, 200));
    } else if (error.request) {
      console.error(`   No response received from Django backend`);
    } else {
      console.error(`   Error details:`, error.message);
    }
    
    throw new Error(`SQLMap scan failed: ${error.message}`);
  }
}

/**
 * Call Django backend for WPScan
 */
async function runWPScan(url) {
  console.log(`📤 Calling WPScan service...`);
  try {
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/scan/`, {
      url,
      run_wpscan: true,
      run_gobuster: false,
      run_nmap: false,
      run_nikto: false,
    }, {
      timeout: 300000,
    });
    
    const totalFindings = response.data.total_findings || 0;
    console.log(`📥 WPScan found: ${totalFindings} issues`);
    
    return response.data;
  } catch (error) {
    console.error(`WPScan error:`, error.message);
    throw new Error(`WPScan failed: ${error.message}`);
  }
}

/**
 * Generate Nikto vulnerability intelligence
 * Analyzes Nikto web server scan findings and provides security context
 */
function generateNiktoIntelligence(niktoScan) {
  if (!niktoScan || !niktoScan.vulnerabilities || niktoScan.vulnerabilities.length === 0) {
    return [];
  }

  const vulnerabilities = niktoScan.vulnerabilities;
  const intelligence = [];
  
  // Deduplication map to avoid duplicate findings
  const seen = new Map();

  vulnerabilities.forEach(vuln => {
    // Extract vulnerability details (Nikto format varies)
    const issue = vuln.msg || vuln.message || vuln.description || vuln.title || 'Unknown issue';
    const uri = vuln.uri || vuln.url || vuln.path || '/';
    const method = vuln.method || 'GET';
    const osvdb = vuln.OSVDB || vuln.osvdb || '';
    
    // Create fingerprint for deduplication
    const fingerprint = `${issue}-${uri}`.toLowerCase().replace(/\s+/g, '');
    
    if (seen.has(fingerprint)) {
      return; // Skip duplicate
    }
    seen.set(fingerprint, true);

    // Determine severity based on issue description
    let severity = 'MEDIUM';
    let riskScore = 50;
    
    const issueLower = issue.toLowerCase();
    
    // Critical severity patterns
    if (issueLower.includes('sql injection') || 
        issueLower.includes('remote code execution') ||
        issueLower.includes('arbitrary code') ||
        issueLower.includes('file upload') ||
        issueLower.includes('authentication bypass') ||
        issueLower.includes('default credentials') ||
        issueLower.includes('shell') ||
        issueLower.includes('backdoor')) {
      severity = 'CRITICAL';
      riskScore = 95;
    }
    // High severity patterns
    else if (issueLower.includes('cross-site scripting') ||
             issueLower.includes('xss') ||
             issueLower.includes('directory traversal') ||
             issueLower.includes('path traversal') ||
             issueLower.includes('admin') ||
             issueLower.includes('password') ||
             issueLower.includes('sensitive') ||
             issueLower.includes('credentials') ||
             issueLower.includes('configuration file') ||
             issueLower.includes('database')) {
      severity = 'HIGH';
      riskScore = 80;
    }
    // Medium severity patterns
    else if (issueLower.includes('information disclosure') ||
             issueLower.includes('version') ||
             issueLower.includes('banner') ||
             issueLower.includes('header') ||
             issueLower.includes('debug') ||
             issueLower.includes('test file')) {
      severity = 'MEDIUM';
      riskScore = 60;
    }
    // Low severity
    else {
      severity = 'LOW';
      riskScore = 30;
    }

    // Build security implications
    const securityImplications = [];
    if (issueLower.includes('information disclosure') || issueLower.includes('version')) {
      securityImplications.push('Server information exposed to attackers');
      securityImplications.push('Version disclosure aids targeted attacks');
    }
    if (issueLower.includes('admin') || issueLower.includes('login')) {
      securityImplications.push('Administrative interface exposed');
      securityImplications.push('Potential for unauthorized access');
    }
    if (issueLower.includes('directory') || issueLower.includes('index')) {
      securityImplications.push('Directory listing enabled');
      securityImplications.push('File structure exposed');
    }
    if (issueLower.includes('ssl') || issueLower.includes('tls') || issueLower.includes('certificate')) {
      securityImplications.push('SSL/TLS configuration issues');
      securityImplications.push('Potential for man-in-the-middle attacks');
    }
    if (issueLower.includes('header') || issueLower.includes('cors')) {
      securityImplications.push('Missing security headers');
      securityImplications.push('Reduced defense against common attacks');
    }
    
    // Default implication
    if (securityImplications.length === 0) {
      securityImplications.push('Web server configuration weakness detected');
      securityImplications.push('Potential security risk identified');
    }

    // Build attack scenarios
    const attackScenarios = [];
    if (severity === 'CRITICAL') {
      attackScenarios.push('Direct exploitation possible');
      attackScenarios.push('Potential for complete system compromise');
      attackScenarios.push('Data exfiltration risk');
    } else if (severity === 'HIGH') {
      attackScenarios.push('Significant security vulnerability');
      attackScenarios.push('Can be chained with other attacks');
      attackScenarios.push('Requires immediate attention');
    } else {
      attackScenarios.push('Information gathering for targeted attacks');
      attackScenarios.push('Can aid in reconnaissance');
      attackScenarios.push('Should be addressed in security hardening');
    }

    // Build remediation steps
    const remediationSteps = [];
    if (issueLower.includes('version') || issueLower.includes('banner')) {
      remediationSteps.push('Disable server version disclosure');
      remediationSteps.push('Configure web server to hide version banners');
    }
    if (issueLower.includes('directory') || issueLower.includes('index')) {
      remediationSteps.push('Disable directory listing in web server configuration');
      remediationSteps.push('Add index files to all directories');
    }
    if (issueLower.includes('admin') || issueLower.includes('login')) {
      remediationSteps.push('Restrict access to administrative interfaces');
      remediationSteps.push('Implement IP whitelisting');
      remediationSteps.push('Enable multi-factor authentication');
    }
    if (issueLower.includes('ssl') || issueLower.includes('tls')) {
      remediationSteps.push('Update SSL/TLS configuration');
      remediationSteps.push('Use modern TLS versions (1.2+)');
      remediationSteps.push('Disable weak ciphers');
    }
    if (issueLower.includes('header')) {
      remediationSteps.push('Add security headers (X-Frame-Options, CSP, etc.)');
      remediationSteps.push('Configure HSTS for HTTPS sites');
    }
    if (issueLower.includes('default') || issueLower.includes('test')) {
      remediationSteps.push('Remove default/test files and directories');
      remediationSteps.push('Clean up unused files from production');
    }
    
    // Default remediation
    if (remediationSteps.length === 0) {
      remediationSteps.push('Review web server configuration');
      remediationSteps.push('Apply security hardening best practices');
      remediationSteps.push('Regular security audits and updates');
    }

    // Technical details
    const technicalDetails = {
      uri,
      method,
      osvdb: osvdb || 'N/A',
      serverInfo: niktoScan.server_info || 'Unknown',
      targetIP: niktoScan.target_ip || niktoScan.ip || 'N/A',
      targetPort: niktoScan.target_port || niktoScan.port || 80
    };

    // Business impact
    const businessImpact = [];
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      businessImpact.push('High risk of security breach');
      businessImpact.push('Potential for data loss or theft');
      businessImpact.push('Compliance violations possible');
      businessImpact.push('Reputational damage risk');
    } else {
      businessImpact.push('Increased attack surface');
      businessImpact.push('Security posture weakening');
      businessImpact.push('Compliance audit concerns');
    }

    intelligence.push({
      title: issue,
      uri,
      method,
      osvdb,
      severity,
      riskScore,
      securityImplications,
      attackScenarios,
      remediationSteps,
      technicalDetails,
      businessImpact,
      cvss: riskScore / 10,
      verified: true
    });
  });

  console.log(`   🔍 Generated intelligence for ${intelligence.length} unique findings (${vulnerabilities.length - intelligence.length} duplicates filtered)`);
  
  return intelligence;
}

/**
 * Call Django backend for Nikto scan
 */
async function runNikto(url) {
  console.log(`\n📤 Starting Nikto web server scan...`);
  console.log(`🎯 Target URL: ${url}`);
  
  // Normalize URL for Nikto (needs http:// or https://)
  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Check if it's an IP address or domain
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(url);
    
    if (isIP) {
      // For IP addresses, try HTTP first (most common)
      normalizedUrl = `http://${url}`;
      console.log(`   📝 Normalized IP to: ${normalizedUrl}`);
    } else {
      // For domains, prefer HTTPS (modern standard)
      normalizedUrl = `https://${url}`;
      console.log(`   📝 Normalized domain to: ${normalizedUrl}`);
    }
  }
  
  try {
    console.log(`⏳ Sending request to Django backend... (may take 2-5 minutes)`);
    
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/scan/`, {
      url: normalizedUrl,
      run_nikto: true,
      run_gobuster: false,
      run_nmap: false,
      run_wpscan: false,
      run_sqlmap: false,
    }, {
      timeout: 600000, // 10 minute timeout for Nikto (can be slow)
    });
    
    console.log(`✅ Nikto response received`);
    
    // Extract Nikto results
    const niktoScan = response.data.nikto_scan || {};
    const totalFindings = response.data.total_findings || 0;
    
    // Log detailed results
    if (niktoScan.vulnerabilities && niktoScan.vulnerabilities.length > 0) {
      console.log(`🔍 Nikto found ${niktoScan.vulnerabilities.length} vulnerabilities`);
      
      // Count by severity if available
      const severityCounts = {};
      niktoScan.vulnerabilities.forEach(vuln => {
        const severity = vuln.severity || 'info';
        severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      });
      
      Object.entries(severityCounts).forEach(([severity, count]) => {
        console.log(`   ${severity.toUpperCase()}: ${count}`);
      });
    } else {
      console.log(`✅ No major vulnerabilities detected by Nikto`);
    }
    
    if (niktoScan.server_info) {
      console.log(`🖥️  Server: ${niktoScan.server_info}`);
    }
    
    console.log(`📊 Total findings: ${totalFindings}`);
    
    // Generate Nikto intelligence
    if (niktoScan.vulnerabilities && niktoScan.vulnerabilities.length > 0) {
      console.log(`\n🧠 Generating Nikto vulnerability intelligence...`);
      const niktoIntelligence = generateNiktoIntelligence(niktoScan);
      console.log(`   ✓ Generated intelligence for ${niktoIntelligence.length} finding(s)`);
      
      if (niktoIntelligence.length > 0) {
        const criticalVulns = niktoIntelligence.filter(v => v.severity === 'CRITICAL');
        const highVulns = niktoIntelligence.filter(v => v.severity === 'HIGH');
        const mediumVulns = niktoIntelligence.filter(v => v.severity === 'MEDIUM');
        
        console.log(`   📊 Severity breakdown:`);
        console.log(`      🔴 CRITICAL: ${criticalVulns.length}`);
        console.log(`      🟠 HIGH: ${highVulns.length}`);
        console.log(`      🟡 MEDIUM: ${mediumVulns.length}`);
        
        if (criticalVulns.length > 0) {
          console.log(`   ⚠️  CRITICAL vulnerabilities found!`);
          criticalVulns.slice(0, 3).forEach(v => {
            console.log(`      - ${v.title || v.issue}`);
          });
        }
      }
      
      // Add intelligence to response
      response.data.nikto_intelligence = niktoIntelligence;
    }
    
    return response.data;
    
  } catch (error) {
    console.error(`❌ Nikto scan failed:`, error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, JSON.stringify(error.response.data).substring(0, 200));
    } else if (error.request) {
      console.error(`   No response received from Django backend`);
    } else {
      console.error(`   Error details:`, error.message);
    }
    
    throw new Error(`Nikto scan failed: ${error.message}`);
  }
}

/**
 * Run OWASP vulnerability check (placeholder - could integrate with OWASP ZAP)
 * Run comprehensive OWASP security check
 */
async function runOWASPCheck(url) {
  console.log(`🛡️ Running comprehensive OWASP check...`);
  try {
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/owasp/`, {
      url,
      active_scan: true,
      spider: true,
      owasp_top10_check: true,
      security_headers_check: true,
      ssl_tls_check: true,
      timeout: 300
    }, {
      timeout: 360000, // 6 minutes
    });

    const totalFindings = response.data.total_findings || response.data.total_vulnerabilities || 0;
    const riskRating = response.data.risk_rating || 'UNKNOWN';
    
    console.log(`📥 OWASP comprehensive scan found: ${totalFindings} vulnerabilities`);
    console.log(`🔍 Risk Rating: ${riskRating}`);

    if (response.data.scan_status === 'failed') {
      console.warn(`⚠️ OWASP scan warning: ${response.data.error}`);
    }

    return response.data;
  } catch (error) {
    console.error(`OWASP comprehensive scan error:`, error.message);
    throw new Error(`OWASP comprehensive scan failed: ${error.message}`);
  }
}

/**
 * Run OWASP ZAP full scan
 */
async function runOWASPZap(url, nodeData) {
  console.log(`🕷️ Running OWASP ZAP scan...`);
  try {
    const scanOptions = {
      url,
      active_scan: nodeData?.active_scan !== false,
      spider: nodeData?.spider !== false,
      timeout: nodeData?.timeout || 300
    };

    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/owasp/`, scanOptions, {
      timeout: 360000, // 6 minutes
    });

    const totalFindings = response.data.total_findings || response.data.total_vulnerabilities || 0;
    const zapResults = response.data.zap_scan || {};
    
    console.log(`📥 OWASP ZAP found: ${totalFindings} vulnerabilities`);
    
    if (zapResults.risk_counts) {
      const { High = 0, Medium = 0, Low = 0 } = zapResults.risk_counts;
      console.log(`   📊 Risk breakdown: ${High} High, ${Medium} Medium, ${Low} Low`);
    }

    // Generate ZAP intelligence
    if (totalFindings > 0) {
      console.log(`\n🧠 Generating OWASP ZAP intelligence...`);
      const zapIntelligence = generateOWASPIntelligence(response.data);
      console.log(`   ✓ Generated intelligence for ${zapIntelligence.length} vulnerability/vulnerabilities`);
      
      if (zapIntelligence.length > 0) {
        const criticalVulns = zapIntelligence.filter(v => v.severity === 'CRITICAL');
        const highVulns = zapIntelligence.filter(v => v.severity === 'HIGH');
        
        console.log(`   📊 Severity breakdown:`);
        console.log(`      🔴 Critical: ${criticalVulns.length}`);
        console.log(`      🟠 High: ${highVulns.length}`);
        console.log(`      🟡 Medium: ${zapIntelligence.length - criticalVulns.length - highVulns.length}`);
      }
    }

    return response.data;
  } catch (error) {
    console.error(`OWASP ZAP scan error:`, error.message);
    throw new Error(`OWASP ZAP scan failed: ${error.message}`);
  }
}

/**
 * Run OWASP ZAP baseline scan (faster)
 */
async function runOWASPBaseline(url) {
  console.log(`⚡ Running OWASP ZAP baseline scan...`);
  try {
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/owasp-baseline/`, {
      url
    }, {
      timeout: 180000, // 3 minutes
    });

    const totalFindings = response.data.total_findings || response.data.total_vulnerabilities || 0;
    console.log(`📥 OWASP baseline scan found: ${totalFindings} issues`);

    return response.data;
  } catch (error) {
    console.error(`OWASP baseline scan error:`, error.message);
    throw new Error(`OWASP baseline scan failed: ${error.message}`);
  }
}

/**
 * Run OWASP Dependency Check
 */
async function runOWASPDependencyCheck(url) {
  console.log(`� Running OWASP Dependency Check...`);
  try {
    const response = await axios.post(`${DJANGO_BACKEND_URL}/api/gobuster/owasp-dependency/`, {
      project_path: '/app'
    }, {
      timeout: 300000, // 5 minutes
    });

    const totalFindings = response.data.total_findings || 0;
    console.log(`📥 OWASP Dependency Check found: ${totalFindings} vulnerable dependencies`);

    return response.data;
  } catch (error) {
    console.error(`OWASP Dependency Check error:`, error.message);
    throw new Error(`OWASP Dependency Check failed: ${error.message}`);
  }
}

/**
 * Generate OWASP vulnerability intelligence
 * Analyzes OWASP scan findings and provides security context
 */
function generateOWASPIntelligence(owaspScan) {
  if (!owaspScan || owaspScan.scan_status === 'failed') {
    return [];
  }

  const vulnerabilities = owaspScan.zap_scan?.vulnerabilities || [];
  const owaspTop10 = owaspScan.owasp_top10_analysis?.vulnerable_categories || [];
  const securityHeaders = owaspScan.security_headers?.missing_headers || {};
  
  const intelligence = [];
  const seenVulnerabilities = new Set(); // Track unique vulnerabilities

  // Process ZAP vulnerabilities
  vulnerabilities.forEach(vuln => {
    const alertName = vuln.name || vuln.alert || 'Unknown Vulnerability';
    const risk = vuln.risk || 'Medium';
    const uniqueKey = `${alertName}:${vuln.url || 'global'}`;
    
    // Skip if we've already processed this vulnerability
    if (seenVulnerabilities.has(uniqueKey)) {
      return;
    }
    seenVulnerabilities.add(uniqueKey);

    // Map ZAP risk levels to our severity scale
    let severity = 'MEDIUM';
    let riskScore = 50;
    
    switch (risk.toLowerCase()) {
      case 'high':
        severity = 'CRITICAL';
        riskScore = 85;
        break;
      case 'medium':
        severity = 'HIGH';
        riskScore = 65;
        break;
      case 'low':
        severity = 'MEDIUM';
        riskScore = 35;
        break;
      case 'informational':
        severity = 'LOW';
        riskScore = 15;
        break;
    }

    // Build security implications
    const securityImplications = [
      vuln.description || 'Security vulnerability detected',
      'Potential for unauthorized access or data exposure',
      'May violate security compliance requirements'
    ];

    // Attack scenarios based on vulnerability type
    const attackScenarios = [];
    const alertLower = alertName.toLowerCase();
    
    if (alertLower.includes('xss') || alertLower.includes('cross-site scripting')) {
      attackScenarios.push('Script injection leading to session hijacking');
      attackScenarios.push('Malicious content injection');
      attackScenarios.push('Phishing attacks via reflected content');
    } else if (alertLower.includes('sql')) {
      attackScenarios.push('Database access and data extraction');
      attackScenarios.push('Data modification or deletion');
      attackScenarios.push('Authentication bypass');
    } else if (alertLower.includes('csrf') || alertLower.includes('cross-site request')) {
      attackScenarios.push('Unauthorized actions on behalf of users');
      attackScenarios.push('Account takeover attempts');
    } else {
      attackScenarios.push('Unauthorized access to application resources');
      attackScenarios.push('Information disclosure');
    }

    // Remediation steps
    const remediationSteps = [
      vuln.solution || 'Apply security patch or configuration change',
      'Implement input validation and output encoding',
      'Follow OWASP security guidelines',
      'Conduct security testing before deployment'
    ];

    // Technical details
    const technicalDetails = {
      alert_name: alertName,
      risk_level: risk,
      confidence: vuln.confidence || 'Medium',
      parameter: vuln.param || 'N/A',
      attack_vector: vuln.attack || 'N/A',
      evidence: vuln.evidence || 'N/A',
      affected_url: vuln.url || 'Multiple URLs',
      reference: vuln.reference || 'OWASP Guidelines'
    };

    // Business impact
    const businessImpact = [
      'Potential data breach and compliance violations',
      'Reputational damage from security incidents',
      'Financial losses from security breaches',
      'Legal liabilities and regulatory fines',
      'Service disruption and availability issues',
      'Loss of customer trust and confidence'
    ];

    intelligence.push({
      vulnerability_name: alertName,
      severity,
      risk_score: riskScore,
      affected_component: vuln.url || 'Application',
      securityImplications,
      attackScenarios,
      remediationSteps,
      technicalDetails,
      businessImpact,
      cvss: riskScore / 10,
      exploitable: true,
      verified: true,
      source: 'OWASP ZAP'
    });
  });

  // Process OWASP Top 10 findings
  owaspTop10.forEach(category => {
    const uniqueKey = `owasp_top10:${category}`;
    
    if (seenVulnerabilities.has(uniqueKey)) {
      return;
    }
    seenVulnerabilities.add(uniqueKey);

    intelligence.push({
      vulnerability_name: `OWASP Top 10 - ${category}`,
      severity: 'HIGH',
      risk_score: 75,
      affected_component: 'Application Architecture',
      securityImplications: [
        'Application vulnerable to OWASP Top 10 security risks',
        'High priority security issue requiring immediate attention',
        'Compliance and security framework violations'
      ],
      attackScenarios: [
        'Exploitation using common attack patterns',
        'Automated vulnerability scanning and exploitation',
        'Targeted attacks against known vulnerability classes'
      ],
      remediationSteps: [
        'Follow OWASP Top 10 remediation guidelines',
        'Implement security controls for identified category',
        'Conduct security training for development team',
        'Regular security testing and code review'
      ],
      technicalDetails: {
        owasp_category: category,
        source: 'OWASP Top 10 2021',
        priority: 'High'
      },
      businessImpact: [
        'Critical security vulnerability class identified',
        'High risk of successful attacks',
        'Immediate remediation required'
      ],
      cvss: 7.5,
      exploitable: true,
      verified: true,
      source: 'OWASP Top 10 Analysis'
    });
  });

  // Process missing security headers
  Object.entries(securityHeaders).forEach(([header, info]) => {
    const uniqueKey = `security_header:${header}`;
    
    if (seenVulnerabilities.has(uniqueKey)) {
      return;
    }
    seenVulnerabilities.add(uniqueKey);

    const severity = info.risk === 'Medium' ? 'MEDIUM' : 'LOW';
    const riskScore = info.risk === 'Medium' ? 45 : 25;

    intelligence.push({
      vulnerability_name: `Missing Security Header: ${header}`,
      severity,
      risk_score: riskScore,
      affected_component: 'HTTP Response Headers',
      securityImplications: [
        info.description || 'Missing security header increases attack surface',
        'Reduced protection against common web attacks',
        'Non-compliance with security best practices'
      ],
      attackScenarios: [
        'Browser-based attacks due to missing protections',
        'Clickjacking, XSS, or MIME sniffing attacks',
        'Information disclosure vulnerabilities'
      ],
      remediationSteps: [
        `Add ${header} header to HTTP responses`,
        'Configure web server or application to include security headers',
        'Implement Content Security Policy if applicable',
        'Test header configuration across all endpoints'
      ],
      technicalDetails: {
        missing_header: header,
        recommendation: `Implement ${header} header`,
        header_type: 'Security Header'
      },
      businessImpact: [
        'Increased vulnerability to web-based attacks',
        'Potential compliance issues',
        'Reduced user security and trust'
      ],
      cvss: riskScore / 10,
      exploitable: true,
      verified: true,
      source: 'Security Headers Analysis'
    });
  });

  console.log(`   📊 Processed ${vulnerabilities.length + owaspTop10.length + Object.keys(securityHeaders).length} items, generated ${intelligence.length} unique vulnerabilities`);
  
  return intelligence;
}

/**
 * Generate flowchart from scan results
 */
async function generateFlowchart(scanData) {
  console.log(`📊 Generating flowchart...`);
  return {
    message: "Flowchart generated",
    data: scanData,
  };
}

/**
 * Send email notification
 */
async function sendEmail(nodeData, scanData) {
  // Check multiple possible locations for email configuration
  const email = nodeData?.config?.email || nodeData?.email || nodeData?.data?.config?.email;
  const subject = nodeData?.config?.subject || nodeData?.subject || "Security Scan Report";
  
  console.log(`📧 Sending email to: ${email || 'not configured'}`);
  console.log(`📧 Node data structure:`, JSON.stringify(nodeData, null, 2));
  
  if (!email) {
    throw new Error("Email address not configured in node settings");
  }
  
  const result = await sendScanReport(
    {
      to: email,
      subject: subject,
    },
    scanData
  );
  
  return result;
}

/**
 * Create GitHub issue
 */
async function createGithubIssue(nodeData, scanData, nodeResults, userId) {
  console.log(`🐙 Creating GitHub issue...`);
  try {
    // Debug: Log the node data structure
    console.log(`📋 Node data structure:`, JSON.stringify(nodeData, null, 2));
    
    // Get repository from node configuration - try multiple possible locations
    // Support both 'repository' (new) and 'repo' (old) for backward compatibility
    const repository = nodeData?.config?.repository 
                    || nodeData?.config?.repo
                    || nodeData?.repository 
                    || nodeData?.repo
                    || nodeData?.data?.config?.repository
                    || nodeData?.data?.config?.repo
                    || nodeData?.data?.repository
                    || nodeData?.data?.repo;
    
    if (!repository) {
      console.error(`❌ Repository not found in nodeData:`, nodeData);
      throw new Error("Repository not specified in node configuration. Please configure the GitHub Issue node with a repository.");
    }

    console.log(`📋 Creating issue on repository: ${repository}`);
    console.log(`📊 Including detailed analysis from ${nodeResults.length} nodes`);
    
    // Use the new createSecurityReportIssue function
    const result = await createSecurityReportIssue(userId, repository, scanData, nodeResults);
    
    console.log(`✅ GitHub issue created: ${result.issue.url}`);
    return {
      created: true,
      issueNumber: result.issue.number,
      url: result.issue.url,
      title: result.issue.title,
      repository: repository,
      totalFindings: Object.values(scanData).reduce((total, scan) => total + (scan.total_findings || 0), 0),
    };

  } catch (error) {
    console.error(`❌ GitHub issue error:`, error.message);
    return {
      created: false,
      error: error.message,
    };
  }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(nodeData, scanData) {
  console.log(`💬 Sending Slack notification...`);
  try {
    const webhookUrl = nodeData?.webhookUrl;
    if (!webhookUrl) {
      throw new Error("Slack webhook URL not configured");
    }

    const message = {
      text: "🔒 Security Scan Report",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔒 Security Scan Report",
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Date:*\n${new Date().toLocaleDateString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Tools Run:*\n${Object.keys(scanData).join(", ")}`,
            },
          ],
        },
      ],
    };

    await axios.post(webhookUrl, message);
    console.log(`✅ Slack notification sent`);
    return {
      sent: true,
    };

  } catch (error) {
    console.error(`Slack error:`, error.message);
    return {
      sent: false,
      error: error.message,
    };
  }
}

/**
 * Calculate findings from execution results
 */
function calculateFindings(results) {
  const findings = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  // Count findings from various scan results
  Object.values(results.scanData).forEach(scanData => {
    // Prefer explicit total_findings if provided by the tool/backend
    if (scanData && typeof scanData.total_findings === 'number') {
      findings.total += scanData.total_findings;
    } else {
      // Fallback: parse common nested structures
      // Nmap: response may include { nmap_scan: { open_ports: [...] } }
      const nmapPorts = scanData?.nmap_scan?.open_ports || scanData?.nmap?.open_ports;
      if (Array.isArray(nmapPorts) && nmapPorts.length > 0) {
        findings.total += nmapPorts.length;
      }

      // SQLMap: vulnerabilities may be under sqlmap_scan.vulnerabilities or vulnerabilities
      const sqlmapVulns = scanData?.sqlmap_scan?.vulnerabilities || scanData?.vulnerabilities;
      if (Array.isArray(sqlmapVulns) && sqlmapVulns.length > 0) {
        findings.total += sqlmapVulns.length;
      }
    }

    // Count structured vulnerability objects if present
    if (scanData && Array.isArray(scanData.vulnerabilities) && scanData.vulnerabilities.length > 0) {
      scanData.vulnerabilities.forEach(vuln => {
        findings.total++;
        // handle severity when vuln is an object
        if (vuln && typeof vuln === 'object') {
          const sev = (vuln.severity || vuln.level || '').toString().toLowerCase();
          if (sev === 'high') findings.high++;
          else if (sev === 'medium') findings.medium++;
          else findings.low++;
        } else if (typeof vuln === 'string') {
          // best-effort severity detection from text
          const lower = vuln.toLowerCase();
          if (lower.includes('high')) findings.high++;
          else if (lower.includes('medium')) findings.medium++;
          else findings.low++;
        } else {
          findings.low++;
        }
      });
    }
  });

  return findings;
}

/**
 * Generate intelligence for discovered ports
 * @param {Array} ports - Array of port objects from Nmap
 * @returns {Array} - Array of port intelligence objects
 */
function generatePortIntelligence(ports) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return [];
  }

  const portIntelligence = ports.map(port => {
    const portNumber = port.port || port.portNumber;
    const service = (port.service || '').toLowerCase();
    const version = port.version || '';
    
    // Initialize intelligence object
    const intelligence = {
      port: portNumber,
      protocol: port.protocol || 'tcp',
      service: port.service || 'unknown',
      version: version,
      state: port.state || 'open',
      vulnerabilities: [],
      commonIssues: [],
      attackVectors: [],
      remediationSteps: [],
      riskScore: 0
    };

    // Port-specific intelligence
    switch (portNumber) {
      case 21: // FTP
        intelligence.riskScore = 70;
        intelligence.commonIssues = [
          'FTP transmits credentials in plaintext',
          'Anonymous FTP access may be enabled',
          'Directory traversal vulnerabilities common'
        ];
        intelligence.attackVectors = ['Credential sniffing', 'Brute force', 'Anonymous access exploitation'];
        intelligence.remediationSteps = [
          'Use SFTP or FTPS instead of FTP',
          'Disable anonymous FTP access',
          'Implement strong authentication',
          'Use firewall rules to restrict access'
        ];
        break;

      case 22: // SSH
        intelligence.riskScore = 30;
        intelligence.commonIssues = [
          'Outdated SSH versions may have known vulnerabilities',
          'Weak encryption algorithms enabled',
          'Password authentication enabled'
        ];
        intelligence.attackVectors = ['Brute force attacks', 'SSH key compromise', 'Man-in-the-middle attacks'];
        intelligence.remediationSteps = [
          'Update to latest SSH version',
          'Disable password authentication, use key-based auth',
          'Use strong encryption algorithms only',
          'Implement fail2ban or similar protection',
          'Change default port if possible'
        ];
        break;

      case 23: // Telnet
        intelligence.riskScore = 95;
        intelligence.commonIssues = [
          'Telnet transmits all data including passwords in plaintext',
          'No encryption of any kind',
          'Highly vulnerable to eavesdropping'
        ];
        intelligence.attackVectors = ['Credential sniffing', 'Session hijacking', 'Man-in-the-middle'];
        intelligence.remediationSteps = [
          'Disable Telnet immediately',
          'Replace with SSH',
          'If legacy systems require it, use only on isolated networks'
        ];
        break;

      case 25: // SMTP
        intelligence.riskScore = 60;
        intelligence.commonIssues = [
          'Open relay configuration',
          'Lack of SPF/DKIM/DMARC',
          'Weak authentication'
        ];
        intelligence.attackVectors = ['Email spoofing', 'Spam relay', 'Credential theft'];
        intelligence.remediationSteps = [
          'Ensure relay is properly configured',
          'Implement SPF, DKIM, and DMARC',
          'Use TLS for all connections',
          'Implement rate limiting'
        ];
        break;

      case 80: // HTTP
        intelligence.riskScore = 50;
        intelligence.commonIssues = [
          'Unencrypted HTTP traffic',
          'No SSL/TLS protection',
          'Potential for various web vulnerabilities'
        ];
        intelligence.attackVectors = ['Man-in-the-middle', 'Session hijacking', 'XSS', 'CSRF', 'SQL injection'];
        intelligence.remediationSteps = [
          'Implement HTTPS and redirect all HTTP traffic',
          'Use HSTS header',
          'Keep web server software updated',
          'Implement web application firewall (WAF)'
        ];
        break;

      case 443: // HTTPS
        intelligence.riskScore = 25;
        intelligence.commonIssues = [
          'Weak SSL/TLS cipher suites',
          'Expired or invalid certificates',
          'SSL/TLS vulnerabilities (Heartbleed, POODLE, etc.)'
        ];
        intelligence.attackVectors = ['SSL stripping', 'Certificate-based attacks', 'Downgrade attacks'];
        intelligence.remediationSteps = [
          'Use TLS 1.2 or higher only',
          'Disable weak cipher suites',
          'Implement HSTS with preload',
          'Use valid, properly configured certificates',
          'Implement certificate pinning where appropriate'
        ];
        break;

      case 3306: // MySQL
        intelligence.riskScore = 85;
        intelligence.commonIssues = [
          'Database exposed to internet',
          'Default credentials may be in use',
          'Lack of encryption for connections'
        ];
        intelligence.attackVectors = ['SQL injection', 'Brute force', 'Data exfiltration'];
        intelligence.remediationSteps = [
          'Never expose database directly to internet',
          'Use firewall rules to restrict access',
          'Change default credentials',
          'Use SSL/TLS for database connections',
          'Implement strong authentication'
        ];
        break;

      case 3389: // RDP
        intelligence.riskScore = 90;
        intelligence.commonIssues = [
          'RDP exposed to internet',
          'Vulnerable to ransomware attacks',
          'Weak password policies'
        ];
        intelligence.attackVectors = ['BlueKeep and other RDP vulnerabilities', 'Brute force', 'Credential stuffing'];
        intelligence.remediationSteps = [
          'Never expose RDP directly to internet',
          'Use VPN for remote access',
          'Enable Network Level Authentication (NLA)',
          'Implement account lockout policies',
          'Keep Windows updated',
          'Use strong passwords or certificate-based authentication'
        ];
        break;

      case 5432: // PostgreSQL
        intelligence.riskScore = 85;
        intelligence.commonIssues = [
          'Database exposed to internet',
          'Weak authentication configuration',
          'Default port being used'
        ];
        intelligence.attackVectors = ['SQL injection', 'Brute force', 'Data exfiltration'];
        intelligence.remediationSteps = [
          'Restrict database access to localhost or trusted IPs',
          'Use strong authentication (md5 or scram-sha-256)',
          'Enable SSL connections',
          'Change default port',
          'Regular security updates'
        ];
        break;

      case 6379: // Redis
        intelligence.riskScore = 95;
        intelligence.commonIssues = [
          'Redis exposed without authentication',
          'No password protection by default',
          'Can be used for RCE attacks'
        ];
        intelligence.attackVectors = ['Unauthorized data access', 'Data manipulation', 'Remote code execution'];
        intelligence.remediationSteps = [
          'Enable Redis authentication (requirepass)',
          'Bind to localhost only',
          'Use firewall rules',
          'Disable dangerous commands',
          'Keep Redis updated'
        ];
        break;

      case 8080: // HTTP Alt
      case 8000:
      case 8888:
        intelligence.riskScore = 55;
        intelligence.commonIssues = [
          'Development server exposed to production',
          'Debug mode may be enabled',
          'Unencrypted HTTP traffic'
        ];
        intelligence.attackVectors = ['Web application vulnerabilities', 'Information disclosure', 'Unauthorized access'];
        intelligence.remediationSteps = [
          'Use proper production servers instead of development servers',
          'Implement HTTPS',
          'Disable debug mode',
          'Implement proper authentication and authorization'
        ];
        break;

      case 27017: // MongoDB
        intelligence.riskScore = 90;
        intelligence.commonIssues = [
          'MongoDB exposed without authentication',
          'Default configuration may lack security',
          'Data exfiltration risk'
        ];
        intelligence.attackVectors = ['Unauthorized database access', 'Data theft', 'Ransomware'];
        intelligence.remediationSteps = [
          'Enable authentication',
          'Bind to localhost only',
          'Use firewall rules to restrict access',
          'Enable SSL/TLS',
          'Regular backups'
        ];
        break;

      default:
        // Generic port intelligence
        if (service.includes('http')) {
          intelligence.riskScore = 45;
          intelligence.commonIssues = ['Web service vulnerabilities', 'Potential information disclosure'];
          intelligence.attackVectors = ['Web-based attacks', 'Brute force'];
          intelligence.remediationSteps = ['Implement HTTPS', 'Keep software updated', 'Use WAF'];
        } else if (service.includes('database') || service.includes('sql') || service.includes('db')) {
          intelligence.riskScore = 85;
          intelligence.commonIssues = ['Database exposed to network'];
          intelligence.attackVectors = ['SQL injection', 'Data exfiltration'];
          intelligence.remediationSteps = ['Restrict access', 'Use strong authentication', 'Enable encryption'];
        } else if (portNumber > 1024) {
          intelligence.riskScore = 40;
          intelligence.commonIssues = ['Unknown service on high port'];
          intelligence.attackVectors = ['Service-specific vulnerabilities'];
          intelligence.remediationSteps = ['Identify the service', 'Keep updated', 'Restrict access if unnecessary'];
        } else {
          intelligence.riskScore = 50;
          intelligence.commonIssues = ['Exposed service'];
          intelligence.attackVectors = ['Service-specific attacks'];
          intelligence.remediationSteps = ['Review if service is necessary', 'Keep updated', 'Implement security measures'];
        }
    }

    return intelligence;
  });

  return portIntelligence;
}

/**
 * Generate intelligence for discovered directories
 * @param {Array} directories - Array of directory objects from Gobuster
 * @param {Array} files - Array of file objects from Gobuster
 * @returns {Array} - Array of directory intelligence objects
 */
function generateDirectoryIntelligence(directories, files) {
  const allPaths = [
    ...(Array.isArray(directories) ? directories : []),
    ...(Array.isArray(files) ? files : [])
  ];

  if (allPaths.length === 0) {
    return [];
  }

  const intelligence = allPaths.map(item => {
    const path = item.path || item;
    const statusCode = item.status || item.statusCode || 200;
    const pathLower = path.toLowerCase();
    
    // Initialize intelligence object
    const intel = {
      path: path,
      statusCode: statusCode,
      category: 'normal',
      sensitivityLevel: 'low',
      risks: [],
      recommendations: [],
      technologyIndicators: [],
      riskScore: 10
    };

    // Analyze path for sensitive patterns
    if (pathLower.includes('admin') || pathLower.includes('administrator')) {
      intel.category = 'admin';
      intel.sensitivityLevel = 'critical';
      intel.riskScore = 95;
      intel.risks = [
        'Administrative interface exposed',
        'Potential unauthorized access',
        'Credential brute-forcing target',
        'Privilege escalation opportunities'
      ];
      intel.recommendations = [
        'Restrict admin panel access by IP',
        'Implement multi-factor authentication',
        'Use non-standard admin paths',
        'Monitor access logs closely',
        'Implement rate limiting'
      ];
    } else if (pathLower.includes('config') || pathLower.includes('configuration') || pathLower.includes('.env')) {
      intel.category = 'config';
      intel.sensitivityLevel = 'critical';
      intel.riskScore = 90;
      intel.risks = [
        'Configuration files exposed',
        'Potential credential disclosure',
        'API keys and secrets at risk',
        'Database connection strings exposed'
      ];
      intel.recommendations = [
        'Move configuration files outside web root',
        'Block access via .htaccess or web server config',
        'Use environment variables instead',
        'Implement proper file permissions'
      ];
    } else if (pathLower.includes('backup') || pathLower.includes('bak') || pathLower.includes('.zip') || pathLower.includes('.tar') || pathLower.includes('.sql')) {
      intel.category = 'backup';
      intel.sensitivityLevel = 'high';
      intel.riskScore = 85;
      intel.risks = [
        'Backup files accessible',
        'Source code disclosure possible',
        'Database dumps may be exposed',
        'Sensitive data leakage'
      ];
      intel.recommendations = [
        'Remove backup files from web-accessible locations',
        'Use secure backup storage',
        'Implement proper access controls',
        'Encrypt backup files'
      ];
    } else if (pathLower.includes('upload') || pathLower.includes('uploads') || pathLower.includes('files')) {
      intel.category = 'upload';
      intel.sensitivityLevel = 'high';
      intel.riskScore = 75;
      intel.risks = [
        'File upload functionality exposed',
        'Potential for malicious file uploads',
        'Arbitrary file execution risk',
        'Directory traversal possibilities'
      ];
      intel.recommendations = [
        'Validate all file uploads',
        'Restrict file types and sizes',
        'Store uploads outside web root',
        'Scan uploaded files for malware',
        'Implement proper access controls'
      ];
    } else if (pathLower.includes('api') || pathLower.includes('rest') || pathLower.includes('graphql')) {
      intel.category = 'api';
      intel.sensitivityLevel = 'medium';
      intel.riskScore = 60;
      intel.risks = [
        'API endpoints exposed',
        'Potential for data exfiltration',
        'Authentication bypass possibilities',
        'Rate limiting may be absent'
      ];
      intel.recommendations = [
        'Implement API authentication',
        'Use rate limiting',
        'Validate all inputs',
        'Implement proper authorization',
        'Use API versioning'
      ];
    } else if (pathLower.includes('test') || pathLower.includes('dev') || pathLower.includes('debug') || pathLower.includes('staging')) {
      intel.category = 'infoDisclosure';
      intel.sensitivityLevel = 'medium';
      intel.riskScore = 65;
      intel.risks = [
        'Development/test environment exposed',
        'Debug information leakage',
        'Less secure than production',
        'May contain verbose error messages'
      ];
      intel.recommendations = [
        'Remove test/dev directories from production',
        'Disable debug mode',
        'Implement proper environment separation',
        'Use access controls'
      ];
    } else if (pathLower.includes('.git') || pathLower.includes('.svn') || pathLower.includes('.hg')) {
      intel.category = 'infoDisclosure';
      intel.sensitivityLevel = 'critical';
      intel.riskScore = 95;
      intel.risks = [
        'Version control directory exposed',
        'Complete source code disclosure',
        'Commit history accessible',
        'Credentials in commit history risk'
      ];
      intel.recommendations = [
        'Remove .git directory from web root immediately',
        'Block access via web server configuration',
        'Review commit history for exposed secrets',
        'Rotate any exposed credentials'
      ];
    } else if (pathLower.includes('database') || pathLower.includes('db') || pathLower.includes('mysql') || pathLower.includes('postgres')) {
      intel.category = 'infoDisclosure';
      intel.sensitivityLevel = 'critical';
      intel.riskScore = 90;
      intel.risks = [
        'Database-related paths exposed',
        'Potential data access',
        'SQL injection targets',
        'Credential exposure risk'
      ];
      intel.recommendations = [
        'Restrict database access paths',
        'Use parameterized queries',
        'Implement strong authentication',
        'Regular security audits'
      ];
    } else if (pathLower.includes('log') || pathLower.includes('logs')) {
      intel.category = 'infoDisclosure';
      intel.sensitivityLevel = 'medium';
      intel.riskScore = 55;
      intel.risks = [
        'Log files accessible',
        'Sensitive information in logs',
        'System information disclosure',
        'User activity tracking'
      ];
      intel.recommendations = [
        'Move logs outside web root',
        'Sanitize log content',
        'Implement log rotation',
        'Restrict log access'
      ];
    } else if (pathLower.includes('phpinfo') || pathLower.includes('info.php')) {
      intel.category = 'infoDisclosure';
      intel.sensitivityLevel = 'high';
      intel.riskScore = 80;
      intel.risks = [
        'PHP configuration exposed',
        'Server information disclosure',
        'Installed modules visible',
        'Potential attack surface mapping'
      ];
      intel.recommendations = [
        'Remove phpinfo files immediately',
        'Never deploy debug files to production',
        'Implement file access restrictions'
      ];
    }

    // Detect technology indicators
    if (pathLower.includes('wp-') || pathLower.includes('wordpress')) {
      intel.technologyIndicators.push('WordPress');
    }
    if (pathLower.includes('drupal')) {
      intel.technologyIndicators.push('Drupal');
    }
    if (pathLower.includes('joomla')) {
      intel.technologyIndicators.push('Joomla');
    }
    if (pathLower.includes('php')) {
      intel.technologyIndicators.push('PHP');
    }
    if (pathLower.includes('aspx') || pathLower.includes('asp')) {
      intel.technologyIndicators.push('ASP.NET');
    }
    if (pathLower.includes('jsp')) {
      intel.technologyIndicators.push('Java/JSP');
    }
    if (pathLower.includes('node') || pathLower.includes('npm')) {
      intel.technologyIndicators.push('Node.js');
    }
    if (pathLower.includes('api') || pathLower.includes('rest')) {
      intel.technologyIndicators.push('REST API');
    }
    if (pathLower.includes('graphql')) {
      intel.technologyIndicators.push('GraphQL');
    }

    return intel;
  });

  return intelligence;
}

module.exports = {
  executeWorkflow,
  generatePortIntelligence,
  generateDirectoryIntelligence,
};