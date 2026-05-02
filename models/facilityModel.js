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
    type: String,
    default: ''
  },
  // ✅ For frontend compatibility - both field names work
  image: { 
    type: String, 
    default: "" // URL for the facility photo
  },
  facilityImageUrl: { 
    type: String, 
    default: "" // Alias for image field used by frontend
  },
  status: { 
    type: String, 
    enum: ['available', 'maintenance', 'closed'], 
    default: 'available' 
  }
}, { timestamps: true });

// ✅ Pre-save middleware to ensure facilityImageUrl mirrors image field
facilitySchema.pre('save', function(next) {
  if (this.image && !this.facilityImageUrl) {
    this.facilityImageUrl = this.image;
  }
  if (this.facilityImageUrl && !this.image) {
    this.image = this.facilityImageUrl;
  }
  next();
});

// ✅ Method to get display image URL
facilitySchema.methods.getImageUrl = function() {
  return this.facilityImageUrl || this.image || '';
};

// ✅ Method to check if facility has an image
facilitySchema.methods.hasImage = function() {
  return !!(this.facilityImageUrl || this.image);
};

module.exports = mongoose.model('Facility', facilitySchema);