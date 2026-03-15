const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema({
  name: String,
  scheduleDate: Date,
  reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Facility', facilitySchema);
