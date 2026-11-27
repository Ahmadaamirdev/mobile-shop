const Invoice = require('../models/Invoice');
const Sale = require('../models/Sale');
const { parsePositiveIntQty, parseNonNegativePrice } = require('../utils/validators');

// Helper to generate next unique invoice number (e.g. UM-1001)
const generateInvoiceNumber = async () => {
  const latestInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  let nextNum = 1001;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const match = latestInvoice.invoiceNumber.match(/UM-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  let candidate = `UM-${nextNum}`;
  let exists = await Invoice.findOne({ invoiceNumber: candidate });
  while (exists) {
    nextNum += 1;
    candidate = `UM-${nextNum}`;
    exists = await Invoice.findOne({ invoiceNumber: candidate });
  }

  return candidate;
};

// Normalize invoice items for response (guarantees an items array even on legacy records)
const normalizeInvoiceItems = (invoice) => {
  if (invoice.items && invoice.items.length > 0) {
    return invoice;
  }
  // Construct items from top-level fields for backward compatibility
  const fallbackItem = {
    modelName: invoice.modelName || 'Device Sale',
    modelNumber: invoice.modelNumber || '',
    condition: invoice.condition || 'New',
    imei1: invoice.imei1 || '',
    imei2: invoice.imei2 || '',
    price: invoice.price !== undefined ? invoice.price : 0,
    quantity: 1,
  };
  return {
    ...invoice,
    items: [fallbackItem],
  };
};

// @desc    Generate new invoice (manual entry with multiple devices OR autofilled from sale)
// @route   POST /api/invoices
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      saleId,
      customerName,
      customerNumber,
      items,
      modelName,
      modelNumber = '',
      condition = 'New',
      imei1 = '',
      imei2 = '',
      price,
      date,
      paymentMode = 'Cash / Instant',
    } = req.body;

    let deviceItems = [];

    if (Array.isArray(items) && items.length > 0) {
      deviceItems = items.map((it) => ({
        modelName: it.modelName ? it.modelName.trim() : '',
        modelNumber: it.modelNumber ? it.modelNumber.trim() : '',
        condition: it.condition === 'Used' ? 'Used' : 'New',
        imei1: it.imei1 ? it.imei1.trim() : '',
        imei2: it.imei2 ? it.imei2.trim() : '',
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
      }));
    } else if (modelName && modelName.trim()) {
      // Single device fallback
      deviceItems = [
        {
          modelName: modelName.trim(),
          modelNumber: modelNumber ? modelNumber.trim() : '',
          condition: condition === 'Used' ? 'Used' : 'New',
          imei1: imei1 ? imei1.trim() : '',
          imei2: imei2 ? imei2.trim() : '',
          price: Number(price) || 0,
          quantity: 1,
        },
      ];
    } else if (saleId) {
      const sale = await Sale.findById(saleId);
      if (sale) {
        deviceItems = [
          {
            modelName: sale.modelName,
            modelNumber: sale.modelNumber || '',
            condition: sale.condition || 'New',
            imei1: sale.imei1 || '',
            imei2: sale.imei2 || '',
            price: Number(sale.price) || 0,
            quantity: 1,
          },
        ];
      }
    }

    if (!customerName?.trim() || !customerNumber?.trim()) {
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

    if (deviceItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one device item is required in the invoice.',
      });
    }

    // Validate each device item
    for (let i = 0; i < deviceItems.length; i++) {
      const it = deviceItems[i];
      if (!it.modelName) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} model name is required.`,
        });
      }
      const validPrice = parseNonNegativePrice(it.price);
      if (validPrice === null) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} (${it.modelName}) must have a valid non-negative price.`,
        });
      }
      const validQty = parsePositiveIntQty(it.quantity, { allowEmpty: true, defaultVal: 1 });
      if (validQty === null) {
        return res.status(400).json({
          success: false,
          message: `Device #${i + 1} (${it.modelName}) quantity must be a whole number between 1 and 10,000.`,
        });
      }
      it.price = validPrice;
      it.quantity = validQty;
    }

    // Calculate total price across all devices
    const totalPrice = deviceItems.reduce(
      (sum, it) => sum + it.price * (it.quantity || 1),
      0
    );

    // Prevent duplicate invoices if identical customer, price, and devices already exist
    const escapedName = customerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedPhone = customerNumber.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const potentialDuplicates = await Invoice.find({
      customerName: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      customerNumber: { $regex: new RegExp(`^${escapedPhone}$`, 'i') },
      price: totalPrice,
    }).sort({ createdAt: -1 });

    const isSameDevices = (itemsA, itemsB) => {
      if (!itemsA || !itemsB) return false;
      if (itemsA.length !== itemsB.length) return false;

      for (let i = 0; i < itemsA.length; i++) {
        const a = itemsA[i];
        const match = itemsB.find(
          (b) =>
            b.modelName?.trim().toLowerCase() === a.modelName?.trim().toLowerCase() &&
            (b.modelNumber || '').trim().toLowerCase() === (a.modelNumber || '').trim().toLowerCase() &&
            Number(b.price) === Number(a.price) &&
            (a.imei1 ? (b.imei1 || '').trim() === a.imei1.trim() : true)
        );
        if (!match) return false;
      }
      return true;
    };

    let duplicateInvoice = null;
    for (const existing of potentialDuplicates) {
      const existingItems = existing.items && existing.items.length > 0
        ? existing.items
        : [
            {
              modelName: existing.modelName,
              modelNumber: existing.modelNumber,
              condition: existing.condition,
              imei1: existing.imei1,
              imei2: existing.imei2,
              price: existing.price,
              quantity: 1,
            },
          ];

      if (isSameDevices(deviceItems, existingItems)) {
        duplicateInvoice = existing;
        break;
      }
    }

    if (duplicateInvoice) {
      if (!duplicateInvoice.saleId && saleId) {
        duplicateInvoice.saleId = saleId;
        await duplicateInvoice.save();
      }
      return res.status(200).json({
        success: true,
        data: normalizeInvoiceItems(duplicateInvoice.toObject ? duplicateInvoice.toObject() : duplicateInvoice),
        isDuplicate: true,
        message: `An identical invoice already exists (${duplicateInvoice.invoiceNumber}). Duplicate prevented; loaded existing record.`,
      });
    }

    const firstItem = deviceItems[0];
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      saleId: saleId || null,
      date: date ? new Date(date) : new Date(),
      customerName: customerName.trim(),
      customerNumber: customerNumber.trim(),
      items: deviceItems,
      // Compatibility fields
      modelName: deviceItems.map((d) => d.modelName).join(', '),
      modelNumber: firstItem.modelNumber || '',
      condition: firstItem.condition || 'New',
      imei1: firstItem.imei1 || '',
      imei2: firstItem.imei2 || '',
      price: totalPrice,
      paymentMode: paymentMode ? paymentMode.trim() : 'Cash / Instant',
    });

    return res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice generated and saved successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all invoices (history / records)
