const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Invoice = require('../models/Invoice');
const LedgerParty = require('../models/LedgerParty');

const buildDateMatch = (startDate, endDate, field = 'createdAt', tzOffsetMin = -300) => {
  if (!startDate && !endDate) return {};
  const offsetMs = Number.isFinite(tzOffsetMin) ? tzOffsetMin * 60000 : -300 * 60000;
  const range = {};
  if (startDate) {
    const [y, m, d] = startDate.split('-').map(Number);
    if (y && m && d) range.$gte = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs);
  }
  if (endDate) {
    const [y, m, d] = endDate.split('-').map(Number);
    if (y && m && d) range.$lte = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offsetMs);
  }
  return Object.keys(range).length ? { [field]: range } : {};
};

// @desc    Get real-time aggregated totals for Purchases, Sales, and Inventory
// @route   GET /api/dashboard
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { startDate = '', endDate = '' } = req.query;
    const tzOffsetMin = req.query.tzOffset !== undefined ? Number(req.query.tzOffset) : -300;
    const dateMatch = buildDateMatch(startDate, endDate, 'createdAt', tzOffsetMin);
    const hasDateFilter = Boolean(startDate || endDate);
    const recentLimit = hasDateFilter ? 25 : 5;

    const [
      purchaseAgg,
      purchaseByCat,
      recentPurchases,
      saleAgg,
      saleByCat,
      recentSales,
      inventoryAgg,
      inventoryByCat,
      outOfStockCount,
      totalInvoicesCount,
      ledgerAgg,
    ] = await Promise.all([
      Purchase.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            units: { $sum: { $ifNull: ['$quantity', 1] } },
            totalAmount: { $sum: { $ifNull: ['$price', 0] } },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            units: { $sum: { $ifNull: ['$quantity', 1] } },
            totalAmount: { $sum: { $ifNull: ['$price', 0] } },
          },
        },
      ]),
      Purchase.find(dateMatch)
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .select('category condition modelName companyName price quantity customerName createdAt')
        .lean(),

      Sale.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            units: {
              $sum: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$items', []] } }, 0] },
                  { $size: '$items' },
                  1,
                ],
              },
            },
            totalAmount: { $sum: { $ifNull: ['$price', 0] } },
          },
        },
      ]),
      Sale.aggregate([
        { $match: dateMatch },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalAmount: { $sum: { $ifNull: ['$price', 0] } },
          },
        },
      ]),
      Sale.find(dateMatch)
        .sort({ createdAt: -1 })
        .limit(recentLimit)
        .select('category condition modelName price customerName items createdAt')
        .lean(),

      Inventory.aggregate([
        {
          $group: {
            _id: null,
            totalModels: { $sum: 1 },
            inStockModels: {
              $sum: { $cond: [{ $gt: ['$quantity', 0] }, 1, 0] },
            },
            totalUnits: { $sum: { $ifNull: ['$quantity', 0] } },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$price', 0] },
                  { $ifNull: ['$quantity', 0] },
                ],
              },
            },
          },
        },
      ]),
      Inventory.aggregate([
        {
          $group: {
            _id: '$category',
            models: { $sum: 1 },
            units: { $sum: { $ifNull: ['$quantity', 0] } },
            totalValue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$price', 0] },
                  { $ifNull: ['$quantity', 0] },
                ],
              },
            },
          },
        },
      ]),
      Inventory.countDocuments({ quantity: { $lte: 0 } }),
      Invoice.countDocuments(buildDateMatch(startDate, endDate, 'date', tzOffsetMin)),
      LedgerParty.aggregate([
        { $match: { partyType: 'Supplier', balance: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const pSummary = purchaseAgg[0] || { count: 0, units: 0, totalAmount: 0 };
    const sSummary = saleAgg[0] || { count: 0, units: 0, totalAmount: 0 };
    const iSummary = inventoryAgg[0] || {
      totalModels: 0,
      inStockModels: 0,
      totalUnits: 0,
      totalValue: 0,
    };

    const categories = ['Mobile', 'Tablet', 'Accessory'];
    const mapByCategory = (rows) => {
      const map = {};
      categories.forEach((c) => {
        map[c] = { count: 0, units: 0, totalAmount: 0, models: 0, totalValue: 0 };
      });
      rows.forEach((r) => {
        if (r._id && map[r._id]) {
          map[r._id] = { ...map[r._id], ...r };
        }
      });
      return map;
    };

    const ledgerPayable = (ledgerAgg && ledgerAgg[0]) || { totalBalance: 0, count: 0 };

    return res.status(200).json({
      success: true,
      data: {
        purchases: {
          count: pSummary.count,
          units: pSummary.units,
          totalAmount: pSummary.totalAmount,
          byCategory: mapByCategory(purchaseByCat),
          recent: recentPurchases,
        },
        sales: {
          count: sSummary.count,
          units: sSummary.units,
          totalAmount: sSummary.totalAmount,
          byCategory: mapByCategory(saleByCat),
          recent: recentSales,
        },
        inventory: {
          totalModels: iSummary.totalModels,
          inStockModels: iSummary.inStockModels,
          outOfStockModels: outOfStockCount,
          totalUnits: iSummary.totalUnits,
          totalValue: iSummary.totalValue,
          byCategory: mapByCategory(inventoryByCat),
        },
        invoices: {
          count: totalInvoicesCount,
        },
        ledger: {
          payableTotal: ledgerPayable.totalBalance || 0,
          payableCount: ledgerPayable.count || 0,
        },
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
