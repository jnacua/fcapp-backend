const mongoose = require('mongoose'); 
 
const auditSchema = new mongoose.Schema({ 
    adminName: { type: String, required: true }, 
    action: { type: String, required: true }, 
    details: { type: String }, 
    timestamp: { type: Date, default: Date.now } 
}); 
 
module.exports = mongoose.model('Audit', auditSchema); 
