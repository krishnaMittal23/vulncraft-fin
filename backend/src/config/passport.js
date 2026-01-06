const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");
const admin = require("./firebaseConfig");
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

        // Sync user data to Firebase Realtime Database
        try {
          const db = admin.database();
          await db.ref(`users/${user._id.toString()}`).set({
            githubId: user.githubId,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            lastLogin: new Date().toISOString(),
          });
        } catch (firebaseError) {
          console.error("Error syncing to Firebase:", firebaseError);
          // Don't fail auth if Firebase sync fails
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  done(null, user._id.toString()); // Convert ObjectId to string
});


passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});