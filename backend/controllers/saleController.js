const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');

// @desc    Record a new sale, check inventory, and auto-subtract stock
// @route   POST /api/sales
exports.createSale = async (req, res, next) => {
  try {
    const {
      category = 'Mobile',
      modelName,
      modelNumber = '',
      customerName,
      customerNumber,
      imei1,
      imei2,
      price,
    } = req.body;

    if (!modelName || !customerName || !customerNumber || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Model name, customer name, customer number, and price are required.',
      });
    }

    // Optional 15-digit IMEI check
    if (imei1 && !/^\d{15}$/.test(imei1.trim())) {
      return res.status(400).json({
        success: false,
        message: 'IMEI 1 must be exactly 15 digits.',
      });
    }
    if (imei2 && !/^\d{15}$/.test(imei2.trim())) {
      return res.status(400).json({
        success: false,
        message: 'IMEI 2 must be exactly 15 digits.',
      });
    }

    // Find in inventory: user can select or type model name
    // Match modelName (and modelNumber if provided)
    const inventoryQuery = {
      modelName: { $regex: new RegExp(`^${modelName.trim()}$`, 'i') },
    };
    if (modelNumber && modelNumber.trim()) {
      inventoryQuery.modelNumber = { $regex: new RegExp(`^${modelNumber.trim()}$`, 'i') };
    }

    const inventoryItem = await Inventory.findOne(inventoryQuery);

    // Rule: "if its not in inventory or purchase it wont allow to be entered."
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: `Item "${modelName.trim()}" is not available in inventory or has zero stock. Sale cannot proceed.`,
      });
    }

    // If an IMEI is provided and inventory tracks IMEIs for this device, verify it exists in stock
    const cleanImei1 = imei1 ? imei1.trim() : null;
    const cleanImei2 = imei2 ? imei2.trim() : null;

    if (cleanImei1 && inventoryItem.imeis && inventoryItem.imeis.length > 0) {
      if (!inventoryItem.imeis.includes(cleanImei1)) {
        return res.status(400).json({
          success: false,
          message: `IMEI ${cleanImei1} is not present in available inventory stock for ${inventoryItem.modelName}.`,
        });
      }
    }

    // Create Sale
    const sale = await Sale.create({
      category: inventoryItem.category || category,
      modelName: inventoryItem.modelName,
      modelNumber: inventoryItem.modelNumber || modelNumber.trim(),
      customerName: customerName.trim(),
      customerNumber: customerNumber.trim(),
      imei1: cleanImei1 || undefined,
      imei2: cleanImei2 || undefined,
      price: Number(price),
    });

    // Automatically subtract from inventory
    inventoryItem.quantity -= 1;
    if (cleanImei1) {
      inventoryItem.imeis = inventoryItem.imeis.filter((im) => im !== cleanImei1);
    }
    if (cleanImei2) {
      inventoryItem.imeis = inventoryItem.imeis.filter((im) => im !== cleanImei2);
    }
    await inventoryItem.save();

    return res.status(201).json({
      success: true,
      data: sale,
      remainingStock: inventoryItem.quantity,
      message: 'Sale recorded and inventory stock deducted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all sales
// @route   GET /api/sales
exports.getSales = async (req, res, next) => {
  try {
    const { search = '' } = req.query;

    const query = {};
    if (search.trim()) {
      const term = search.trim();
      query.$or = [
        { modelName: { $regex: term, $options: 'i' } },
        { modelNumber: { $regex: term, $options: 'i' } },
        { customerName: { $regex: term, $options: 'i' } },
        { customerNumber: { $regex: term, $options: 'i' } },
        { imei1: { $regex: term, $options: 'i' } },
        { imei2: { $regex: term, $options: 'i' } },
      ];
    }

    const sales = await Sale.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale by ID
// @route   GET /api/sales/:id
exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale record not found.',
      });
    }
    return res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete sale record and restore inventory stock
// @route   DELETE /api/sales/:id
exports.deleteSale = async (req, res, next) => {
  try {
    const sale = await Sale.findByIdAndDelete(req.params.id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale record not found.',
      });
    }

    // Restore stock to inventory
    const inventoryItem = await Inventory.findOne({
      modelName: { $regex: new RegExp(`^${sale.modelName.trim()}$`, 'i') },
    });

    if (inventoryItem) {
      inventoryItem.quantity += 1;
      if (sale.imei1 && !inventoryItem.imeis.includes(sale.imei1)) {
        inventoryItem.imeis.push(sale.imei1);
      }
      if (sale.imei2 && !inventoryItem.imeis.includes(sale.imei2)) {
        inventoryItem.imeis.push(sale.imei2);
      }
      await inventoryItem.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Sale record deleted and inventory stock restored.',
    });
  } catch (error) {
    next(error);
  }
};
