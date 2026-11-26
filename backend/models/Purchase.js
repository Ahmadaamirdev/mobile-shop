const mongoose = require('mongoose');

// Helper validator for 15-digit IMEI
const validateIMEI = (val) => {
  if (!val || val.trim() === '') return true; // optional
  return /^\d{15}$/.test(val.trim());
};

// Helper validator for 13-digit ID Card / CNIC (optional for manual inventory inward)
const validateIDCard = (val) => {
  if (!val || val.trim() === '') return true; // optional for direct inventory inward
  const digitsOnly = val.replace(/\D/g, '');
  return digitsOnly.length === 13;
};

// Helper validator for 11-digit phone number (optional for manual inventory inward)
const validatePhone11 = (val) => {
  if (!val || val.trim() === '') return true;
  return /^\d{11}$/.test(val.trim());
};

const purchaseSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Mobile', 'Tablet', 'Accessory'],
      default: 'Mobile',
      required: true,
    },
    condition: {
      type: String,
      enum: ['New', 'Used'],
      default: 'New',
    },
    status: {
      type: String,
      enum: ['PTA', 'JV', 'Non-PTA', 'CPID'],
      default: 'PTA',
    },
    companyName: {
      type: String,
      required: [function () { return this.category !== 'Accessory'; }, 'Company name is required'],
      trim: true,
      default: '',
    },
    modelName: {
      type: String,
      required: [function () { return this.category !== 'Accessory'; }, 'Model name is required'],
      trim: true,
      default: '',
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
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
      default: '',
      trim: true,
      validate: {
        validator: validatePhone11,
        message: 'Customer phone number must contain exactly 11 digits',
      },
    },
    customerIdCard: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: validateIDCard,
        message: 'Customer ID card number must contain exactly 13 digits',
      },
    },
    customerAddress: {
      type: String,
      trim: true,
      default: '',
    },
    idCardFront: {
      type: String,
      default: '',
    },
    idCardBack: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: [function () { return this.category !== 'Accessory'; }, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for searching & sorting
purchaseSchema.index({ createdAt: -1 });
purchaseSchema.index({ category: 1, condition: 1, createdAt: -1 });
purchaseSchema.index({ imei1: 1, imei2: 1 });
purchaseSchema.index({ modelName: 'text', modelNumber: 'text', companyName: 'text', customerName: 'text', customerPhone: 'text' });

module.exports = mongoose.model('Purchase', purchaseSchema);
