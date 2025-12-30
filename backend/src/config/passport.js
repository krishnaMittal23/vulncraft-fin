const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");
require("dotenv").config();

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `http://localhost:${process.env.PORT}/api/auth/github/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ githubId: profile.id });

        if (!user) {
          user = await User.create({
            githubId: profile.id,
            username: profile.username,
            avatar: profile.photos[0]?.value || "",
            email: profile.emails?.[0]?.value || "",
            accessToken: accessToken, // Store access token
          });
        } else {
          user.accessToken = accessToken; // Update access token
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// ✅ Ensure the user ID is properly serialized
passport.serializeUser((user, done) => {
  done(null, user._id.toString()); // Convert ObjectId to string
});

// ✅ Ensure the user is properly deserialized
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});