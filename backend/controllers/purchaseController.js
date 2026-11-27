const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');
const LedgerParty = require('../models/LedgerParty');
const LedgerEntry = require('../models/LedgerEntry');
const { uploadCompressedImage } = require('../config/cloudinary');
const { logStockMovement } = require('./recordController');
const { recomputePartyLedger } = require('./ledgerController');
const { escapeRegex, parsePositiveIntQty, parseNonNegativePrice } = require('../utils/validators');

// @desc    Upload & compress single ID card image to Cloudinary
// @route   POST /api/purchases/upload-id
exports.uploadIdCard = async (req, res, next) => {
  try {
    const { image, side = 'front' } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data is required.' });
    }
    const url = await uploadCompressedImage(image, `unity_mobile/id_cards/${side}`);
    return res.status(200).json({
      success: true,
      url,
      message: 'ID Card image uploaded and compressed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new purchase and auto-add to inventory
// @route   POST /api/purchases
exports.createPurchase = async (req, res, next) => {
  try {
    const {
      category = 'Mobile',
      condition = 'New',
      status = 'PTA',
      companyName,
      modelName,
      quantity = 1,
      imei1,
      imei2,
      serialNumber,
      customerName,
      customerPhone,
      customerIdCard,
      customerAddress = '',
      idCardFront = '',
      idCardBack = '',
      price,
      paymentType = 'cash',
      ledgerPartyId = '',
      paidAmount = 0,
      paymentMethod = 'Cash',
    } = req.body;

    const isAccessory = category === 'Accessory';

    if (!isAccessory && (!modelName || !modelName.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Model name is required.',
      });
    }

    // Validate 11-digit Phone Number (optional for Accessory)
    const cleanedPhone = customerPhone ? customerPhone.replace(/\D/g, '') : '';
    if ((!isAccessory && cleanedPhone.length !== 11) || (isAccessory && customerPhone && customerPhone.trim() && cleanedPhone.length !== 11)) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number must contain exactly 11 digits.',
      });
    }

    // Validate 13-digit ID Card (optional for Accessory)
    const cleanedIdCard = customerIdCard ? customerIdCard.replace(/\D/g, '') : '';
    if ((!isAccessory && cleanedIdCard.length !== 13) || (isAccessory && customerIdCard && customerIdCard.trim() && cleanedIdCard.length !== 13)) {
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

    // Upload and compress ID Card Front and Back to Cloudinary if provided
    let frontUrl = '';
    let backUrl = '';

    if (idCardFront && idCardFront.trim()) {
      frontUrl = await uploadCompressedImage(idCardFront, 'unity_mobile/id_cards/front');
    }
    if (idCardBack && idCardBack.trim()) {
      backUrl = await uploadCompressedImage(idCardBack, 'unity_mobile/id_cards/back');
    }

    const cleanModelName = modelName && modelName.trim() ? modelName.trim() : (isAccessory ? 'Accessory' : '');
    const purchaseQty = parsePositiveIntQty(quantity, { allowEmpty: true, defaultVal: 1 });
    if (purchaseQty === null) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a whole number between 1 and 10,000.',
      });
    }
    const purchasePrice = parseNonNegativePrice(price, { allowEmpty: isAccessory, defaultVal: 0 });
    if (purchasePrice === null) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid non-negative number.',
      });
    }

    // Create Purchase Record
    const purchase = await Purchase.create({
      category,
      condition: condition === 'Used' ? 'Used' : 'New',
      status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA',
      companyName: companyName ? companyName.trim() : '',
      modelName: cleanModelName,
      quantity: purchaseQty,
      imei1: imei1 ? imei1.trim() : undefined,
      imei2: imei2 ? imei2.trim() : undefined,
      serialNumber: serialNumber ? serialNumber.trim() : '',
      customerName: customerName ? customerName.trim() : '',
      customerPhone: cleanedPhone,
      customerIdCard: cleanedIdCard,
      customerAddress: customerAddress ? customerAddress.trim() : '',
      idCardFront: frontUrl,
      idCardBack: backUrl,
      price: purchasePrice,
    });

    // Automatically sync with Inventory:
    // Match by modelName and condition (case-insensitive regex, safely escaped)
    let inventoryItem = await Inventory.findOne({
      modelName: { $regex: new RegExp(`^${escapeRegex(cleanModelName)}$`, 'i') },
      condition: condition === 'Used' ? 'Used' : 'New',
    });

    const imeisToAdd = [];
    if (imei1 && imei1.trim()) imeisToAdd.push(imei1.trim());
    if (imei2 && imei2.trim()) imeisToAdd.push(imei2.trim());

    const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;
    const unitPurchasePrice = purchaseQty > 0 ? Math.round((purchasePrice / purchaseQty) * 100) / 100 : purchasePrice;

    if (inventoryItem) {
      // Increment stock quantity
      inventoryItem.quantity += purchaseQty;
      inventoryItem.price = unitPurchasePrice; // sync unit price
      if (companyName) inventoryItem.companyName = companyName.trim();
      if (['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status)) inventoryItem.status = status;
      
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
        condition: condition === 'Used' ? 'Used' : 'New',
        status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA',
        companyName: companyName ? companyName.trim() : '',
        modelName: cleanModelName,
        quantity: purchaseQty,
        price: unitPurchasePrice,
        imeis: imeisToAdd,
      });
    }

    await logStockMovement({
      type: 'PURCHASE_IN',
      direction: 'IN',
      category,
      condition: condition === 'Used' ? 'Used' : 'New',
      status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA',
      companyName: companyName ? companyName.trim() : '',
      modelName: cleanModelName,
      imei1: imei1 ? imei1.trim() : '',
      imei2: imei2 ? imei2.trim() : '',
      quantityDelta: purchaseQty,
      previousStock: prevStock,
      resultingStock: prevStock + purchaseQty,
      unitPrice: unitPurchasePrice,
      totalAmount: purchasePrice,
      partyName: customerName ? customerName.trim() : '',
      partyPhone: cleanedPhone,
      purchaseId: purchase._id,
      inventoryId: inventoryItem._id,
      note: 'Purchased & added to inventory',
    });

    // Two-way Ledger sync when recorded on Credit / Partial Payment
    if (paymentType === 'ledger') {
      const parsedPaid = parseNonNegativePrice(paidAmount, { allowEmpty: true, defaultVal: 0 }) || 0;
      const safePaid = Math.min(parsedPaid, purchasePrice);
      let party = null;
      if (ledgerPartyId) {
        party = await LedgerParty.findById(ledgerPartyId);
      }
      const partyName = (customerName && customerName.trim()) || (companyName && companyName.trim()) || '';
      if (!party && partyName) {
        party = await LedgerParty.findOne({
          name: { $regex: new RegExp(`^${escapeRegex(partyName)}$`, 'i') },
          partyType: 'Supplier',
        });
        if (!party) {
          party = await LedgerParty.create({
            name: partyName,
            phone: cleanedPhone,
            partyType: 'Supplier',
            address: customerAddress ? customerAddress.trim() : '',
          });
        }
      }
      if (party) {
        await LedgerEntry.create({
          partyId: party._id,
          entryType: 'PURCHASE',
          category,
          condition: condition === 'Used' ? 'Used' : 'New',
          status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA',
          companyName: companyName ? companyName.trim() : '',
          modelName: cleanModelName,
          quantity: purchaseQty,
          unitPrice: purchaseQty > 0 ? Math.round((purchasePrice / purchaseQty) * 100) / 100 : purchasePrice,
          totalAmount: purchasePrice,
          paidAmount: safePaid,
          balanceDelta: purchasePrice - safePaid,
          paymentMethod: paymentMethod || 'Cash',
          purchaseId: purchase._id,
          inventoryId: inventoryItem._id,
          note: 'Recorded from Purchases',
          occurredAt: purchase.createdAt || new Date(),
        });
        await recomputePartyLedger(party._id);
      }
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
    const { sort = 'newest', search = '', category = '', condition = '' } = req.query;

    const query = {};

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
        { companyName: { $regex: escaped, $options: 'i' } },
        { customerName: { $regex: escaped, $options: 'i' } },
        { customerPhone: { $regex: escaped, $options: 'i' } },
        { customerIdCard: { $regex: escaped, $options: 'i' } },
        { customerAddress: { $regex: escaped, $options: 'i' } },
        { condition: { $regex: escaped, $options: 'i' } },
        { status: { $regex: escaped, $options: 'i' } },
        { imei1: { $regex: escaped, $options: 'i' } },
        { imei2: { $regex: escaped, $options: 'i' } },
        { serialNumber: { $regex: escaped, $options: 'i' } },
      ];
    }

    const sortOrder = sort === 'oldest' ? 1 : -1;
    const purchases = await Purchase.find(query).sort({ createdAt: sortOrder }).lean();

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
    const purchase = await Purchase.findById(req.params.id).lean();
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

