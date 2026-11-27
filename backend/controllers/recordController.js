const StockRecord = require('../models/StockRecord');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');

const toDateKey = (dateInput, tzOffsetMin = -300) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const baseMs = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
  const offsetMs = Number.isFinite(tzOffsetMin) ? tzOffsetMin * 60000 : -300 * 60000;
  // Shift UTC time by -tzOffsetMin so UTC getters represent local calendar date
  const shifted = new Date(baseMs - offsetMs);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
};

const buildOccurredAtMatch = (startDate, endDate, date, tzOffsetMin = -300) => {
  const offsetMs = Number.isFinite(tzOffsetMin) ? tzOffsetMin * 60000 : -300 * 60000;
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    if (y && m && d) {
      return {
        $gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs),
        $lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offsetMs),
      };
    }
  }
  const range = {};
  if (startDate) {
    const [y, m, d] = startDate.split('-').map(Number);
    if (y && m && d) range.$gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs);
  }
  if (endDate) {
    const [y, m, d] = endDate.split('-').map(Number);
    if (y && m && d) range.$lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offsetMs);
  }
  return Object.keys(range).length ? range : null;
};

// Helper used by controllers to record a stock movement synchronously/safely
exports.logStockMovement = async (payload) => {
  try {
    const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
    return await StockRecord.create({
      ...payload,
      occurredAt,
      dateKey: payload.dateKey || toDateKey(occurredAt),
    });
  } catch (err) {
    console.error('StockRecord logging warning:', err.message);
    return null;
  }
};

// Idempotently backfill historical Purchases & Sales that happened before StockRecord existed
const syncMissingHistoricalRecords = async () => {
  const [existingPurchaseIds, existingSaleIds, allPurchases, allSales] = await Promise.all([
    StockRecord.distinct('purchaseId', { purchaseId: { $ne: null } }),
    StockRecord.distinct('saleId', { saleId: { $ne: null } }),
    Purchase.find({}).sort({ createdAt: 1 }).lean(),
    Sale.find({}).sort({ createdAt: 1 }).lean(),
  ]);

  const recordedPurchases = new Set(existingPurchaseIds.map(String));
  const recordedSales = new Set(existingSaleIds.map(String));

  const missingEvents = [];

  allPurchases.forEach((p) => {
    if (!recordedPurchases.has(String(p._id))) {
      const qty = Math.max(1, Number(p.quantity) || 1);
      missingEvents.push({
        sortTime: new Date(p.createdAt || Date.now()).getTime(),
        doc: {
          type: 'PURCHASE_IN',
          direction: 'IN',
          category: p.category || 'Mobile',
          condition: p.condition || 'New',
          status: p.status || 'PTA',
          companyName: p.companyName || '',
          modelName: p.modelName || 'Accessory',
          modelNumber: p.modelNumber || '',
          imei1: p.imei1 || '',
          imei2: p.imei2 || '',
          quantityDelta: qty,
          unitPrice: Number(p.price) || 0,
          totalAmount: Number(p.price) || 0,
          partyName: p.customerName || '',
          partyPhone: p.customerPhone || '',
          occurredAt: p.createdAt || new Date(),
          dateKey: toDateKey(p.createdAt),
          purchaseId: p._id,
          note: 'Purchased & added to inventory',
        },
      });
    }
  });

  allSales.forEach((s) => {
    if (!recordedSales.has(String(s._id))) {
      const itemsList = Array.isArray(s.items) && s.items.length > 0
        ? s.items
        : [
            {
              category: s.category || 'Mobile',
              condition: s.condition || 'New',
              status: s.status || 'PTA',
              modelName: s.modelName || 'Accessory',
              modelNumber: s.modelNumber || '',
              imei1: s.imei1 || '',
              imei2: s.imei2 || '',
              price: Number(s.price) || 0,
              quantity: 1,
            },
          ];

      itemsList.forEach((it) => {
        const qty = Math.max(1, Number(it.quantity) || 1);
        const unitPrice = Number(it.price) || 0;
        missingEvents.push({
          sortTime: new Date(s.createdAt || Date.now()).getTime(),
          doc: {
            type: 'SALE_OUT',
            direction: 'OUT',
            category: it.category || s.category || 'Mobile',
            condition: it.condition || s.condition || 'New',
            status: it.status || s.status || 'PTA',
            companyName: '',
            modelName: it.modelName || s.modelName || 'Accessory',
            modelNumber: it.modelNumber || '',
            imei1: it.imei1 || '',
            imei2: it.imei2 || '',
            quantityDelta: -qty,
            unitPrice,
            totalAmount: unitPrice * qty,
            partyName: s.customerName || '',
            partyPhone: s.customerNumber || '',
            occurredAt: s.createdAt || new Date(),
            dateKey: toDateKey(s.createdAt),
            saleId: s._id,
            note: 'Sold & subtracted from inventory',
          },
        });
      });
    }
  });

  if (missingEvents.length === 0) return;

  // Replay chronologically to reconstruct previousStock -> resultingStock
  missingEvents.sort((a, b) => a.sortTime - b.sortTime);
  const runningBalance = new Map();
  const docsToInsert = missingEvents.map(({ doc }) => {
    const key = `${(doc.modelName || '').trim().toLowerCase()}|${(doc.modelNumber || '').trim().toLowerCase()}|${doc.condition || 'New'}`;
    const prev = runningBalance.get(key) || 0;
    const next = Math.max(0, prev + doc.quantityDelta);
    runningBalance.set(key, next);
    return {
      ...doc,
      previousStock: prev,
      resultingStock: next,
    };
  });

  await StockRecord.insertMany(docsToInsert, { ordered: false });
};

