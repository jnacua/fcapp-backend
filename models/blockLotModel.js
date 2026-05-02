const mongoose = require('mongoose');

const blockLotSchema = new mongoose.Schema({
    blockNumber: { type: String, required: true },
    lotNumber: { type: String, required: true },
    fullAddress: { type: String, required: true, unique: true },
    isOccupied: { type: Boolean, default: false },
    occupantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    occupantName: { type: String, default: '' }
}, { timestamps: true });

blockLotSchema.index({ blockNumber: 1, lotNumber: 1 }, { unique: true });

module.exports = mongoose.model('BlockLot', blockLotSchema);