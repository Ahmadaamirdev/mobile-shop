const mongoose = require('mongoose');

// Helper validator for 15-digit IMEI
const validateIMEI = (val) => {
  if (!val || val.trim() === '') return true; // optional
  return /^\d{15}$/.test(val.trim());
};

// Helper validator for 13-digit ID Card / CNIC
const validateIDCard = (val) => {
  if (!val) return false;
  const digitsOnly = val.replace(/\D/g, '');
  return digitsOnly.length === 13;
};

const purchaseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Mobile', 'Tablet', 'Accessory'],
      default: 'Mobile',
      required: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    modelName: {
      type: String,
      required: [true, 'Model name is required'],
      trim: true,
    },
    modelNumber: {
      type: String,
      required: [true, 'Model number is required'],
      trim: true,
    },
    imei1: {
      type: String,
      trim: true,
      validate: {
        validator: validateIMEI,
        message: 'IMEI 1 must be exactly 15 digits',
      },
    },
    imei2: {
      type: String,
      trim: true,
      validate: {
        validator: validateIMEI,
        message: 'IMEI 2 must be exactly 15 digits',
      },
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
    },
    customerIdCard: {
      type: String,
      required: [true, 'Customer ID card number is required'],
      trim: true,
      validate: {
        validator: validateIDCard,
        message: 'Customer ID card number must contain exactly 13 digits',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for searching & sorting
purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ imei1: 1, imei2: 1 });
purchaseSchema.index({ modelName: 'text', modelNumber: 'text', companyName: 'text', customerName: 'text', customerPhone: 'text' });

module.exports = mongoose.model('Purchase', purchaseSchema);
