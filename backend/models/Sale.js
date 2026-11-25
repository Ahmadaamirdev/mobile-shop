const mongoose = require('mongoose');

// Helper validator for 15-digit IMEI
const validateIMEI = (val) => {
  if (!val || val.trim() === '') return true; // optional
  return /^\d{15}$/.test(val.trim());
};

const saleSchema = new mongoose.Schema(
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
    modelName: {
      type: String,
      required: [true, 'Model name is required'],
      trim: true,
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerNumber: {
      type: String,
      required: [true, 'Customer number is required'],
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
    price: {
      type: Number,
      required: [true, 'Sale price is required'],
      min: [0, 'Sale price cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ customerNumber: 1 });
saleSchema.index({ imei1: 1, imei2: 1 });

module.exports = mongoose.model('Sale', saleSchema);
