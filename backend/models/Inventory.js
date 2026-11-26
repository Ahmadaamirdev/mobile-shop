const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['Mobile', 'Tablet', 'Accessory'],
      required: [true, 'Category is required'],
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
      required: [true, 'Model name is required'],
      trim: true,
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      default: 0,
    },
    // Array of available IMEIs for mobiles/tablets
    imeis: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high-speed queries and sorting
inventorySchema.index({ modelName: 1, modelNumber: 1, condition: 1 }, { unique: true });
inventorySchema.index({ quantity: 1, updatedAt: -1 });
inventorySchema.index({ category: 1, condition: 1 });
inventorySchema.index({ 'imeis': 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
