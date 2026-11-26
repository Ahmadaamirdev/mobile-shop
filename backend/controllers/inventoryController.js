const Inventory = require('../models/Inventory');
const Purchase = require('../models/Purchase');

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
        { status: { $regex: escaped, $options: 'i' } },
        { imeis: { $regex: escaped, $options: 'i' } },
      ];
    }

    const inventory = await Inventory.find(query).sort({ updatedAt: -1 }).lean();

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
    const item = await Inventory.findById(req.params.id).lean();
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
      status = 'PTA',
      companyName = '',
      modelName,
      modelNumber = '',
      quantity = 1,
      price = 0,
      imeis = [],
      imei1 = '',
      imei2 = '',
      serialNumber = '',
      customerName = '',
      customerPhone = '',
      customerIdCard = '',
      customerAddress = '',
    } = req.body;

    if (!modelName || !modelName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Model name is required.',
      });
    }

    const cleanedSupplierPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    if (customerPhone && customerPhone.trim() && cleanedSupplierPhone.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'Supplier phone number must contain exactly 11 digits.',
      });
    }

    const cleanModelNumber = modelNumber ? modelNumber.trim() : '';

    // Check if item already exists with matching model and condition
    let item = await Inventory.findOne({
      modelName: { $regex: new RegExp(`^${modelName.trim()}$`, 'i') },
      modelNumber: cleanModelNumber
        ? { $regex: new RegExp(`^${cleanModelNumber}$`, 'i') }
        : '',
      condition: condition === 'Used' ? 'Used' : 'New',
    });

    // Collect IMEIs from array and individual fields
    const allImeis = [...(Array.isArray(imeis) ? imeis : [])];
    if (imei1 && imei1.trim()) allImeis.push(imei1.trim());
    if (imei2 && imei2.trim()) allImeis.push(imei2.trim());

    // Validate any IMEIs in list
    const validImeis = allImeis
      .map((im) => String(im).trim())
      .filter((im) => /^\d{15}$/.test(im));

    if (item) {
      item.quantity += Number(quantity);
      item.price = Number(price);
      if (companyName) item.companyName = companyName.trim();
      if (['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status)) item.status = status;
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
        status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA',
        companyName: companyName.trim(),
        modelName: modelName.trim(),
        modelNumber: cleanModelNumber,
        quantity: Number(quantity),
        price: Number(price),
        imeis: validImeis,
      });
    }

    // Guard against accidental double-submit creating duplicate Purchase records within 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);
    const cleanCustomerName = customerName ? customerName.trim() : 'Manual Inventory Entry';
    const purchaseQty = Math.max(1, Number(quantity) || 1);
    const purchasePrice = Number(price) || 0;

    const existingRecentPurchase = await Purchase.findOne({
      modelName: modelName.trim(),
      modelNumber: cleanModelNumber,
      condition: condition === 'Used' ? 'Used' : 'New',
      customerName: cleanCustomerName,
      price: purchasePrice,
      quantity: purchaseQty,
      createdAt: { $gte: tenSecondsAgo },
    });

    const purchaseRecord =
      existingRecentPurchase ||
      (await Purchase.create({
        category,
        condition: condition === 'Used' ? 'Used' : 'New',
        status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA',
        companyName: companyName ? companyName.trim() : (item.companyName || 'Stock'),
        modelName: modelName.trim(),
        modelNumber: cleanModelNumber,
        quantity: purchaseQty,
        imei1: (validImeis[0] || imei1 || '').trim() || undefined,
        imei2: (validImeis[1] || imei2 || '').trim() || undefined,
        serialNumber: serialNumber ? serialNumber.trim() : '',
        customerName: cleanCustomerName,
        customerPhone: customerPhone ? customerPhone.trim() : '',
        customerIdCard: customerIdCard ? customerIdCard.replace(/\D/g, '') : '',
        customerAddress: customerAddress ? customerAddress.trim() : '',
        price: purchasePrice,
      }));

    return res.status(201).json({
      success: true,
      data: item,
      purchase: purchaseRecord,
      message: 'Item added to inventory and recorded in purchase registry successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update inventory item (manual edit)
// @route   PUT /api/inventory/:id
exports.updateInventoryItem = async (req, res, next) => {
  try {
    const { modelName, modelNumber, companyName, quantity, price, imeis, category, condition, status } = req.body;

    const item = await Inventory.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found.',
      });
    }

    if (category) item.category = category;
    if (condition) item.condition = condition;
    if (['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status)) item.status = status;
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