// @route   GET /api/invoices
exports.getInvoices = async (req, res, next) => {
  try {
    const { search = '', condition = '' } = req.query;

    const query = {};

    if (condition && condition !== 'All') {
      query.$or = [
        { condition: condition },
        { 'items.condition': condition },
      ];
    }

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchOr = [
        { invoiceNumber: { $regex: escaped, $options: 'i' } },
        { customerName: { $regex: escaped, $options: 'i' } },
        { customerNumber: { $regex: escaped, $options: 'i' } },
        { modelName: { $regex: escaped, $options: 'i' } },
        { modelNumber: { $regex: escaped, $options: 'i' } },
        { condition: { $regex: escaped, $options: 'i' } },
        { imei1: { $regex: escaped, $options: 'i' } },
        { imei2: { $regex: escaped, $options: 'i' } },
        { 'items.modelName': { $regex: escaped, $options: 'i' } },
        { 'items.modelNumber': { $regex: escaped, $options: 'i' } },
        { 'items.imei1': { $regex: escaped, $options: 'i' } },
        { 'items.imei2': { $regex: escaped, $options: 'i' } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const rawInvoices = await Invoice.find(query).sort({ date: -1, createdAt: -1 }).lean();
    const invoices = rawInvoices.map(normalizeInvoiceItems);

    return res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single invoice by ID
// @route   GET /api/invoices/:id
exports.getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
      });
    }
    return res.status(200).json({
      success: true,
      data: normalizeInvoiceItems(invoice),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update existing invoice record
// @route   PUT /api/invoices/:id
exports.updateInvoice = async (req, res, next) => {
  try {
    const {
      customerName,
      customerNumber,
      items,
      modelName,
      modelNumber,
      condition,
      imei1,
      imei2,
      price,
      date,
      paymentMode,
    } = req.body;

    let invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice record not found.',
      });
    }

    if (customerName !== undefined) {
      if (!customerName.trim()) {
        return res.status(400).json({ success: false, message: 'Customer name is required.' });
      }
      invoice.customerName = customerName.trim();
    }
    if (customerNumber !== undefined) {
      const cleanedPhone = customerNumber ? customerNumber.replace(/\D/g, '') : '';
      if (cleanedPhone.length !== 11) {
        return res.status(400).json({
          success: false,
          message: 'Customer phone number must contain exactly 11 digits.',
        });
      }
      invoice.customerNumber = cleanedPhone;
    }
    if (date) {
      invoice.date = new Date(date);
    }
    if (paymentMode !== undefined) {
      invoice.paymentMode = paymentMode.trim() || 'Cash / Instant';
    }

    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.modelName || !it.modelName.trim()) {
          return res.status(400).json({
            success: false,
            message: `Device #${i + 1} model name is required.`,
          });
        }
        if (it.price === undefined || isNaN(it.price) || Number(it.price) < 0) {
          return res.status(400).json({
            success: false,
            message: `Device #${i + 1} (${it.modelName}) must have a valid price.`,
          });
        }
      }

      invoice.items = items.map((it) => ({
        modelName: it.modelName.trim(),
        modelNumber: it.modelNumber ? it.modelNumber.trim() : '',
        condition: it.condition === 'Used' ? 'Used' : 'New',
        imei1: it.imei1 ? it.imei1.trim() : '',
        imei2: it.imei2 ? it.imei2.trim() : '',
        price: Number(it.price),
        quantity: Number(it.quantity) || 1,
      }));

      invoice.price = invoice.items.reduce(
        (sum, it) => sum + it.price * (it.quantity || 1),
        0
      );
      invoice.modelName = invoice.items.map((it) => it.modelName).join(', ');
      if (invoice.items[0]) {
        invoice.modelNumber = invoice.items[0].modelNumber || '';
        invoice.condition = invoice.items[0].condition || 'New';
        invoice.imei1 = invoice.items[0].imei1 || '';
        invoice.imei2 = invoice.items[0].imei2 || '';
      }
    } else if (modelName !== undefined) {
      // Legacy single device update
      invoice.modelName = modelName.trim();
      if (modelNumber !== undefined) invoice.modelNumber = modelNumber.trim();
      if (condition !== undefined) invoice.condition = condition;
      if (imei1 !== undefined) invoice.imei1 = imei1.trim();
      if (imei2 !== undefined) invoice.imei2 = imei2.trim();
      if (price !== undefined && price !== '') invoice.price = Number(price);

      invoice.items = [
        {
          modelName: invoice.modelName,
          modelNumber: invoice.modelNumber,
          condition: invoice.condition,
          imei1: invoice.imei1,
          imei2: invoice.imei2,
          price: invoice.price,
          quantity: 1,
        },
      ];
    }

    const updatedInvoice = await invoice.save();

    return res.status(200).json({
      success: true,
      data: normalizeInvoiceItems(updatedInvoice.toObject()),
      message: 'Invoice updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete invoice record
// @route   DELETE /api/invoices/:id
exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Invoice record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
