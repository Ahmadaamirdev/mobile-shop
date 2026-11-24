const express = require('express');
const router = express.Router();
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  deletePurchase,
} = require('../controllers/purchaseController');

router.route('/')
  .post(createPurchase)
  .get(getPurchases);

router.route('/:id')
  .get(getPurchaseById)
  .delete(deletePurchase);

module.exports = router;