// @desc    Delete purchase record and sync inventory stock
// @route   DELETE /api/purchases/:id
exports.deletePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id).lean();
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase record not found.',
      });
    }

    // Automatically sync inventory: reduce stock by 1 and remove IMEIs
    const condition = purchase.condition || 'New';
    const inventoryQuery = {
      modelName: { $regex: new RegExp(`^${escapeRegex((purchase.modelName || '').trim())}$`, 'i') },
      condition: condition,
    };

    const inventoryItem = await Inventory.findOne(inventoryQuery);
    const purchaseQty = Math.max(1, Number(purchase.quantity) || 1);
    const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;
    const nextStock = Math.max(0, prevStock - purchaseQty);

    if (inventoryItem) {
      inventoryItem.quantity = nextStock;
      if (purchase.imei1) {
        inventoryItem.imeis = inventoryItem.imeis.filter((im) => im !== purchase.imei1.trim());
      }
      if (purchase.imei2) {
        inventoryItem.imeis = inventoryItem.imeis.filter((im) => im !== purchase.imei2.trim());
      }

      if (inventoryItem.quantity <= 0 && (!inventoryItem.imeis || inventoryItem.imeis.length === 0)) {
        await Inventory.findByIdAndDelete(inventoryItem._id);
      } else {
        await inventoryItem.save();
      }
    }

    await logStockMovement({
      type: 'PURCHASE_REVERSAL',
      direction: 'OUT',
      category: purchase.category || 'Mobile',
      condition: condition,
      status: purchase.status || 'PTA',
      companyName: purchase.companyName || '',
      modelName: purchase.modelName || 'Accessory',
      imei1: purchase.imei1 || '',
      imei2: purchase.imei2 || '',
      quantityDelta: -purchaseQty,
      previousStock: prevStock,
      resultingStock: nextStock,
      unitPrice: Number(purchase.price) || 0,
      totalAmount: Number(purchase.price) || 0,
      partyName: purchase.customerName || '',
      partyPhone: purchase.customerPhone || '',
      inventoryId: inventoryItem ? inventoryItem._id : null,
      note: 'Purchase deleted & deducted from inventory',
    });

    // Safely delete purchase record after inventory sync
    await Purchase.findByIdAndDelete(req.params.id);

    // Also remove any linked Supplier Ledger entry and recompute balance
    const linkedEntries = await LedgerEntry.find({ purchaseId: req.params.id }).lean();
    if (linkedEntries.length > 0) {
      const affectedPartyIds = [...new Set(linkedEntries.map((e) => String(e.partyId)))];
      await LedgerEntry.deleteMany({ purchaseId: req.params.id });
      await Promise.all(affectedPartyIds.map((pid) => recomputePartyLedger(pid)));
    }

    return res.status(200).json({
      success: true,
      message: 'Purchase record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

