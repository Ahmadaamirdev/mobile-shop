const express = require('express');
const router = express.Router();
const {
  createInvoice,
  getInvoices,
  getInvoiceById,
  deleteInvoice,
} = require('../controllers/invoiceController');

router.route('/')
  .post(createInvoice)
  .get(getInvoices);

router.route('/:id')
  .get(getInvoiceById)
  .delete(deleteInvoice);

module.exports = router;
