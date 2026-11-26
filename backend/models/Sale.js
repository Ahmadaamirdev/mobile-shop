const mongoose = require('mongoose');

// Helper validator for 15-digit IMEI
const validateIMEI = (val) => {
  if (!val || val.trim() === '') return true; // optional
  return /^\d{15}$/.test(val.trim());
};

const saleItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Mobile', 'Tablet', 'Accessory'],
      default: 'Mobile',
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
      required: [function () { return this.category !== 'Accessory'; }, 'Device price is required'],
      min: [0, 'Sale price cannot be negative'],
      default: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: true }
);

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
    status: {
      type: String,
      enum: ['PTA', 'JV', 'Non-PTA', 'CPID'],
      default: 'PTA',
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
    customerName: {
      type: String,
      required: [function () { return this.category !== 'Accessory'; }, 'Customer name is required'],
      trim: true,
      default: '',
    },
    customerNumber: {
      type: String,
      required: [function () { return this.category !== 'Accessory'; }, 'Customer number is required'],
      trim: true,
      default: '',
      validate: {
        validator: (val) => !val || !val.trim() || /^\d{11}$/.test(val.trim()),
        message: 'Customer phone number must contain exactly 11 digits',
      },
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
    items: {
      type: [saleItemSchema],
      default: [],
    },
    price: {
      type: Number,
      required: [function () { return this.category !== 'Accessory'; }, 'Sale price is required'],
      min: [0, 'Sale price cannot be negative'],
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ category: 1, condition: 1, createdAt: -1 });
saleSchema.index({ customerNumber: 1 });
saleSchema.index({ imei1: 1, imei2: 1 });

module.exports = mongoose.model('Sale', saleSchema);
