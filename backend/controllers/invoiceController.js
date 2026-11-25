const Invoice = require('../models/Invoice');
const Sale = require('../models/Sale');

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

// @desc    Generate new invoice (manual entry OR autofilled from sale)
// @route   POST /api/invoices
exports.createInvoice = async (req, res, next) => {
  try {
    const {
      saleId,
      customerName,
      customerNumber,
      modelName,
      modelNumber = '',
      condition = 'New',
      imei1 = '',
      imei2 = '',
      price,
      date,
    } = req.body;

    let invoiceDetails = {
      customerName,
      customerNumber,
      modelName,
      modelNumber,
      condition,
      imei1,
      imei2,
      price: price !== undefined ? Number(price) : undefined,
      date: date ? new Date(date) : new Date(),
    };

    // If generated from a specific sale, auto-fill details if not explicitly overridden
    if (saleId) {
      const sale = await Sale.findById(saleId);
      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Sale record not found for invoice auto-fill.',
        });
      }

      invoiceDetails.saleId = sale._id;
      invoiceDetails.customerName = customerName || sale.customerName;
      invoiceDetails.customerNumber = customerNumber || sale.customerNumber;
      invoiceDetails.modelName = modelName || sale.modelName;
      invoiceDetails.modelNumber = modelNumber || sale.modelNumber;
      invoiceDetails.condition = condition || sale.condition || 'New';
      invoiceDetails.imei1 = imei1 !== undefined && imei1 !== '' ? imei1 : (sale.imei1 || '');
      invoiceDetails.imei2 = imei2 !== undefined && imei2 !== '' ? imei2 : (sale.imei2 || '');
      // Price can be edited by user, or default to sale price
      invoiceDetails.price = price !== undefined && price !== '' ? Number(price) : sale.price;
    }

    if (!invoiceDetails.customerName || !invoiceDetails.customerNumber || !invoiceDetails.modelName || invoiceDetails.price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, customer number, model name, and price are required for invoice.',
      });
    }

    // Generate unique sequential invoice number
    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      invoiceNumber,
      ...invoiceDetails,
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
      query.condition = condition;
    }

    if (search.trim()) {
      const term = search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { invoiceNumber: { $regex: escaped, $options: 'i' } },
        { customerName: { $regex: escaped, $options: 'i' } },
        { customerNumber: { $regex: escaped, $options: 'i' } },
        { modelName: { $regex: escaped, $options: 'i' } },
        { modelNumber: { $regex: escaped, $options: 'i' } },
        { condition: { $regex: escaped, $options: 'i' } },
        { imei1: { $regex: escaped, $options: 'i' } },
        { imei2: { $regex: escaped, $options: 'i' } },
      ];
    }

    const invoices = await Invoice.find(query).sort({ date: -1, createdAt: -1 });

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
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found.',
      });
    }
    return res.status(200).json({
      success: true,
      data: invoice,
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
      modelName,
      modelNumber,
      condition,
      imei1,
      imei2,
      price,
      date,
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
      if (!customerNumber.trim()) {
        return res.status(400).json({ success: false, message: 'Customer phone number is required.' });
      }
      invoice.customerNumber = customerNumber.trim();
    }
    if (modelName !== undefined) {
      if (!modelName.trim()) {
        return res.status(400).json({ success: false, message: 'Device model name is required.' });
      }
      invoice.modelName = modelName.trim();
    }
    if (modelNumber !== undefined) invoice.modelNumber = modelNumber.trim();
    if (condition !== undefined) invoice.condition = condition;
    if (imei1 !== undefined) invoice.imei1 = imei1.trim();
    if (imei2 !== undefined) invoice.imei2 = imei2.trim();
    if (price !== undefined && price !== '') {
      if (isNaN(price) || Number(price) < 0) {
        return res.status(400).json({ success: false, message: 'Valid price is required.' });
      }
      invoice.price = Number(price);
    }
    if (date) {
      invoice.date = new Date(date);
    }

    const updatedInvoice = await invoice.save();

    return res.status(200).json({
      success: true,
      data: updatedInvoice,
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
