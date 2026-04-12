const User = require('../models/userModel');

// Memory storage for the active scan session
let latestScan = {
    resident: null,
    timestamp: null
};

// ✅ 1. Submit a scan (Mobile browser/Manual search calls this)
exports.submitScan = async (req, res) => {
    try {
        const { qrData } = req.body;
        console.log(`🚀 SCAN RECEIVED: ${qrData}`);

        const resident = await User.findOne({ 
            $or: [
                { blockLot: new RegExp('^' + qrData + '$', 'i') }, 
                { _id: qrData.length === 24 ? qrData : null }
            ] 
        });

        if (!resident) {
            console.log(`❌ Resident not found for: ${qrData}`);
            return res.status(404).json({ message: "Resident not found" });
        }

        latestScan = {
            resident: resident,
            timestamp: Date.now()
        };

        console.log(`✅ SCAN SYNCED: ${resident.name}`);
        res.status(200).json({ message: "Scan synced successfully", resident });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ 2. Get the latest scan (Laptop polls this)
exports.getLatestScan = async (req, res) => {
    res.status(200).json(latestScan);
};

// ✅ 3. Clear the scan (After "Log Entry" is clicked)
exports.clearScan = async (req, res) => {
    latestScan = { resident: null, timestamp: null };
    console.log("🧹 Scan session cleared.");
    res.status(200).json({ message: "Scan cleared" });
}; 
