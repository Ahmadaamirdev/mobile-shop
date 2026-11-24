const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryById,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} = require('../controllers/inventoryController');

router.route('/')
  .get(getInventory)
  .post(createInventoryItem);

router.route('/:id')
  .get(getInventoryById)
  .put(updateInventoryItem)
  .delete(deleteInventoryItem);

module.exports = router;
