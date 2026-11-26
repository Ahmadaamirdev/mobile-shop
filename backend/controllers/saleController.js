const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const { logStockMovement } = require('./recordController');

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

    // Normalize input into a list of device items
    let rawItems = [];
    if (Array.isArray(items) && items.length > 0) {
      rawItems = items;
    } else if (modelName || price !== undefined || category === 'Accessory') {
      rawItems = [
        {
          category,
          condition,
          modelName: modelName || '',
          modelNumber,
          imei1,
          imei2,
          price: price !== undefined ? price : 0,
          quantity: 1,
        },
      ];
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one device with model name and price is required.',
      });
    }

    const isAccessoryOnlySale = rawItems.every((it) => (it.category || category) === 'Accessory');

    if (!isAccessoryOnlySale && (!customerName || !customerName.trim() || !customerNumber || !customerNumber.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and customer phone number are required.',
      });
    }

    const cleanedPhone = customerNumber ? customerNumber.replace(/\D/g, '') : '';
    if ((!isAccessoryOnlySale && cleanedPhone.length !== 11) || (isAccessoryOnlySale && customerNumber && customerNumber.trim() && cleanedPhone.length !== 11)) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone number must contain exactly 11 digits.',
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
      const isItemAccessory = itCategory === 'Accessory';
      const rawPrice = it.price === '' || it.price === undefined || it.price === null ? (isItemAccessory ? 0 : NaN) : Number(it.price);
      const itPrice = rawPrice;
      const itQty = Number(it.quantity) || 1;
      const cleanImei1 = it.imei1 ? it.imei1.trim() : '';
      const cleanImei2 = it.imei2 ? it.imei2.trim() : '';

      if (!isItemAccessory && (!itModel || it.price === undefined || isNaN(itPrice) || itPrice < 0)) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} requires a valid model name and price.`,
        });
      }
      if (isItemAccessory && (isNaN(itPrice) || itPrice < 0)) {
        return res.status(400).json({
          success: false,
          message: `Item #${i + 1} has an invalid price.`,
        });
      }

      if (cleanImei1 && !/^\d{15}$/.test(cleanImei1)) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} (${itModel || 'Accessory'}): IMEI 1 must be exactly 15 digits.`,
        });
      }
      if (cleanImei2 && !/^\d{15}$/.test(cleanImei2)) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} (${itModel || 'Accessory'}): IMEI 2 must be exactly 15 digits.`,
        });
      }

      let inventoryItem = null;
      if (it.inventoryId) {
        inventoryItem = await Inventory.findById(it.inventoryId);
      }
      if (!inventoryItem && itModel) {
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

      if (isItemAccessory && !itModel && !it.inventoryId) {
        resolvedEntries.push({
          inventoryItem: null,
          saleItem: {
            category: 'Accessory',
            condition: itCondition || 'New',
            status: ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(it.status) ? it.status : 'PTA',
            modelName: 'Accessory',
            modelNumber: itModelNum,
            imei1: cleanImei1 || undefined,
            imei2: cleanImei2 || undefined,
            price: itPrice,
            quantity: itQty,
          },
          cleanImei1,
          cleanImei2,
          itQty,
        });
        continue;
      }

      if (!inventoryItem || inventoryItem.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Item "${itModel || 'Accessory'}" is not available in inventory or has zero stock. Sale cannot proceed.`,
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
      customerName: customerName ? customerName.trim() : '',
      customerNumber: cleanedPhone,
      imei1: firstEntry.imei1,
      imei2: firstEntry.imei2,
      items: resolvedEntries.map((e) => e.saleItem),
      price: totalPrice,
    });

    // Deduct stock from inventory for every item and record stock ledger movements
    const invUpdates = new Map();
    for (const entry of resolvedEntries) {
      if (!entry.inventoryItem) {
        await logStockMovement({
          type: 'SALE_OUT',
          direction: 'OUT',
          category: entry.saleItem.category,
          condition: entry.saleItem.condition,
          status: entry.saleItem.status || 'PTA',
          modelName: entry.saleItem.modelName,
          modelNumber: entry.saleItem.modelNumber || '',
          imei1: entry.cleanImei1 || '',
          imei2: entry.cleanImei2 || '',
          quantityDelta: -entry.itQty,
          previousStock: 0,
          resultingStock: 0,
          unitPrice: entry.saleItem.price,
          totalAmount: entry.saleItem.price * entry.itQty,
          partyName: customerName ? customerName.trim() : '',
          partyPhone: cleanedPhone,
          saleId: sale._id,
          note: 'Accessory sold (no inventory link)',
        });
        continue;
      }

      const invId = String(entry.inventoryItem._id);
      const invDoc = invUpdates.get(invId) || entry.inventoryItem;
      const prevStock = Number(invDoc.quantity) || 0;
      const nextStock = Math.max(0, prevStock - entry.itQty);
      invDoc.quantity = nextStock;
      if (entry.cleanImei1) {
        invDoc.imeis = invDoc.imeis.filter((im) => im !== entry.cleanImei1);
      }
      if (entry.cleanImei2) {
        invDoc.imeis = invDoc.imeis.filter((im) => im !== entry.cleanImei2);
      }
      invUpdates.set(invId, invDoc);

      await logStockMovement({
        type: 'SALE_OUT',
        direction: 'OUT',
        category: entry.saleItem.category,
        condition: entry.saleItem.condition,
        status: entry.saleItem.status || 'PTA',
        companyName: invDoc.companyName || '',
        modelName: entry.saleItem.modelName,
        modelNumber: entry.saleItem.modelNumber || '',
        imei1: entry.cleanImei1 || '',
        imei2: entry.cleanImei2 || '',
        quantityDelta: -entry.itQty,
        previousStock: prevStock,
        resultingStock: nextStock,
        unitPrice: entry.saleItem.price,
        totalAmount: entry.saleItem.price * entry.itQty,
        partyName: customerName ? customerName.trim() : '',
        partyPhone: cleanedPhone,
        saleId: sale._id,
        inventoryId: invDoc._id,
        note: 'Sold & subtracted from inventory',
      });
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
      const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;

      if (inventoryItem) {
        inventoryItem.quantity += restoreQty;
        if (sItem.imei1 && !inventoryItem.imeis.includes(sItem.imei1)) {
          inventoryItem.imeis.push(sItem.imei1);
        }
        if (sItem.imei2 && !inventoryItem.imeis.includes(sItem.imei2)) {
          inventoryItem.imeis.push(sItem.imei2);
        }
        await inventoryItem.save();
      } else if (sItem.modelName) {
        inventoryItem = await Inventory.create({
          category: sItem.category || 'Mobile',
          condition: condition,
          status: sItem.status || 'PTA',
          modelName: (sItem.modelName || '').trim(),
          modelNumber: sItem.modelNumber ? sItem.modelNumber.trim() : '',
          quantity: restoreQty,
          price: sItem.price,
          imeis: [sItem.imei1, sItem.imei2].filter(Boolean),
        });
      }

      await logStockMovement({
        type: 'SALE_RESTORE',
        direction: 'IN',
        category: sItem.category || 'Mobile',
        condition: condition,
        status: sItem.status || 'PTA',
        companyName: inventoryItem?.companyName || '',
        modelName: sItem.modelName || 'Accessory',
        modelNumber: sItem.modelNumber || '',
        imei1: sItem.imei1 || '',
        imei2: sItem.imei2 || '',
        quantityDelta: restoreQty,
        previousStock: prevStock,
        resultingStock: prevStock + restoreQty,
        unitPrice: Number(sItem.price) || 0,
        totalAmount: (Number(sItem.price) || 0) * restoreQty,
        partyName: sale.customerName || '',
        partyPhone: sale.customerNumber || '',
        inventoryId: inventoryItem ? inventoryItem._id : null,
        note: 'Sale deleted & stock restored to inventory',
      });
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
