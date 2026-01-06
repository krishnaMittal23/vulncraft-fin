const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");
const admin = require("./firebaseConfig");
require("dotenv").config();

// Determine callback URL based on environment
const getCallbackURL = () => {
  // If GITHUB_CALLBACK_URL is explicitly set in env, use it
  if (process.env.GITHUB_CALLBACK_URL) {
    return process.env.GITHUB_CALLBACK_URL;
  }
  
  // Otherwise construct from BACKEND_URL if available
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT}`;
  return `${backendUrl}/api/auth/github/callback`;
};

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: getCallbackURL(),
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ githubId: profile.id });
        let firebaseUid = null;

        if (!user) {
          // Create new user in MongoDB
          user = await User.create({
            githubId: profile.id,
            username: profile.username,
            avatar: profile.photos[0]?.value || "",
            email: profile.emails?.[0]?.value || "",
            accessToken: accessToken, // Store access token
          });

          // Create user in Firebase Authentication
          try {
            const firebaseUserRecord = await admin.auth().createUser({
              uid: `github_${profile.id}`,
              email: profile.emails?.[0]?.value || undefined,
              displayName: profile.username,
              photoURL: profile.photos[0]?.value || undefined,
            });
            firebaseUid = firebaseUserRecord.uid;

            // Check if another user already has this firebaseUid
            const existingUserWithUid = await User.findOne({
              firebaseUid,
              _id: { $ne: user._id },
            });

            if (existingUserWithUid) {
              console.warn(
                `⚠️  Another user already has firebaseUid ${firebaseUid}. Skipping assignment.`
              );
            } else {
              // Link Firebase UID to MongoDB user
              user.firebaseUid = firebaseUid;
              await user.save();
              console.log(`✅ Firebase user created for GitHub user ${profile.username}`);
            }
          } catch (firebaseError) {
            // If user already exists in Firebase, get their UID
            if (firebaseError.code === "auth/uid-already-exists") {
              const existingFirebaseUser = await admin
                .auth()
                .getUser(`github_${profile.id}`)
                .catch(() => null);
              if (existingFirebaseUser) {
                // Check if another MongoDB user already has this firebaseUid
                const existingUserWithUid = await User.findOne({
                  firebaseUid: existingFirebaseUser.uid,
                  _id: { $ne: user._id },
                });

                if (!existingUserWithUid) {
                  firebaseUid = existingFirebaseUser.uid;
                  user.firebaseUid = firebaseUid;
                  await user.save();
                  console.log(
                    `✅ Linked existing Firebase user for GitHub user ${profile.username}`
                  );
                } else {
                  console.warn(
                    `⚠️  Firebase UID ${existingFirebaseUser.uid} already assigned to another MongoDB user`
                  );
                }
              }
            } else if (firebaseError.code === "auth/email-already-exists") {
              // Email exists, get user by email
              const existingFirebaseUser = await admin
                .auth()
                .getUserByEmail(profile.emails?.[0]?.value)
                .catch(() => null);
              if (existingFirebaseUser) {
                // Check if another MongoDB user already has this firebaseUid
                const existingUserWithUid = await User.findOne({
                  firebaseUid: existingFirebaseUser.uid,
                  _id: { $ne: user._id },
                });

                if (!existingUserWithUid) {
                  firebaseUid = existingFirebaseUser.uid;
                  user.firebaseUid = firebaseUid;
                  await user.save();
                  console.log(
                    `✅ Linked Firebase user by email for GitHub user ${profile.username}`
                  );
                } else {
                  console.warn(
                    `⚠️  Firebase UID ${existingFirebaseUser.uid} already assigned to another MongoDB user`
                  );
                }
              }
            } else {
              console.error("Error creating Firebase user:", firebaseError.message);
            }
          }
        } else {
          // Update access token for existing user
          user.accessToken = accessToken;
          
          // If user doesn't have Firebase UID, create one
          if (!user.firebaseUid) {
            try {
              const firebaseUserRecord = await admin.auth().createUser({
                uid: `github_${profile.id}`,
                email: profile.emails?.[0]?.value || undefined,
                displayName: profile.username,
                photoURL: profile.photos[0]?.value || undefined,
              });
              firebaseUid = firebaseUserRecord.uid;

              // Check if another user already has this firebaseUid
              const existingUserWithUid = await User.findOne({
                firebaseUid,
                _id: { $ne: user._id },
              });

              if (!existingUserWithUid) {
                user.firebaseUid = firebaseUid;
                console.log(
                  `✅ Firebase user created for existing GitHub user ${profile.username}`
                );
              } else {
                console.warn(
                  `⚠️  Firebase UID ${firebaseUid} already assigned to another MongoDB user`
                );
              }
            } catch (firebaseError) {
              if (firebaseError.code === "auth/uid-already-exists") {
                const existingFirebaseUser = await admin
                  .auth()
                  .getUser(`github_${profile.id}`)
                  .catch(() => null);
                if (existingFirebaseUser) {
                  const existingUserWithUid = await User.findOne({
                    firebaseUid: existingFirebaseUser.uid,
                    _id: { $ne: user._id },
                  });
                  if (!existingUserWithUid) {
                    user.firebaseUid = existingFirebaseUser.uid;
                  }
                }
              } else if (firebaseError.code === "auth/email-already-exists") {
                const existingFirebaseUser = await admin
                  .auth()
                  .getUserByEmail(profile.emails?.[0]?.value)
                  .catch(() => null);
                if (existingFirebaseUser) {
                  const existingUserWithUid = await User.findOne({
                    firebaseUid: existingFirebaseUser.uid,
                    _id: { $ne: user._id },
                  });
                  if (!existingUserWithUid) {
                    user.firebaseUid = existingFirebaseUser.uid;
                  }
                }
              } else {
                console.error(
                  "Error creating Firebase user for existing user:",
                  firebaseError.message
                );
              }
            }
          }
          
          await user.save();
        }

        // Sync user data to Firebase Realtime Database (optional)
        if (process.env.FIREBASE_DATABASE_URL) {
          try {
            const db = admin.database();
            await db.ref(`users/${user._id.toString()}`).set({
              githubId: user.githubId,
              username: user.username,
              email: user.email,
              avatar: user.avatar,
              firebaseUid: user.firebaseUid,
              lastLogin: new Date().toISOString(),
            });
          } catch (firebaseError) {
            console.error("Error syncing to Firebase Realtime Database:", firebaseError.message);
            // Don't fail auth if Firebase sync fails
          }
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