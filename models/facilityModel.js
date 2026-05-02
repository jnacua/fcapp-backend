const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    uppercase: true
  },
  price: { 
    type: Number, 
    default: 0 
  },
  capacity: { 
    type: Number, 
    default: 0 
  },
  description: { 
    type: String,
    default: ''
  },
  // ✅ CRITICAL: This field is needed for image upload
  facilityImageUrl: { 
    type: String, 
    default: '' 
  },
  status: { 
    type: String, 
    enum: ['available', 'maintenance', 'closed'], 
    default: 'available' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Facility', facilitySchema);