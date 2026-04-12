const Panic = require('../models/panicModel');

exports.getAll = async (req, res) => {
  try {
    res.json(await Panic.find());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch panic alerts" });
  }
};

// ✅ UPDATED: Save to DB AND emit to Sockets instantly
exports.create = async (req, res) => {
  try {
    const panic = new Panic(req.body);
    const savedPanic = await panic.save();

    // 1. Grab the Socket instance from server.js
    const io = req.app.get('socketio');

    // 2. Format the data for the Flutter pop-up
    const alertData = {
      name: req.body.name || "RESIDENT",
      blockLot: req.body.blockLot || "UNKNOWN LOCATION",
      status: req.body.status || 'ACTIVE'
    };

    // 3. 🚨 SHOUT TO THE SECURITY DASHBOARD!
    if (io) {
      io.emit('emergency-alert', alertData);
      console.log("🚨 Emergency Alert Broadcasted via Socket!");
    } else {
      console.log("❌ Socket.io instance not found in controller.");
    }

    res.status(201).json(savedPanic);
  } catch (error) {
    console.error("Panic Create Error:", error);
    res.status(500).json({ error: "Failed to create panic alert" });
  }
};

// ✅ ADDED: Fixes the 404 Error your Flutter app was getting
exports.getLatest = async (req, res) => {
  try {
    // Find the most recently created ACTIVE alert
    const latestPanic = await Panic.findOne({ status: 'ACTIVE' }).sort({ createdAt: -1 });
    
    // If one exists, return it. Otherwise, return null.
    res.status(200).json(latestPanic || null);
  } catch (error) {
    console.error("Latest Panic Error:", error);
    res.status(500).json({ error: "Failed to fetch latest alert" });
  }
};