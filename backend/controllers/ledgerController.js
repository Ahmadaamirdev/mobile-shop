const LedgerParty = require('../models/LedgerParty');
const LedgerEntry = require('../models/LedgerEntry');
const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');
const { logStockMovement } = require('./recordController');
const { escapeRegex, parsePositiveIntQty, parseNonNegativePrice } = require('../utils/validators');

// Recompute running balances and supplier summary totals from chronological entries
const recomputePartyLedger = async (partyId) => {
  const party = await LedgerParty.findById(partyId);
  if (!party) return null;

  const entries = await LedgerEntry.find({ partyId }).sort({ occurredAt: 1, createdAt: 1 });

  let totalBilled = 0;
  let totalPaid = 0;
  let totalReturned = 0;
  let runningBalance = 0;

  for (const entry of entries) {
    if (entry.entryType === 'PURCHASE') {
      totalBilled += Number(entry.totalAmount) || 0;
      totalPaid += Number(entry.paidAmount) || 0;
    } else if (entry.entryType === 'PAYMENT') {
      totalPaid += Number(entry.totalAmount) || 0;
    } else if (entry.entryType === 'RETURN') {
      totalReturned += Number(entry.totalAmount) || 0;
    } else if (entry.entryType === 'ADJUSTMENT') {
      if (entry.balanceDelta >= 0) {
        totalBilled += Number(entry.balanceDelta) || 0;
      } else {
        totalPaid += Math.abs(Number(entry.balanceDelta) || 0);
      }
    }

    runningBalance += Number(entry.balanceDelta) || 0;
    if (entry.balanceAfter !== runningBalance) {
      entry.balanceAfter = runningBalance;
      await entry.save();
    }
  }

  party.totalBilled = totalBilled;
  party.totalPaid = totalPaid;
  party.totalReturned = totalReturned;
  party.balance = runningBalance;
  if (entries.length > 0) {
    party.lastActivityAt = entries[entries.length - 1].occurredAt || new Date();
  }
  await party.save();

  return party;
};

exports.recomputePartyLedger = recomputePartyLedger;

