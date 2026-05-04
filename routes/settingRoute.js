const express = require('express');
const router = express.Router();
const Setting = require('../models/settingModel');
const auth = require('../middleware/authMiddleware');

// Get a specific setting (public - mobile app can read)
router.get('/:key', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    res.json({ key: req.params.key, value: setting?.value || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all settings (public)
router.get('/all', async (req, res) => {
  try {
    const settings = await Setting.find();
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    res.json(settingsMap);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update setting (admin only)
router.put('/:key', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
  try {
    const { value } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key: req.params.key },
      { key: req.params.key, value, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= PENALTY SETTINGS ENDPOINTS =================

// Get penalty settings (public - mobile app can read)
router.get('/penalty/settings', async (req, res) => {
  try {
    const penaltyAmount = await Setting.findOne({ key: 'penalty_amount' });
    const penaltyDays = await Setting.findOne({ key: 'penalty_days' });
    
    res.json({
      penaltyAmount: penaltyAmount?.value || '50',
      penaltyDays: penaltyDays?.value || '25'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update penalty settings (admin only)
router.put('/penalty/settings', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
  try {
    const { penaltyAmount, penaltyDays } = req.body;
    
    await Setting.findOneAndUpdate(
      { key: 'penalty_amount' },
      { key: 'penalty_amount', value: penaltyAmount },
      { upsert: true, new: true }
    );
    
    await Setting.findOneAndUpdate(
      { key: 'penalty_days' },
      { key: 'penalty_days', value: penaltyDays },
      { upsert: true, new: true }
    );
    
    res.json({ 
      message: "Penalty settings updated successfully", 
      penaltyAmount, 
      penaltyDays 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize default settings (admin only - run once)
router.post('/initialize', auth.protect, auth.restrictTo('ADMIN'), async (req, res) => {
  try {
    const defaultSettings = [
      { key: 'monthly_dues', value: '200.00' },
      { key: 'water_rate', value: '25.00' },
      { key: 'penalty_rate', value: '2.0' },
      { key: 'penalty_grace_period', value: '15' },
      { key: 'penalty_amount', value: '50' },
      { key: 'penalty_days', value: '25' }
    ];
    
    for (const setting of defaultSettings) {
      await Setting.findOneAndUpdate(
        { key: setting.key },
        setting,
        { upsert: true, new: true }
      );
    }
    
    res.json({ message: "Default settings initialized", settings: defaultSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;