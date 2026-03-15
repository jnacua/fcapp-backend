const Vehicle = require('../models/vehicleModel');

// 1. Submit Registration (Stays Pending)
exports.registerVehicle = async (req, res) => {
    try {
        const { licenseNumber, vehicleType } = req.body;
        const newVehicle = await Vehicle.create({
            owner: req.user.id,
            licenseNumber,
            vehicleType,
            carPhoto: req.files['carPhoto'][0].path,
            proofPhoto: req.files['proofPhoto'][0].path,
            status: 'Pending' // Default status
        });
        res.status(201).json(newVehicle);
    } catch (err) {
        res.status(500).json({ message: "Registration failed" });
    }
};

// 2. Get User's Vehicles (Categorized)
exports.getMyVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ owner: req.user.id });
        res.status(200).json(vehicles);
    } catch (err) {
        res.status(500).json({ message: "Error fetching vehicles" });
    }
};