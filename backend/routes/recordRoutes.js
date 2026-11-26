const express = require('express');
const router = express.Router();
const { getRecords } = require('../controllers/recordController');

router.get('/', getRecords);

module.exports = router;
