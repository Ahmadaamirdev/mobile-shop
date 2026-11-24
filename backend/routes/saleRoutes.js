const express = require('express');
const router = express.Router();
const {
  createSale,
  getSales,
  getSaleById,
  deleteSale,
} = require('../controllers/saleController');

router.route('/')
  .post(createSale)
  .get(getSales);

router.route('/:id')
  .get(getSaleById)
  .delete(deleteSale);

module.exports = router;
