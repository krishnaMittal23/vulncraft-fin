/**
 * Utility to fix duplicate firebaseUid errors in MongoDB
 * This script finds duplicate firebaseUid values and helps resolve them
 * Usage: node src/utils/fixDuplicateFirebaseUids.js
 */

const mongoose = require("mongoose");
const admin = require("../config/firebaseConfig");
const User = require("../models/User");
require("dotenv").config();

async function fixDuplicates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all users with firebaseUid
    const allUsers = await User.find({ firebaseUid: { $exists: true, $ne: null } });

    // Group by firebaseUid to find duplicates
    const firebaseUidMap = {};
    allUsers.forEach((user) => {
      if (!firebaseUidMap[user.firebaseUid]) {
        firebaseUidMap[user.firebaseUid] = [];
      }
      firebaseUidMap[user.firebaseUid].push(user);
    });

    // Find duplicates
    const duplicates = Object.entries(firebaseUidMap).filter(
      ([_, users]) => users.length > 1
    );

    if (duplicates.length === 0) {
      console.log("✅ No duplicate firebaseUid values found!");
      await mongoose.disconnect();
      return;
    }

    console.log(`\n⚠️  Found ${duplicates.length} duplicate firebaseUid values:\n`);

    let fixedCount = 0;
    let deletedCount = 0;

    for (const [firebaseUid, users] of duplicates) {
      console.log(`\n🔍 Firebase UID: ${firebaseUid}`);
      console.log(`   Users with this UID: ${users.length}`);

      // Sort by creation date - keep the oldest, remove others
      users.sort((a, b) => a.createdAt - b.createdAt);

      const keepUser = users[0];
      const removeUsers = users.slice(1);

      console.log(`   Keeping: ${keepUser.username} (${keepUser.email}) - created ${keepUser.createdAt}`);

      for (const removeUser of removeUsers) {
        console.log(`   Removing firebaseUid from: ${removeUser.username} (${removeUser.email})`);

        // Check if this user has a GitHub ID
        if (removeUser.githubId) {
          // Keep the user but remove the duplicate firebaseUid
          removeUser.firebaseUid = null;
          await removeUser.save();
          console.log(`   ✅ Cleared firebaseUid for ${removeUser.username}`);
          fixedCount++;
        } else {
          // No GitHub ID, safe to delete
          await User.findByIdAndDelete(removeUser._id);
          console.log(`   🗑️  Deleted user: ${removeUser.username}`);
          deletedCount++;
        }
      }
    }

    console.log("\n📊 Fix Summary:");
    console.log(`✅ Cleared duplicate firebaseUids: ${fixedCount}`);
    console.log(`🗑️  Deleted orphaned users: ${deletedCount}`);

    // Verify no more duplicates
    const verifyDuplicates = await User.aggregate([
      { $group: { _id: "$firebaseUid", count: { $sum: 1 } } },
      { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
    ]);

    if (verifyDuplicates.length === 0) {
      console.log("\n✅ All duplicates fixed!");
    } else {
      console.log(`\n⚠️  Still ${verifyDuplicates.length} duplicates found`);
    }

    await mongoose.disconnect();
    console.log("\n✅ Process completed!");
  } catch (error) {
    console.error("❌ Fix failed:", error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  fixDuplicates();
}

module.exports = { fixDuplicates };
