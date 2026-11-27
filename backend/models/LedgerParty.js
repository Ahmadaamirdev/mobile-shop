const mongoose = require('mongoose');

const ledgerPartySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    partyType: {
      type: String,
      enum: ['Supplier'],
      default: 'Supplier',
      required: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    totalBilled: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    totalReturned: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

ledgerPartySchema.index({ balance: -1, lastActivityAt: -1 });
ledgerPartySchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('LedgerParty', ledgerPartySchema);