// @desc    Get all supplier ledger accounts with global payable summary
// @route   GET /api/ledger/parties
exports.getParties = async (req, res, next) => {
  try {
    const { status = 'All', search = '' } = req.query;

    const query = { partyType: 'Supplier' };
    if (status === 'pending') {
      query.balance = { $gt: 0 };
    } else if (status === 'settled') {
      query.balance = { $lte: 0 };
    }
    if (search.trim()) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { address: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [parties, allSuppliers] = await Promise.all([
      LedgerParty.find(query).sort({ balance: -1, lastActivityAt: -1 }).lean(),
      LedgerParty.find({ partyType: 'Supplier' })
        .select('balance totalBilled totalPaid totalReturned')
        .lean(),
    ]);

    const summary = {
      totalPayable: 0,
      pendingSuppliers: 0,
      totalPaid: 0,
      totalBilled: 0,
      totalReturned: 0,
      totalSuppliers: allSuppliers.length,
    };

    allSuppliers.forEach((p) => {
      const bal = Number(p.balance) || 0;
      if (bal > 0) {
        summary.totalPayable += bal;
        summary.pendingSuppliers += 1;
      }
      summary.totalPaid += Number(p.totalPaid) || 0;
      summary.totalBilled += Number(p.totalBilled) || 0;
      summary.totalReturned += Number(p.totalReturned) || 0;
    });

    return res.status(200).json({
      success: true,
      count: parties.length,
      summary,
      data: parties,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new Supplier ledger account
// @route   POST /api/ledger/parties
exports.createParty = async (req, res, next) => {
  try {
    const { name, phone = '', address = '', notes = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required.' });
    }

    const cleanedPhone = phone ? phone.replace(/\D/g, '') : '';
    if (phone && phone.trim() && cleanedPhone.length !== 11) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must contain exactly 11 digits when provided.',
      });
    }

    const existing = await LedgerParty.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') },
      partyType: 'Supplier',
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Supplier "${existing.name}" already exists in the ledger.`,
      });
    }

    const party = await LedgerParty.create({
      name: name.trim(),
      phone: cleanedPhone,
      partyType: 'Supplier',
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    return res.status(201).json({
      success: true,
      data: party,
      message: `Supplier account "${party.name}" created.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier details and chronological statement
// @route   GET /api/ledger/parties/:id
exports.getPartyStatement = async (req, res, next) => {
  try {
    const party = await LedgerParty.findById(req.params.id).lean();
    if (!party) {
      return res.status(404).json({ success: false, message: 'Supplier ledger account not found.' });
    }

    const entries = await LedgerEntry.find({ partyId: party._id })
      .sort({ occurredAt: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        party,
        entries,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a supplier ledger account
// @route   DELETE /api/ledger/parties/:id
exports.deleteParty = async (req, res, next) => {
  try {
    const party = await LedgerParty.findById(req.params.id);
    if (!party) {
      return res.status(404).json({ success: false, message: 'Supplier ledger account not found.' });
    }

    await LedgerEntry.deleteMany({ partyId: party._id });
    await LedgerParty.findByIdAndDelete(party._id);

    return res.status(200).json({
      success: true,
      message: `Supplier account "${party.name}" deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a Supplier transaction (PURCHASE, PAYMENT, RETURN) & sync Purchases / Inventory / Records
// @route   POST /api/ledger/parties/:id/entries
exports.addPartyEntry = async (req, res, next) => {
  try {
    const party = await LedgerParty.findById(req.params.id);
    if (!party) {
      return res.status(404).json({ success: false, message: 'Supplier ledger account not found.' });
    }

    const {
      entryType,
      category = 'Tablet',
      condition = 'New',
      status = 'PTA',
      companyName = '',
      modelName = '',
      quantity = 1,
      unitPrice,
      totalAmount,
      paidAmount = 0,
      paymentMethod = 'Cash',
      note = '',
      occurredAt,
    } = req.body;

    if (!['PURCHASE', 'PAYMENT', 'RETURN'].includes(entryType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry type. Must be PURCHASE, PAYMENT, or RETURN.',
      });
    }

    const entryDate = occurredAt ? new Date(occurredAt) : new Date();

    // 1. PAYMENT made to Supplier
    if (entryType === 'PAYMENT') {
      const parsedAmount = parseNonNegativePrice(totalAmount);
      if (parsedAmount === null || parsedAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount must be greater than zero.',
        });
      }

      const entry = await LedgerEntry.create({
        partyId: party._id,
        entryType: 'PAYMENT',
        totalAmount: parsedAmount,
        paidAmount: parsedAmount,
        balanceDelta: -parsedAmount,
        paymentMethod: paymentMethod || 'Cash',
        note: note ? note.trim() : `Payment made to ${party.name}`,
        occurredAt: entryDate,
      });

      const updatedParty = await recomputePartyLedger(party._id);
      return res.status(201).json({
        success: true,
        data: entry,
        party: updatedParty,
        message: `Payment of PKR ${parsedAmount.toLocaleString()} recorded for ${party.name}.`,
      });
    }

    // Item-based Supplier transactions: PURCHASE or RETURN
    const validCat = ['Mobile', 'Tablet', 'Accessory'].includes(category) ? category : 'Mobile';
    const validCond = condition === 'Used' ? 'Used' : 'New';
    const validStatus = ['PTA', 'JV', 'Non-PTA', 'CPID'].includes(status) ? status : 'PTA';
    const cleanModelName = modelName && modelName.trim() ? modelName.trim() : (validCat === 'Accessory' ? 'Accessory' : '');

    if (!cleanModelName) {
      return res.status(400).json({
        success: false,
        message: 'Model / Item name is required.',
      });
    }

    const qty = parsePositiveIntQty(quantity, { allowEmpty: false });
    if (qty === null) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a whole number of at least 1.',
      });
    }

    let computedTotal = parseNonNegativePrice(totalAmount, { allowEmpty: true, defaultVal: null });
    let computedUnit = parseNonNegativePrice(unitPrice, { allowEmpty: true, defaultVal: null });

    if (computedTotal !== null && computedTotal > 0) {
      if (computedUnit === null) {
        computedUnit = qty > 0 ? Math.round((computedTotal / qty) * 100) / 100 : computedTotal;
      }
    } else if (computedUnit !== null && computedUnit > 0) {
      computedTotal = computedUnit * qty;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount greater than zero.',
      });
    }

    const parsedPaid = parseNonNegativePrice(paidAmount, { allowEmpty: true, defaultVal: 0 });
    if (parsedPaid === null || parsedPaid > computedTotal) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount must be between 0 and total bill amount.',
      });
    }

    let purchaseDoc = null;
    let inventoryItem = null;
    let balanceDelta = 0;

    if (entryType === 'PURCHASE') {
      // Create synced Purchase record
      purchaseDoc = await Purchase.create({
        category: validCat,
        condition: validCond,
        status: validStatus,
        companyName: companyName ? companyName.trim() : '',
        modelName: cleanModelName,
        quantity: qty,
        customerName: party.name,
        customerPhone: party.phone || '',
        price: computedTotal,
      });

      // Sync Inventory (+qty)
      inventoryItem = await Inventory.findOne({
        modelName: { $regex: new RegExp(`^${escapeRegex(cleanModelName)}$`, 'i') },
        condition: validCond,
      });
      const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;

      if (inventoryItem) {
        inventoryItem.quantity += qty;
        inventoryItem.price = computedUnit;
        if (companyName && companyName.trim()) inventoryItem.companyName = companyName.trim();
        await inventoryItem.save();
      } else {
        inventoryItem = await Inventory.create({
          category: validCat,
          condition: validCond,
          status: validStatus,
          companyName: companyName ? companyName.trim() : '',
          modelName: cleanModelName,
          quantity: qty,
          price: computedUnit,
          imeis: [],
        });
      }

      await logStockMovement({
        type: 'PURCHASE_IN',
        direction: 'IN',
        category: validCat,
        condition: validCond,
        status: validStatus,
        companyName: companyName ? companyName.trim() : '',
        modelName: cleanModelName,
        quantityDelta: qty,
        previousStock: prevStock,
        resultingStock: prevStock + qty,
        unitPrice: computedUnit,
        totalAmount: computedTotal,
        partyName: party.name,
        partyPhone: party.phone || '',
        purchaseId: purchaseDoc._id,
        inventoryId: inventoryItem._id,
        occurredAt: entryDate,
        note: note ? note.trim() : `Ledger purchase (${party.name})`,
      });

      balanceDelta = computedTotal - parsedPaid;
    } else if (entryType === 'RETURN') {
      // Returning item(s) to Supplier -> verify & deduct from Inventory and deduct cost from payable balance
      inventoryItem = await Inventory.findOne({
        modelName: { $regex: new RegExp(`^${escapeRegex(cleanModelName)}$`, 'i') },
        condition: validCond,
      });

      if (validCat !== 'Accessory' && (!inventoryItem || inventoryItem.quantity < qty)) {
        return res.status(400).json({
          success: false,
          message: `Cannot return ${qty}x "${cleanModelName}": only ${inventoryItem ? inventoryItem.quantity : 0} available in Inventory.`,
        });
      }

      const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;
      const nextStock = Math.max(0, prevStock - qty);

      if (inventoryItem) {
        inventoryItem.quantity = nextStock;
        if (inventoryItem.quantity <= 0 && (!inventoryItem.imeis || inventoryItem.imeis.length === 0)) {
          await Inventory.findByIdAndDelete(inventoryItem._id);
        } else {
          await inventoryItem.save();
        }
      }

      await logStockMovement({
        type: 'PURCHASE_REVERSAL',
        direction: 'OUT',
        category: validCat,
        condition: validCond,
        status: validStatus,
        companyName: companyName ? companyName.trim() : (inventoryItem?.companyName || ''),
        modelName: cleanModelName,
        quantityDelta: -qty,
        previousStock: prevStock,
        resultingStock: nextStock,
        unitPrice: computedUnit,
        totalAmount: computedTotal,
        partyName: party.name,
        partyPhone: party.phone || '',
        inventoryId: inventoryItem ? inventoryItem._id : null,
        occurredAt: entryDate,
        note: note ? note.trim() : `Returned ${qty}x ${cleanModelName} to supplier`,
      });

      balanceDelta = -computedTotal;
    }

    const entry = await LedgerEntry.create({
      partyId: party._id,
      entryType,
      category: validCat,
      condition: validCond,
      status: validStatus,
      companyName: companyName ? companyName.trim() : '',
      modelName: cleanModelName,
      quantity: qty,
      unitPrice: computedUnit,
      totalAmount: computedTotal,
      paidAmount: entryType === 'RETURN' ? 0 : parsedPaid,
      balanceDelta,
      paymentMethod: paymentMethod || 'Cash',
      purchaseId: purchaseDoc ? purchaseDoc._id : null,
      inventoryId: inventoryItem ? inventoryItem._id : null,
      note: note ? note.trim() : '',
      occurredAt: entryDate,
    });

    const updatedParty = await recomputePartyLedger(party._id);

    return res.status(201).json({
      success: true,
      data: entry,
      party: updatedParty,
      message: `Supplier ${entryType.toLowerCase()} recorded and synced across Inventory, Purchases & Records.`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a ledger entry, sync Purchase/Inventory if linked, and recompute balance
// @route   DELETE /api/ledger/entries/:entryId
exports.deletePartyEntry = async (req, res, next) => {
  try {
    const entry = await LedgerEntry.findById(req.params.entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found.' });
    }

    const party = await LedgerParty.findById(entry.partyId);

    // If this was a ledger PURCHASE linked to a Purchase & Inventory, reverse stock and remove Purchase
    if (entry.entryType === 'PURCHASE' && entry.purchaseId) {
      const purchase = await Purchase.findByIdAndDelete(entry.purchaseId);
      if (purchase) {
        const qty = Math.max(1, Number(purchase.quantity) || 1);
        const inventoryItem = await Inventory.findOne({
          modelName: { $regex: new RegExp(`^${escapeRegex((purchase.modelName || '').trim())}$`, 'i') },
          condition: purchase.condition || 'New',
        });
        const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;
        const nextStock = Math.max(0, prevStock - qty);
        if (inventoryItem) {
          inventoryItem.quantity = nextStock;
          if (inventoryItem.quantity <= 0 && (!inventoryItem.imeis || inventoryItem.imeis.length === 0)) {
            await Inventory.findByIdAndDelete(inventoryItem._id);
          } else {
            await inventoryItem.save();
          }
        }
        await logStockMovement({
          type: 'PURCHASE_REVERSAL',
          direction: 'OUT',
          category: purchase.category || 'Mobile',
          condition: purchase.condition || 'New',
          status: purchase.status || 'PTA',
          companyName: purchase.companyName || '',
          modelName: purchase.modelName || 'Accessory',
          quantityDelta: -qty,
          previousStock: prevStock,
          resultingStock: nextStock,
          unitPrice: Number(purchase.price) || 0,
          totalAmount: Number(purchase.price) || 0,
          partyName: party?.name || purchase.customerName || '',
          partyPhone: party?.phone || purchase.customerPhone || '',
          inventoryId: inventoryItem ? inventoryItem._id : null,
          note: 'Reversed deleted supplier ledger purchase',
        });
      }
    } else if (entry.entryType === 'RETURN' && entry.modelName) {
      // Restore stock if a return entry is deleted
      const qty = Math.max(1, Number(entry.quantity) || 1);
      const validCond = entry.condition === 'Used' ? 'Used' : 'New';
      let inventoryItem = await Inventory.findOne({
        modelName: { $regex: new RegExp(`^${escapeRegex(entry.modelName.trim())}$`, 'i') },
        condition: validCond,
      });
      const prevStock = inventoryItem ? Number(inventoryItem.quantity) || 0 : 0;
      if (inventoryItem) {
        inventoryItem.quantity += qty;
        await inventoryItem.save();
      } else {
        inventoryItem = await Inventory.create({
          category: entry.category || 'Mobile',
          condition: validCond,
          status: entry.status || 'PTA',
          companyName: entry.companyName || '',
          modelName: entry.modelName.trim(),
          quantity: qty,
          price: Number(entry.unitPrice) || 0,
          imeis: [],
        });
      }
      await logStockMovement({
        type: 'PURCHASE_IN',
        direction: 'IN',
        category: entry.category || 'Mobile',
        condition: validCond,
        status: entry.status || 'PTA',
        companyName: entry.companyName || '',
        modelName: entry.modelName.trim(),
        quantityDelta: qty,
        previousStock: prevStock,
        resultingStock: prevStock + qty,
        unitPrice: Number(entry.unitPrice) || 0,
        totalAmount: Number(entry.totalAmount) || 0,
        partyName: party?.name || '',
        partyPhone: party?.phone || '',
        inventoryId: inventoryItem._id,
        note: 'Restored stock from deleted return entry',
      });
    }

    const partyId = entry.partyId;
    await LedgerEntry.findByIdAndDelete(entry._id);
    const updatedParty = await recomputePartyLedger(partyId);

    return res.status(200).json({
      success: true,
      party: updatedParty,
      message: 'Ledger entry deleted and synced across Inventory & Purchases.',
    });
  } catch (error) {
    next(error);
  }
};
