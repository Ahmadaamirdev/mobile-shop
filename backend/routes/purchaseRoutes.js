const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
} = require('../controllers/purchaseController');

router.route('/')
  .post(createPurchase)
  .get(getPurchases);

router.route('/:id')
  .get(getPurchaseById);

module.exports = router;
