const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    uppercase: true // Ensures "Clubhouse" becomes "CLUBHOUSE" for consistency
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
    type: String 
  },
  image: { 
    type: String, 
    default: "" // URL for the facility photo
  },
  status: { 
    type: String, 
    enum: ['available', 'maintenance', 'closed'], 
    default: 'available' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Facility', facilitySchema);