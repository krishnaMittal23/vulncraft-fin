#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  VulnCraft GitHub Integration Test Suite  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""

# Test 1: Check if webhook endpoint is accessible
echo -e "${YELLOW}Test 1: Webhook Endpoint${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/github/webhook/test/)
if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ Webhook endpoint is accessible${NC}"
else
    echo -e "${RED}✗ Webhook endpoint failed (HTTP $response)${NC}"
fi
echo ""

# Test 2: Check if GitHub token is set
echo -e "${YELLOW}Test 2: Environment Variables${NC}"
if [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}✗ GITHUB_TOKEN not set${NC}"
else
    echo -e "${GREEN}✓ GITHUB_TOKEN is set${NC}"
fi

if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    echo -e "${RED}✗ GITHUB_WEBHOOK_SECRET not set${NC}"
else
    echo -e "${GREEN}✓ GITHUB_WEBHOOK_SECRET is set${NC}"
fi
echo ""

# Test 3: Check database migrations
echo -e "${YELLOW}Test 3: Database Migrations${NC}"
docker-compose exec -T web python manage.py showmigrations github_integration 2>/dev/null | grep -q "\[X\]"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations are applied${NC}"
else
    echo -e "${RED}✗ Migrations need to be applied${NC}"
    echo "Run: docker-compose exec web python manage.py migrate"
fi
echo ""

# Test 4: Check if admin is accessible
echo -e "${YELLOW}Test 4: Django Admin${NC}"
admin_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/admin/)
if [ "$admin_response" == "200" ] || [ "$admin_response" == "302" ]; then
    echo -e "${GREEN}✓ Django admin is accessible${NC}"
else
    echo -e "${RED}✗ Django admin failed (HTTP $admin_response)${NC}"
fi
echo ""

# Test 5: Check if required packages are installed
echo -e "${YELLOW}Test 5: Required Packages${NC}"
docker-compose exec -T web python -c "import requests; import github" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Required packages are installed${NC}"
else
    echo -e "${RED}✗ Some packages are missing${NC}"
    echo "Run: docker-compose exec web pip install -r requirements.txt"
fi
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}Test suite completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure GitHub webhook at: https://github.com/your-repo/settings/hooks"
echo "2. Add monitored repositories at: http://localhost:8000/admin/"
echo "3. Create a test PR to see it in action"
echo ""
echo "For detailed setup instructions, see: GITHUB_PR_INTEGRATION.md"
