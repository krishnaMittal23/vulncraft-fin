const axios = require("axios");
const crypto = require("crypto");
const authService = require("../services/authServe");
const { signToken } = require("../lib/token");
const { FRONTEND_URL } = require("../lib/constant");

const GITHUB_SCOPE = "user:email repo";

/**
 * Resolve the OAuth callback URL (must match the GitHub OAuth App config).
 */
const getCallbackURL = () => {
  if (process.env.GITHUB_CALLBACK_URL) return process.env.GITHUB_CALLBACK_URL;
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT}`;
  return `${backendUrl}/api/auth/github/callback`;
};

/**
 * Redirect the user to GitHub's OAuth authorize page.
 * @route GET /api/auth/github
 */
exports.githubAuth = (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("gh_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000,
  });
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: getCallbackURL(),
    scope: GITHUB_SCOPE,
    allow_signup: "true",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
};

/**
 * Handle the GitHub OAuth callback: exchange code for a token, load the
 * user's profile, upsert the user, then redirect to the frontend with a JWT.
 * @route GET /api/auth/github/callback
 */
exports.githubAuthCallback = async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies?.gh_oauth_state;

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/?error=missing_code`);
  }

  if (!state || !savedState || state !== savedState) {
    return res.redirect(`${FRONTEND_URL}/?error=invalid_state`);
  }
  res.clearCookie("gh_oauth_state");

  try {
    // 1. Exchange the authorization code for an access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: getCallbackURL(),
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      return res.redirect(`${FRONTEND_URL}/?error=token_exchange_failed`);
    }

    // 2. Fetch the GitHub user profile
    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    };
    const { data: ghUser } = await axios.get("https://api.github.com/user", {
      headers: ghHeaders,
    });

    // 3. Resolve a primary email (may be private on the profile)
    let email = ghUser.email;
    if (!email) {
      try {
        const { data: emails } = await axios.get(
          "https://api.github.com/user/emails",
          { headers: ghHeaders }
        );
        email =
          emails.find((e) => e.primary && e.verified)?.email ||
          emails[0]?.email;
      } catch {
        // emails scope may be unavailable; fall through to placeholder
      }
    }
    email = email || `${ghUser.login}@github-user.noreply`;

    // 4. Upsert the user and issue a JWT
    const user = await authService.upsertGithubUser({
      githubId: ghUser.id.toString(),
      username: ghUser.login,
      email,
      avatar: ghUser.avatar_url || "",
      accessToken,
    });

    const token = signToken(user);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error("GitHub OAuth error:", error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}/?error=auth_failed`);
  }
};

/**
 * Get the current authenticated user (from the JWT).
 * @route GET /api/auth/user
 */
exports.getCurrentUser = async (req, res) => {
  const user = await authService.getUserById(req.userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  res.json(user);
};

/**
 * Logout is client-side with JWT (the client discards the token).
 * Kept for API compatibility.
 * @route GET /api/auth/logout
 */
exports.logoutUser = (req, res) => {
  res.json({ message: "Logged out successfully" });
};
