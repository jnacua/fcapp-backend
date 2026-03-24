const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  userName: { 
    type: String, 
    required: true 
  },
  address: { 
    type: String 
  },
  facilityName: { 
    type: String, 
    required: true 
  },
  bookingDate: { 
    type: Date, 
    required: true 
  },
  timeSlot: { 
    type: String, 
    required: true // e.g., "08:00 AM - 10:00 AM"
  },
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], 
    default: 'Pending' 
  },
  proofOfPayment: { 
    type: String, 
    default: "" // URL to the GCash screenshot
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);