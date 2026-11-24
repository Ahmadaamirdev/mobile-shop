const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');

// @desc    Create new purchase and auto-add to inventory
// @route   POST /api/purchases
exports.createPurchase = async (req, res, next) => {
  try {
    const {
      category = 'Mobile',
      companyName,
      modelName,
      modelNumber,
      imei1,
      imei2,
      serialNumber,
      customerPhone,
      customerIdCard,
      price,
    } = req.body;

    // Validate 13-digit ID Card
    const cleanedIdCard = customerIdCard ? customerIdCard.replace(/\D/g, '') : '';
    if (cleanedIdCard.length !== 13) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID card number must contain exactly 13 digits.',
      });
    }

    // Validate optional 15-digit IMEIs
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

    // Create Purchase Record
    const purchase = await Purchase.create({
      category,
      companyName: companyName ? companyName.trim() : '',
      modelName: modelName.trim(),
      modelNumber: modelNumber.trim(),
      imei1: imei1 ? imei1.trim() : undefined,
      imei2: imei2 ? imei2.trim() : undefined,
      serialNumber: serialNumber ? serialNumber.trim() : '',
      customerPhone: customerPhone.trim(),
      customerIdCard: cleanedIdCard,
      price: Number(price),
    });

    // Automatically sync with Inventory:
    // Match by modelName and modelNumber (case-insensitive regex)
    let inventoryItem = await Inventory.findOne({
      modelName: { $regex: new RegExp(`^${modelName.trim()}$`, 'i') },
      modelNumber: { $regex: new RegExp(`^${modelNumber.trim()}$`, 'i') },
    });

    const imeisToAdd = [];
    if (imei1 && imei1.trim()) imeisToAdd.push(imei1.trim());
    if (imei2 && imei2.trim()) imeisToAdd.push(imei2.trim());

    if (inventoryItem) {
      // Increment stock quantity
      inventoryItem.quantity += 1;
      inventoryItem.price = Number(price); // sync price or update latest purchase price
      if (companyName) inventoryItem.companyName = companyName.trim();
      
      // Append IMEIs if not already present
      imeisToAdd.forEach((im) => {
        if (!inventoryItem.imeis.includes(im)) {
          inventoryItem.imeis.push(im);
        }
      });
      await inventoryItem.save();
    } else {
      // Create new inventory item
      inventoryItem = await Inventory.create({
        category,
        companyName: companyName ? companyName.trim() : '',
        modelName: modelName.trim(),
        modelNumber: modelNumber.trim(),
        quantity: 1,
        price: Number(price),
        imeis: imeisToAdd,
      });
    }

    return res.status(201).json({
      success: true,
      data: purchase,
      inventory: inventoryItem,
      message: 'Purchase recorded and inventory updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchases with search and newest/oldest filters
// @route   GET /api/purchases
exports.getPurchases = async (req, res, next) => {
  try {
    const { sort = 'newest', search = '' } = req.query;

    const query = {};

    if (search.trim()) {
      const term = search.trim();
      query.$or = [
        { modelName: { $regex: term, $options: 'i' } },
        { modelNumber: { $regex: term, $options: 'i' } },
        { companyName: { $regex: term, $options: 'i' } },
        { customerPhone: { $regex: term, $options: 'i' } },
        { customerIdCard: { $regex: term, $options: 'i' } },
        { imei1: { $regex: term, $options: 'i' } },
        { imei2: { $regex: term, $options: 'i' } },
        { serialNumber: { $regex: term, $options: 'i' } },
      ];
    }

    const sortOrder = sort === 'oldest' ? 1 : -1;
    const purchases = await Purchase.find(query).sort({ createdAt: sortOrder });

    return res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single purchase by ID
// @route   GET /api/purchases/:id
exports.getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase record not found.',
      });
    }
    return res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete purchase record
// @route   DELETE /api/purchases/:id
exports.deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByIdAndDelete(req.params.id);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase record not found.',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Purchase record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

