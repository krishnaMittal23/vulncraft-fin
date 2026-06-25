#!/bin/bash

# OWASP Integration Validation Script
# This script validates the complete OWASP integration

echo "🛡️ VulnCraft OWASP Integration Validation"
echo "========================================"

# Check Docker setup
echo ""
echo "📦 Checking Docker Configuration..."
if [ -f "services/docker-compose.yml" ]; then
    echo "✅ Docker Compose configuration found"
    
    # Check if OWASP ZAP service is defined
    if grep -q "owasp-zap:" services/docker-compose.yml; then
        echo "✅ OWASP ZAP service configured"
    else
        echo "❌ OWASP ZAP service not found in docker-compose.yml"
    fi
    
    # Check network configuration
    if grep -q "vulncraft-network:" services/docker-compose.yml; then
        echo "✅ Network configuration found"
    else
        echo "❌ Network configuration missing"
    fi
else
    echo "❌ Docker Compose configuration not found"
fi

# Check Python dependencies
echo ""
echo "🐍 Checking Python Dependencies..."
if [ -f "services/requirements.txt" ]; then
    echo "✅ Requirements file found"
    
    if grep -q "zapv2" services/requirements.txt; then
        echo "✅ ZAP Python API dependency found"
    else
        echo "❌ ZAP Python API dependency missing"
    fi
    
    if grep -q "requests" services/requirements.txt; then
        echo "✅ Requests library found"
    else
        echo "❌ Requests library missing"
    fi
else
    echo "❌ Requirements file not found"
fi

# Check OWASP scanner service
echo ""
echo "🔍 Checking OWASP Scanner Service..."
if [ -f "services/Gobuster/services/owasp_scanner.py" ]; then
    echo "✅ OWASP scanner service found"
    
    # Check key classes and methods
    if grep -q "class OWASPScanner" services/Gobuster/services/owasp_scanner.py; then
        echo "✅ OWASPScanner class found"
    else
        echo "❌ OWASPScanner class missing"
    fi
    
    if grep -q "def scan_target" services/Gobuster/services/owasp_scanner.py; then
        echo "✅ scan_target method found"
    else
        echo "❌ scan_target method missing"
    fi
else
    echo "❌ OWASP scanner service not found"
fi

# Check Django views
echo ""
echo "🌐 Checking Django Views..."
if [ -f "services/Gobuster/views.py" ]; then
    echo "✅ Django views file found"
    
    if grep -q "owasp_scan" services/Gobuster/views.py; then
        echo "✅ OWASP scan endpoint found"
    else
        echo "❌ OWASP scan endpoint missing"
    fi
    
    if grep -q "from .services.owasp_scanner import OWASPScanner" services/Gobuster/views.py; then
        echo "✅ OWASP scanner import found"
    else
        echo "❌ OWASP scanner import missing"
    fi
else
    echo "❌ Django views file not found"
fi

# Check URL routing
echo ""
echo "🔗 Checking URL Routing..."
if [ -f "services/Gobuster/urls.py" ]; then
    echo "✅ URLs file found"
    
    if grep -q "owasp/" services/Gobuster/urls.py; then
        echo "✅ OWASP endpoints configured"
    else
        echo "❌ OWASP endpoints not configured"
    fi
else
    echo "❌ URLs file not found"
fi

# Check Backend Node.js integration
echo ""
echo "⚙️ Checking Backend Node.js Integration..."
if [ -f "backend/src/services/workflowExecutionServe.js" ]; then
    echo "✅ Workflow execution service found"
    
    if grep -q "runOWASPZap" backend/src/services/workflowExecutionServe.js; then
        echo "✅ OWASP ZAP execution function found"
    else
        echo "❌ OWASP ZAP execution function missing"
    fi
    
    if grep -q "generateOWASPIntelligence" backend/src/services/workflowExecutionServe.js; then
        echo "✅ OWASP intelligence generation found"
    else
        echo "❌ OWASP intelligence generation missing"
    fi
