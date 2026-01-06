/**
 * GitHub OAuth Configuration Validator
 * Checks if GitHub credentials and callback URL are correctly configured
 * Usage: node src/utils/validateGitHubConfig.js
 */

require("dotenv").config();
const axios = require("axios");

async function validateGitHubConfig() {
  console.log("🔍 GitHub OAuth Configuration Validator\n");
  console.log("=" .repeat(50));

  // Check 1: Environment variables
  console.log("\n1️⃣  Checking environment variables:");
  console.log(`   GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? "✅ Set" : "❌ Missing"}`);
  console.log(`   GITHUB_CLIENT_SECRET: ${process.env.GITHUB_CLIENT_SECRET ? "✅ Set" : "❌ Missing"}`);
  console.log(`   BACKEND_URL: ${process.env.BACKEND_URL || "⚠️  Not set (using localhost)"}`);
  console.log(`   GITHUB_CALLBACK_URL: ${process.env.GITHUB_CALLBACK_URL || "⚠️  Not set (auto-generating)"}`);
  console.log(`   PORT: ${process.env.PORT || "3000"}`);

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.log("\n❌ ERROR: GitHub Client ID or Client Secret is missing!");
    console.log("   Please add them to your .env file:");
    console.log("   GITHUB_CLIENT_ID=your_client_id");
    console.log("   GITHUB_CLIENT_SECRET=your_client_secret");
    return;
  }

  // Check 2: Callback URL construction
  const getCallbackURL = () => {
    if (process.env.GITHUB_CALLBACK_URL) {
      return process.env.GITHUB_CALLBACK_URL;
    }
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${backendUrl}/api/auth/github/callback`;
  };

  const callbackURL = getCallbackURL();
  console.log("\n2️⃣  Callback URL:");
  console.log(`   ${callbackURL}`);

  // Check 3: Test GitHub OAuth endpoint
  console.log("\n3️⃣  Testing GitHub API connectivity:");
  try {
    const response = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${process.env.GITHUB_CLIENT_SECRET}`,
        "User-Agent": "VulnCraft-OAuth-Validator",
      },
      timeout: 5000,
    });
    console.log("   ✅ GitHub API is reachable");
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(
        "   ⚠️  GitHub token might be invalid (but API is reachable)"
      );
    } else if (error.code === "ECONNREFUSED") {
      console.log("   ❌ Cannot reach GitHub API (network issue?)");
    } else {
      console.log(`   ⚠️  GitHub API check: ${error.message}`);
    }
  }

  // Check 4: Verify credentials format
  console.log("\n4️⃣  Credentials format check:");
  const clientIdValid = /^[a-f0-9]{20}$/i.test(process.env.GITHUB_CLIENT_ID);
  const clientSecretValid = /^[a-f0-9]{40}$/i.test(process.env.GITHUB_CLIENT_SECRET);
  
  console.log(`   Client ID format: ${clientIdValid ? "✅ Valid" : "⚠️  Unexpected format"}`);
  console.log(`   Client Secret format: ${clientSecretValid ? "✅ Valid" : "⚠️  Unexpected format"}`);

  // Check 5: Recommendations
  console.log("\n5️⃣  What to check in GitHub OAuth App Settings:");
  console.log("   1. Go to: https://github.com/settings/developers");
  console.log("   2. Select your OAuth App");
  console.log("   3. Check Authorization callback URL is set to:");
  console.log(`      ${callbackURL}`);
  console.log("\n   ⚠️  The callback URL must match EXACTLY (including http/https and ports)");

  // Check 6: Common issues
  console.log("\n6️⃣  Common issues and fixes:");
  console.log("   • Callback URL mismatch → Update GitHub app settings or .env");
  console.log("   • Using http://localhost in production → Set BACKEND_URL in .env");
  console.log("   • Using https in GitHub but http in app → Ensure protocol matches");
  console.log("   • Old credentials → Generate new Client ID/Secret in GitHub settings");

  console.log("\n" + "=".repeat(50));
  console.log("ℹ️  If you see ❌ errors above, fix them before testing OAuth\n");
}

validateGitHubConfig();
