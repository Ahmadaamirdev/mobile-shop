const express = require('express');
const router = express.Router();
const {
  getParties,
  createParty,
  getPartyStatement,
  deleteParty,
  addPartyEntry,
  deletePartyEntry,
} = require('../controllers/ledgerController');

router.route('/parties').get(getParties).post(createParty);
router.route('/parties/:id').get(getPartyStatement).delete(deleteParty);
router.route('/parties/:id/entries').post(addPartyEntry);
router.route('/entries/:entryId').delete(deletePartyEntry);

module.exports = router;
