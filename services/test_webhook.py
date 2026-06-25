#!/usr/bin/env python3
"""
Test script to verify GitHub webhook integration is working
"""
import hmac
import hashlib
import requests
import json
import sys
import os

WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
WEBHOOK_URL = "http://localhost:8000/api/github/webhook/"

def sign_payload(payload_json):
    """Generate GitHub webhook signature"""
    return hmac.new(
        WEBHOOK_SECRET.encode(),
        payload_json.encode(),
        hashlib.sha256
    ).hexdigest()

def test_ping():
    """Test 1: Ping webhook"""
    print("\n🧪 Test 1: Ping Webhook")
    print("=" * 50)
    
    payload = {"zen": "Testing webhook", "hook_id": 123}
    payload_json = json.dumps(payload)
    signature = sign_payload(payload_json)
    
    headers = {
        "Content-Type": "application/json",
        "X-GitHub-Event": "ping",
        "X-Hub-Signature-256": f"sha256={signature}"
    }
    
    response = requests.post(WEBHOOK_URL, data=payload_json, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    return response.status_code == 200

def test_pr_event():
    """Test 2: Simulate PR opened event"""
    print("\n🧪 Test 2: Pull Request Event")
    print("=" * 50)
    
    payload = {
        "action": "opened",
        "pull_request": {
            "number": 1,
            "title": "Test PR",
            "head": {
                "ref": "test-branch",
                "sha": "abc123"
            }
        },
        "repository": {
            "id": 1091866800,  # Your actual repo ID
            "full_name": "CoderFleet/VulnCraft",
            "name": "VulnCraft",
            "owner": {
                "login": "CoderFleet"
            }
        }
    }
    
    payload_json = json.dumps(payload)
    signature = sign_payload(payload_json)
    
    headers = {
        "Content-Type": "application/json",
        "X-GitHub-Event": "pull_request",
        "X-Hub-Signature-256": f"sha256={signature}"
    }
    
    response = requests.post(WEBHOOK_URL, data=payload_json, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    return response.status_code == 200

def test_deployment():
    """Test 3: Simulate deployment status event"""
    print("\n🧪 Test 3: Deployment Status Event")
    print("=" * 50)
    
    payload = {
        "deployment": {
            "ref": "test-branch"
        },
        "deployment_status": {
            "state": "success",
            "environment_url": "https://test-branch--mysite.netlify.app"
        },
        "repository": {
            "id": 1091866800,
            "full_name": "CoderFleet/VulnCraft"
        }
    }
    
    payload_json = json.dumps(payload)
    signature = sign_payload(payload_json)
    
    headers = {
        "Content-Type": "application/json",
        "X-GitHub-Event": "deployment_status",
        "X-Hub-Signature-256": f"sha256={signature}"
    }
    
    response = requests.post(WEBHOOK_URL, data=payload_json, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    return response.status_code == 200

def main():
    print("🔍 VulnCraft GitHub Webhook Integration Tests")
    print("=" * 50)
    
    results = []
    
    # Run tests
    results.append(("Ping", test_ping()))
    results.append(("PR Event", test_pr_event()))
    results.append(("Deployment", test_deployment()))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print("=" * 50)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(result[1] for result in results)
    print("\n" + ("✅ All tests passed!" if all_passed else "❌ Some tests failed"))
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
