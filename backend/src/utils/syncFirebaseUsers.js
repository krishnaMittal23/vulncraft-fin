/**
 * Utility to sync existing GitHub users to Firebase Authentication
 * Run this once to migrate all existing GitHub users to Firebase
 * Usage: node src/utils/syncFirebaseUsers.js
 */

const mongoose = require("mongoose");
const admin = require("../config/firebaseConfig");
const User = require("../models/User");
require("dotenv").config();

async function syncUsersToFirebase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all GitHub users without Firebase UID
    const usersToSync = await User.find({
      githubId: { $exists: true },
      firebaseUid: { $exists: false },
    });

    console.log(`Found ${usersToSync.length} GitHub users to sync`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of usersToSync) {
      try {
        // Try to create Firebase user with GitHub UID pattern
        try {
          const firebaseUser = await admin.auth().createUser({
            uid: `github_${user.githubId}`,
            email: user.email || undefined,
            displayName: user.username,
            photoURL: user.avatar || undefined,
          });

          // Check if another user already has this firebaseUid
          const existingUserWithUid = await User.findOne({
            firebaseUid: firebaseUser.uid,
            _id: { $ne: user._id },
          });

          if (existingUserWithUid) {
            console.log(
              `⚠️  Firebase UID ${firebaseUser.uid} already assigned to ${existingUserWithUid.username}. Skipping ${user.username}.`
            );
            skipCount++;
          } else {
            user.firebaseUid = firebaseUser.uid;
            await user.save();

            console.log(
              `✅ Synced: ${user.username} (${user.email}) -> Firebase UID: ${firebaseUser.uid}`
            );
            successCount++;
          }
        } catch (firebaseError) {
          if (
            firebaseError.code === "auth/uid-already-exists" ||
            firebaseError.code === "auth/email-already-exists"
          ) {
            // User already exists, try to get by email
            if (user.email) {
              const existingUser = await admin
                .auth()
                .getUserByEmail(user.email)
                .catch(() => null);
              if (existingUser) {
                const existingUserWithUid = await User.findOne({
                  firebaseUid: existingUser.uid,
                  _id: { $ne: user._id },
                });

                if (existingUserWithUid) {
                  console.log(
                    `⚠️  Firebase UID ${existingUser.uid} already assigned to ${existingUserWithUid.username}. Skipping ${user.username}.`
                  );
                  skipCount++;
                } else {
                  user.firebaseUid = existingUser.uid;
                  await user.save();
                  console.log(
                    `⏭️  Linked existing Firebase user: ${user.username} -> ${existingUser.uid}`
                  );
                  skipCount++;
                }
              } else {
                console.log(`⚠️  Could not link ${user.username} to Firebase`);
                errorCount++;
              }
            } else {
              console.log(
                `⚠️  No email for ${user.username}, cannot sync to Firebase`
              );
              skipCount++;
            }
          } else {
            console.error(
              `❌ Error syncing ${user.username}:`,
              firebaseError.message
            );
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing user ${user.username}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📊 Sync Summary:");
    console.log(`✅ Successfully synced: ${successCount}`);
    console.log(`⏭️  Linked existing: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    await mongoose.disconnect();
    console.log("\n✅ Sync completed!");
  } catch (error) {
    console.error("❌ Sync failed:", error);
    process.exit(1);
  }
}

// Run sync if executed directly
if (require.main === module) {
  syncUsersToFirebase();
}

module.exports = { syncUsersToFirebase };