// @desc    Get daily synchronized stock records connecting Purchases, Sales & Inventory
// @route   GET /api/records
exports.getRecords = async (req, res, next) => {
  try {
    await syncMissingHistoricalRecords();

    const {
      startDate = '',
      endDate = '',
      date = '',
      type = 'all',
      category = 'All',
      search = '',
    } = req.query;
    const tzOffsetMin = req.query.tzOffset !== undefined ? Number(req.query.tzOffset) : -300;
    const occurredAtRange = buildOccurredAtMatch(startDate, endDate, date, tzOffsetMin);

    const query = {};

    if (occurredAtRange) {
      query.occurredAt = occurredAtRange;
    }

    if (type === 'in') {
      query.direction = 'IN';
    } else if (type === 'out') {
      query.direction = 'OUT';
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { modelName: { $regex: escaped, $options: 'i' } },
        { modelNumber: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { partyName: { $regex: escaped, $options: 'i' } },
        { partyPhone: { $regex: escaped, $options: 'i' } },
        { imei1: { $regex: escaped, $options: 'i' } },
        { imei2: { $regex: escaped, $options: 'i' } },
        { note: { $regex: escaped, $options: 'i' } },
      ];
    }

    const reconQuery = {};
    if (category && category !== 'All') reconQuery.category = category;
    if (occurredAtRange) reconQuery.occurredAt = occurredAtRange;

    const [movements, allMovementsForReconciliation, liveInventory] = await Promise.all([
      StockRecord.find(query).sort({ occurredAt: -1 }).lean(),
      StockRecord.find(reconQuery)
        .sort({ occurredAt: 1 })
        .lean(),
      Inventory.find(category && category !== 'All' ? { category } : {}).lean(),
    ]);

    // Map live inventory by model+modelNumber+condition AND by id
    const invById = new Map();
    const invByKey = new Map();
    liveInventory.forEach((inv) => {
      invById.set(String(inv._id), inv);
      const key = `${(inv.modelName || '').trim().toLowerCase()}|${(inv.modelNumber || '').trim().toLowerCase()}|${inv.condition || 'New'}`;
      invByKey.set(key, inv);
    });

    // Attach current live inventory status to each movement and group by day
    const dayMap = new Map();
    let totalAddedUnits = 0;
    let totalAddedValue = 0;
    let totalSubtractedUnits = 0;
    let totalSubtractedValue = 0;

    movements.forEach((m) => {
      const key = `${(m.modelName || '').trim().toLowerCase()}|${(m.modelNumber || '').trim().toLowerCase()}|${m.condition || 'New'}`;
      const matchedInv = (m.inventoryId && invById.get(String(m.inventoryId))) || invByKey.get(key) || null;
      const liveQty = matchedInv ? Number(matchedInv.quantity) || 0 : 0;

      const enriched = {
        ...m,
        liveStock: liveQty,
        inInventory: Boolean(matchedInv && liveQty > 0),
      };

      if (!dayMap.has(m.dateKey)) {
        dayMap.set(m.dateKey, {
          date: m.dateKey,
          purchasedCount: 0,
          purchasedUnits: 0,
          purchasedAmount: 0,
          soldCount: 0,
          soldUnits: 0,
          soldAmount: 0,
          netUnits: 0,
          transactions: [],
        });
      }

      const dayBucket = dayMap.get(m.dateKey);
      const absQty = Math.abs(Number(m.quantityDelta) || 0);
      const amt = Number(m.totalAmount) || 0;

      if (m.direction === 'IN') {
        dayBucket.purchasedCount += 1;
        dayBucket.purchasedUnits += absQty;
        dayBucket.purchasedAmount += amt;
        dayBucket.netUnits += absQty;
        totalAddedUnits += absQty;
        totalAddedValue += amt;
      } else {
        dayBucket.soldCount += 1;
        dayBucket.soldUnits += absQty;
        dayBucket.soldAmount += amt;
        dayBucket.netUnits -= absQty;
        totalSubtractedUnits += absQty;
        totalSubtractedValue += amt;
      }

      dayBucket.transactions.push(enriched);
    });

    const days = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Build Model-by-Model Inventory Reconciliation linking Purchased vs Sold vs Live Stock
    const modelLedgerMap = new Map();
    allMovementsForReconciliation.forEach((m) => {
      const key = `${(m.modelName || '').trim().toLowerCase()}|${(m.modelNumber || '').trim().toLowerCase()}|${m.condition || 'New'}`;
      if (!modelLedgerMap.has(key)) {
        const matchedInv = invByKey.get(key);
        modelLedgerMap.set(key, {
          key,
          modelName: m.modelName || 'Accessory',
          modelNumber: m.modelNumber || '',
          companyName: m.companyName || matchedInv?.companyName || '',
          category: m.category || matchedInv?.category || 'Mobile',
          condition: m.condition || 'New',
          purchasedUnits: 0,
          purchasedAmount: 0,
          soldUnits: 0,
          soldAmount: 0,
          liveStock: matchedInv ? Number(matchedInv.quantity) || 0 : 0,
          lastActivityAt: m.occurredAt,
        });
      }

      const row = modelLedgerMap.get(key);
      const absQty = Math.abs(Number(m.quantityDelta) || 0);
      const amt = Number(m.totalAmount) || 0;
      if (m.direction === 'IN') {
        row.purchasedUnits += absQty;
        row.purchasedAmount += amt;
      } else {
        row.soldUnits += absQty;
        row.soldAmount += amt;
      }
      if (!row.companyName && m.companyName) row.companyName = m.companyName;
      if (new Date(m.occurredAt) > new Date(row.lastActivityAt)) {
        row.lastActivityAt = m.occurredAt;
      }
    });

    // Also include live inventory items that had no activity in the filtered period (if no date filter is set)
    if (!startDate && !endDate && !date) {
      liveInventory.forEach((inv) => {
        const key = `${(inv.modelName || '').trim().toLowerCase()}|${(inv.modelNumber || '').trim().toLowerCase()}|${inv.condition || 'New'}`;
        if (!modelLedgerMap.has(key)) {
          modelLedgerMap.set(key, {
            key,
            modelName: inv.modelName,
            modelNumber: inv.modelNumber || '',
            companyName: inv.companyName || '',
            category: inv.category || 'Mobile',
            condition: inv.condition || 'New',
            purchasedUnits: Number(inv.quantity) || 0,
            purchasedAmount: (Number(inv.price) || 0) * (Number(inv.quantity) || 0),
            soldUnits: 0,
            soldAmount: 0,
            liveStock: Number(inv.quantity) || 0,
            lastActivityAt: inv.updatedAt || inv.createdAt,
          });
        }
      });
    }

    let inventoryLedger = Array.from(modelLedgerMap.values()).map((row) => ({
      ...row,
      netStock: row.purchasedUnits - row.soldUnits,
      synced: row.liveStock >= 0,
    }));

    if (type === 'in') {
      inventoryLedger = inventoryLedger.filter((r) => r.purchasedUnits > 0);
    } else if (type === 'out') {
      inventoryLedger = inventoryLedger.filter((r) => r.soldUnits > 0);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      inventoryLedger = inventoryLedger.filter(
        (r) =>
          r.modelName?.toLowerCase().includes(term) ||
          r.modelNumber?.toLowerCase().includes(term) ||
          r.companyName?.toLowerCase().includes(term) ||
          r.category?.toLowerCase().includes(term)
      );
    }

    inventoryLedger.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));

    const liveInventoryUnits = liveInventory.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const liveInventoryValue = liveInventory.reduce(
      (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
      0
    );

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          daysCount: days.length,
          movementsCount: movements.length,
          totalAddedUnits,
          totalAddedValue,
          totalSubtractedUnits,
          totalSubtractedValue,
          netUnits: totalAddedUnits - totalSubtractedUnits,
          liveInventoryUnits,
          liveInventoryValue,
        },
        days,
        inventoryLedger,
      },
    });
  } catch (error) {
    next(error);
  }
};
