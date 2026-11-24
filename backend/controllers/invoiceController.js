const Invoice = require('../models/Invoice');
const Sale = require('../models/Sale');

// Helper to generate next invoice number (e.g. UM-1001)
const generateInvoiceNumber = async () => {
  const latestInvoice = await Invoice.findOne().sort({ createdAt: -1 });
  if (!latestInvoice || !latestInvoice.invoiceNumber) {
    return 'UM-1001';
  }
  const match = latestInvoice.invoiceNumber.match(/UM-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1], 10) + 1;
    return `UM-${nextNum}`;
  }
  return `UM-${Date.now()}`;
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
    const { search = '' } = req.query;

    const query = {};
    if (search.trim()) {
      const term = search.trim();
      query.$or = [
        { invoiceNumber: { $regex: term, $options: 'i' } },
        { customerName: { $regex: term, $options: 'i' } },
        { customerNumber: { $regex: term, $options: 'i' } },
        { modelName: { $regex: term, $options: 'i' } },
        { imei1: { $regex: term, $options: 'i' } },
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
