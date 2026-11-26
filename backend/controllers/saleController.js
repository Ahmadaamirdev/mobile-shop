const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');

// @desc    Record a new sale (single or multiple devices), check inventory, and auto-subtract stock
// @route   POST /api/sales
exports.createSale = async (req, res, next) => {
  try {
    const {
      category = 'Mobile',
      condition,
      modelName,
      modelNumber = '',
      customerName,
      customerNumber,
      imei1,
      imei2,
      price,
      items,
    } = req.body;

    if (!customerName || !customerName.trim() || !customerNumber || !customerNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and customer phone number are required.',
      });
    }

    const cleanedPhone = customerNumber.replace(/\D/g, '');
    if (cleanedPhone.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number must contain exactly 11 digits.',
      });
    }

    // Normalize input into a list of device items
    let rawItems = [];
    if (Array.isArray(items) && items.length > 0) {
      rawItems = items;
    } else if (modelName && price !== undefined) {
      rawItems = [
        {
          category,
          condition,
          modelName,
          modelNumber,
          imei1,
          imei2,
          price,
          quantity: 1,
        },
      ];
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one device with model name and price is required.',
      });
    }

    // Validate every item & resolve matching Inventory documents before deducting
    const resolvedEntries = [];
    const requestedQtyByInvId = new Map();

    for (let i = 0; i < rawItems.length; i++) {
      const it = rawItems[i];
      const itModel = it.modelName ? it.modelName.trim() : '';
      const itModelNum = it.modelNumber ? it.modelNumber.trim() : '';
      const itCondition = it.condition ? it.condition.trim() : '';
      const itCategory = it.category || 'Mobile';
      const itPrice = Number(it.price);
      const itQty = Number(it.quantity) || 1;
      const cleanImei1 = it.imei1 ? it.imei1.trim() : '';
      const cleanImei2 = it.imei2 ? it.imei2.trim() : '';

      if (!itModel || it.price === undefined || isNaN(itPrice) || itPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} requires a valid model name and price.`,
        });
      }

      if (cleanImei1 && !/^\d{15}$/.test(cleanImei1)) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} (${itModel}): IMEI 1 must be exactly 15 digits.`,
        });
      }
      if (cleanImei2 && !/^\d{15}$/.test(cleanImei2)) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} (${itModel}): IMEI 2 must be exactly 15 digits.`,
        });
      }

      let inventoryItem = null;
      if (it.inventoryId) {
        inventoryItem = await Inventory.findById(it.inventoryId);
      }
      if (!inventoryItem) {
        const inventoryQuery = {
          modelName: { $regex: new RegExp(`^${itModel}$`, 'i') },
          quantity: { $gt: 0 },
        };
        if (itModelNum) {
          inventoryQuery.modelNumber = { $regex: new RegExp(`^${itModelNum}$`, 'i') };
        }
        if (itCondition) {
          inventoryQuery.condition = itCondition;
        }
        inventoryItem = await Inventory.findOne(inventoryQuery);
      }

      if (!inventoryItem || inventoryItem.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Item "${itModel}" is not available in inventory or has zero stock. Sale cannot proceed.`,
        });
      }

      const invKey = String(inventoryItem._id);
      const newReqQty = (requestedQtyByInvId.get(invKey) || 0) + itQty;
      if (inventoryItem.quantity < newReqQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${inventoryItem.modelName}" (available: ${inventoryItem.quantity}, requested: ${newReqQty}).`,
        });
      }
      requestedQtyByInvId.set(invKey, newReqQty);

      if (cleanImei1 && inventoryItem.imeis && inventoryItem.imeis.length > 0) {
        if (!inventoryItem.imeis.includes(cleanImei1)) {
          return res.status(400).json({
            success: false,
            message: `IMEI ${cleanImei1} is not present in available inventory stock for ${inventoryItem.modelName}.`,
          });
        }
      }

      resolvedEntries.push({
        inventoryItem,
        saleItem: {
          category: inventoryItem.category || itCategory,
          condition: itCondition || inventoryItem.condition || 'New',
          status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(it.status)
            ? it.status
            : (inventoryItem.status || 'PTA'),
          modelName: inventoryItem.modelName,
          modelNumber: inventoryItem.modelNumber || itModelNum,
          imei1: cleanImei1 || undefined,
          imei2: cleanImei2 || undefined,
          price: itPrice,
          quantity: itQty,
        },
        cleanImei1,
        cleanImei2,
        itQty,
      });
    }

    const totalPrice = resolvedEntries.reduce(
      (sum, entry) => sum + entry.saleItem.price * entry.saleItem.quantity,
      0
    );
    const firstEntry = resolvedEntries[0].saleItem;

    // Create Sale with items array and top-level summary fields
    const sale = await Sale.create({
      category: firstEntry.category,
      condition: firstEntry.condition,
      status: firstEntry.status || 'PTA',
      modelName: resolvedEntries.map((e) => e.saleItem.modelName).join(', '),
      modelNumber: firstEntry.modelNumber || '',
      customerName: customerName.trim(),
      customerNumber: customerNumber.trim(),
      imei1: firstEntry.imei1,
      imei2: firstEntry.imei2,
      items: resolvedEntries.map((e) => e.saleItem),
      price: totalPrice,
    });

    // Deduct stock from inventory for every item
    const invUpdates = new Map();
    for (const entry of resolvedEntries) {
      const invId = String(entry.inventoryItem._id);
      const invDoc = invUpdates.get(invId) || entry.inventoryItem;
      invDoc.quantity -= entry.itQty;
      if (entry.cleanImei1) {
        invDoc.imeis = invDoc.imeis.filter((im) => im !== entry.cleanImei1);
      }
      if (entry.cleanImei2) {
        invDoc.imeis = invDoc.imeis.filter((im) => im !== entry.cleanImei2);
      }
      invUpdates.set(invId, invDoc);
    }

    for (const invDoc of invUpdates.values()) {
      if (invDoc.quantity <= 0) {
        await Inventory.findByIdAndDelete(invDoc._id);
      } else {
        await invDoc.save();
      }
    }

    return res.status(201).json({
      success: true,
      data: sale,
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
    const { search = '', category = '', condition = '' } = req.query;

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
        { modelNumber: { $regex: escaped, $options: 'i' } },
        { 'items.modelName': { $regex: escaped, $options: 'i' } },
        { 'items.modelNumber': { $regex: escaped, $options: 'i' } },
        { customerName: { $regex: escaped, $options: 'i' } },
        { customerNumber: { $regex: escaped, $options: 'i' } },
        { condition: { $regex: escaped, $options: 'i' } },
        { status: { $regex: escaped, $options: 'i' } },
        { 'items.status': { $regex: escaped, $options: 'i' } },
        { status: { $regex: escaped, $options: 'i' } },
        { 'items.status': { $regex: escaped, $options: 'i' } },
        { imei1: { $regex: escaped, $options: 'i' } },
        { imei2: { $regex: escaped, $options: 'i' } },
        { 'items.imei1': { $regex: escaped, $options: 'i' } },
        { 'items.imei2': { $regex: escaped, $options: 'i' } },
      ];
    }

    const sales = await Sale.find(query).sort({ createdAt: -1 }).lean();

    const saleIds = sales.map((s) => s._id);
    const linkedInvoices =
      saleIds.length > 0
        ? await Invoice.find({ saleId: { $in: saleIds } })
            .select('saleId invoiceNumber')
            .lean()
        : [];

    const invoiceBySaleId = new Map();
    linkedInvoices.forEach((inv) => {
      if (inv.saleId) {
        invoiceBySaleId.set(String(inv.saleId), inv.invoiceNumber);
      }
    });

    const salesWithInvoiceStatus = sales.map((s) => ({
      ...s,
      hasInvoice: invoiceBySaleId.has(String(s._id)),
      invoiceNumber: invoiceBySaleId.get(String(s._id)) || null,
    }));

    return res.status(200).json({
      success: true,
      count: salesWithInvoiceStatus.length,
      data: salesWithInvoiceStatus,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale by ID
// @route   GET /api/sales/:id
exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id).lean();
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
    const sale = await Sale.findById(req.params.id).lean();
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale record not found.',
      });
    }

    // Restore stock to inventory for every device in the sale
    const itemsToRestore =
      Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items
        : [
            {
              category: sale.category || 'Mobile',
              condition: sale.condition || 'New',
              modelName: sale.modelName,
              modelNumber: sale.modelNumber || '',
              imei1: sale.imei1,
              imei2: sale.imei2,
              price: sale.price,
              quantity: 1,
            },
          ];

    for (const sItem of itemsToRestore) {
      const condition = sItem.condition || 'New';
      const restoreQty = Number(sItem.quantity) || 1;
      const inventoryQuery = {
        modelName: { $regex: new RegExp(`^${(sItem.modelName || '').trim()}$`, 'i') },
        condition: condition,
      };
      if (sItem.modelNumber && sItem.modelNumber.trim()) {
        inventoryQuery.modelNumber = { $regex: new RegExp(`^${sItem.modelNumber.trim()}$`, 'i') };
      }

      let inventoryItem = await Inventory.findOne(inventoryQuery);

      if (inventoryItem) {
        inventoryItem.quantity += restoreQty;
        if (sItem.imei1 && !inventoryItem.imeis.includes(sItem.imei1)) {
          inventoryItem.imeis.push(sItem.imei1);
        }
        if (sItem.imei2 && !inventoryItem.imeis.includes(sItem.imei2)) {
          inventoryItem.imeis.push(sItem.imei2);
        }
        await inventoryItem.save();
      } else {
        await Inventory.create({
          category: sItem.category || 'Mobile',
          condition: condition,
          modelName: (sItem.modelName || '').trim(),
          modelNumber: sItem.modelNumber ? sItem.modelNumber.trim() : '',
          quantity: restoreQty,
          price: sItem.price,
          imeis: [sItem.imei1, sItem.imei2].filter(Boolean),
        });
      }
    }

    // Safely delete sale document after inventory restoration succeeds
    await Sale.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Sale record deleted and inventory stock restored.',
    });
  } catch (error) {
    next(error);
  }
};
