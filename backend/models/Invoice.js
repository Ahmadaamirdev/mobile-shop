const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
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
    condition: {
      type: String,
      enum: ['New', 'Used'],
      default: 'New',
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
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: true }
);

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
      validate: {
        validator: (val) => /^\d{11}$/.test((val || '').trim()),
        message: 'Customer phone number must contain exactly 11 digits',
      },
    },
    // Multiple devices / items array
    items: {
      type: [invoiceItemSchema],
      default: [],
    },
    // Backward-compatibility top-level fields (populated from primary/first item)
    modelName: {
      type: String,
      trim: true,
      default: '',
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    condition: {
      type: String,
      enum: ['New', 'Used'],
      default: 'New',
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
      required: [true, 'Total price is required'],
      min: [0, 'Price cannot be negative'],
    },
    paymentMode: {
      type: String,
      trim: true,
      default: 'Cash / Instant',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-fill top-level compatibility fields and total price before save
invoiceSchema.pre('save', function (next) {
  if (this.items && this.items.length > 0) {
    this.price = this.items.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
    this.modelName = this.items.map((it) => it.modelName).join(', ');
    const first = this.items[0];
    if (first) {
      this.modelNumber = first.modelNumber || '';
      this.condition = first.condition || 'New';
      this.imei1 = first.imei1 || '';
      this.imei2 = first.imei2 || '';
    }
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
