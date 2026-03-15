const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Use your Cluster0 URI
const MONGO_URI = "mongodb+srv://jeianpaolonacua07_db_user:jeian26@cluster0.leumqpk.mongodb.net/communitydb";

async function createAdmin() {
    try {
        console.log("🚀 Connecting to MongoDB Cluster0...");
        await mongoose.connect(MONGO_URI);
        
        const hashedPassword = await bcrypt.hash("admin123", 10);
        
        const adminUser = {
            name: "System Admin",
            email: "admin@example.com",
            password: hashedPassword,
            role: "admin",      // Lowercase to match most server logic
            status: "approved",  // 🔥 CRITICAL: Must be approved to log in
            blockLot: "N/A",
            mobileNumber: "0000000000"
        };

        // This will find the user by email and update them, or create if they don't exist
        await mongoose.connection.collection('users').updateOne(
            { email: "admin@example.com" },
            { $set: adminUser },
            { upsert: true }
        );
        
        console.log("-----------------------------------------");
        console.log("🎉 SUCCESS: Admin account is ready!");
        console.log("Email: admin@example.com");
        console.log("Password: admin123");
        console.log("Status: approved");
        console.log("-----------------------------------------");
        process.exit();
    } catch (err) {
        console.error("❌ ERROR:", err.message);
        process.exit(1);
    }
}

createAdmin();