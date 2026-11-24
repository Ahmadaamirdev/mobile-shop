const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerNumber: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
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
    imei1: {
      type: String,
      trim: true,
      default: '',
    },
    imei2: {
      type: String,
      trim: true,
      default: '',
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

invoiceSchema.index({ date: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
