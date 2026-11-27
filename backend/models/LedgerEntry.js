const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerParty',
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: ['PURCHASE', 'PAYMENT', 'RETURN', 'ADJUSTMENT'],
      required: true,
    },
    category: {
      type: String,
      enum: ['Mobile', 'Tablet', 'Accessory', ''],
      default: '',
    },
    condition: {
      type: String,
      enum: ['New', 'Used', ''],
      default: '',
    },
    status: {
      type: String,
      enum: ['PTA', 'JV', 'Non-PTA', 'CPID', ''],
      default: '',
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    modelName: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: 1,
      min: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceDelta: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: 'Cash',
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ledgerEntrySchema.index({ partyId: 1, occurredAt: 1, createdAt: 1 });
ledgerEntrySchema.index({ purchaseId: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
