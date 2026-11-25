const Inventory = require('../models/Inventory');

// @desc    Get inventory items with optional search & category filter
// @route   GET /api/inventory
exports.getInventory = async (req, res, next) => {
  try {
    const { search = '', category = '', condition = '' } = req.query;

    const query = { quantity: { $gt: 0 } };
    if (category && category !== 'All') {
      query.category = category;
    }

    if (condition && condition !== 'All') {
      query.condition = condition;
    }

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { modelName: { $regex: escaped, $options: 'i' } },
        { modelNumber: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { condition: { $regex: escaped, $options: 'i' } },
        { imeis: { $regex: escaped, $options: 'i' } },
      ];
    }

    const inventory = await Inventory.find(query).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
exports.getInventoryById = async (req, res, next) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found.',
      });
    }
    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manual addition to inventory
// @route   POST /api/inventory
exports.createInventoryItem = async (req, res, next) => {
  try {
    const {
      category = 'Mobile',
      condition = 'New',
      companyName = '',
      modelName,
      modelNumber,
      quantity = 1,
      price = 0,
      imeis = [],
    } = req.body;

    if (!modelName || !modelNumber) {
      return res.status(400).json({
        success: false,
        message: 'Model name and model number are required.',
      });
    }

    // Check if item already exists with matching model and condition
    let item = await Inventory.findOne({
      modelName: { $regex: new RegExp(`^${modelName.trim()}$`, 'i') },
      modelNumber: { $regex: new RegExp(`^${modelNumber.trim()}$`, 'i') },
      condition: condition === 'Used' ? 'Used' : 'New',
    });

    // Validate any IMEIs in list
    const validImeis = Array.isArray(imeis)
      ? imeis.map((im) => String(im).trim()).filter((im) => /^\d{15}$/.test(im))
      : [];

    if (item) {
      item.quantity += Number(quantity);
      item.price = Number(price);
      if (companyName) item.companyName = companyName.trim();
      validImeis.forEach((im) => {
        if (!item.imeis.includes(im)) {
          item.imeis.push(im);
        }
      });
      await item.save();
    } else {
      item = await Inventory.create({
        category,
        condition: condition === 'Used' ? 'Used' : 'New',
        companyName: companyName.trim(),
        modelName: modelName.trim(),
        modelNumber: modelNumber.trim(),
        quantity: Number(quantity),
        price: Number(price),
        imeis: validImeis,
      });
    }

    return res.status(201).json({
      success: true,
      data: item,
      message: 'Item added to inventory successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inventory item (manual edit)
// @route   PUT /api/inventory/:id
exports.updateInventoryItem = async (req, res, next) => {
  try {
    const { modelName, modelNumber, companyName, quantity, price, imeis, category, condition } = req.body;

    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found.',
      });
    }

    if (category) item.category = category;
    if (condition) item.condition = condition;
    if (modelName) item.modelName = modelName.trim();
    if (modelNumber) item.modelNumber = modelNumber.trim();
    if (companyName !== undefined) item.companyName = companyName.trim();
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (price !== undefined) item.price = Number(price);
    if (imeis !== undefined && Array.isArray(imeis)) {
      item.imeis = imeis.map((im) => String(im).trim()).filter((im) => /^\d{15}$/.test(im));
    }

    await item.save();

    return res.status(200).json({
      success: true,
      data: item,
      message: 'Inventory item updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
exports.deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await Inventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found.',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Inventory item removed successfully.',
    });
  } catch (error) {
    next(error);
  }
};
