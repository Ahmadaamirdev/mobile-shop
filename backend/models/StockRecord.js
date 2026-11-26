const mongoose = require('mongoose');

const stockRecordSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['PURCHASE_IN', 'SALE_OUT', 'INVENTORY_ADJUST', 'PURCHASE_REVERSAL', 'SALE_RESTORE'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['IN', 'OUT'],
      required: true,
    },
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
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    modelName: {
      type: String,
      trim: true,
      default: 'Accessory',
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
    quantityDelta: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      default: 0,
    },
    resultingStock: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    partyName: {
      type: String,
      trim: true,
      default: '',
    },
    partyPhone: {
      type: String,
      trim: true,
      default: '',
    },
    dateKey: {
      type: String,
      required: true,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      default: null,
      index: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      default: null,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

stockRecordSchema.index({ dateKey: -1, occurredAt: -1 });
stockRecordSchema.index({ modelName: 1, condition: 1 });

module.exports = mongoose.model('StockRecord', stockRecordSchema);