else
    echo "❌ Workflow execution service not found"
fi

# Check report analysis
echo ""
echo "📊 Checking Report Analysis..."
if [ -f "backend/src/services/reportAnalysisServe.js" ]; then
    echo "✅ Report analysis service found"
    
    if grep -q "analyzeOWASPZapResults" backend/src/services/reportAnalysisServe.js; then
        echo "✅ OWASP ZAP analysis function found"
    else
        echo "❌ OWASP ZAP analysis function missing"
    fi
    
    if grep -q "analyzeOWASPComprehensiveResults" backend/src/services/reportAnalysisServe.js; then
        echo "✅ OWASP comprehensive analysis function found"
    else
        echo "❌ OWASP comprehensive analysis function missing"
    fi
else
    echo "❌ Report analysis service not found"
fi

# Check GitHub integration
echo ""
echo "🐙 Checking GitHub Integration..."
if [ -f "backend/src/services/githubServe.js" ]; then
    echo "✅ GitHub service found"
    
    if grep -q "OWASP Security Analysis" backend/src/services/githubServe.js; then
        echo "✅ OWASP reporting in GitHub issues found"
    else
        echo "❌ OWASP reporting in GitHub issues missing"
    fi
else
    echo "❌ GitHub service not found"
fi

# Check Frontend components
echo ""
echo "🎨 Checking Frontend Components..."

# Check node types
if [ -f "frontend/src/types/workflow.tsx" ]; then
    echo "✅ Workflow types found"
    
    if grep -q "owasp-zap" frontend/src/types/workflow.tsx; then
        echo "✅ OWASP node types defined"
    else
        echo "❌ OWASP node types missing"
    fi
else
    echo "❌ Workflow types not found"
fi

# Check workflow builder
if [ -f "frontend/src/pages/Workflowbuilder.tsx" ]; then
    echo "✅ Workflow builder found"
    
    if grep -q "OWASP_NODE_TYPES" frontend/src/pages/Workflowbuilder.tsx; then
        echo "✅ OWASP node configuration found"
    else
        echo "❌ OWASP node configuration missing"
    fi
else
    echo "❌ Workflow builder not found"
fi

# Check OWASP configuration dialog
if [ -f "frontend/src/components/workflowbuilder/OWASPNodeConfigDialog.tsx" ]; then
    echo "✅ OWASP configuration dialog found"
else
    echo "❌ OWASP configuration dialog not found"
fi

# Check WorkflowNode component
if [ -f "frontend/src/components/workflowbuilder/WorkflowNode.tsx" ]; then
    echo "✅ Workflow node component found"
    
    if grep -q "owasp-zap" frontend/src/components/workflowbuilder/WorkflowNode.tsx; then
        echo "✅ OWASP node rendering configured"
    else
        echo "❌ OWASP node rendering missing"
    fi
else
    echo "❌ Workflow node component not found"
fi

echo ""
echo "🧪 Integration Test Recommendations:"
echo "=================================="
echo "1. Start services: cd services && docker-compose up -d"
echo "2. Verify ZAP container: docker ps | grep owasp-zap"
echo "3. Test ZAP API: curl http://localhost:8080/JSON/core/view/version/"
echo "4. Start Node.js backend: cd backend && npm run dev"
echo "5. Start React frontend: cd frontend && npm run dev"
echo "6. Create test workflow with OWASP nodes"
echo "7. Execute workflow and verify OWASP scan results"

echo ""
echo "🔧 Manual Verification Steps:"
echo "============================="
echo "1. Check ZAP container logs: docker logs vulncraft-owasp-zap"
echo "2. Verify network connectivity between services"
echo "3. Test OWASP endpoints with Postman/curl"
echo "4. Create workflow with OWASP ZAP node"
echo "5. Verify OWASP results in reports and GitHub issues"

echo ""
echo "Validation complete! 🎉"