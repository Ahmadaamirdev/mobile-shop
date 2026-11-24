// Test script to verify model validation logic and server loading without live DB
const Purchase = require('./models/Purchase');
const Sale = require('./models/Sale');
const Inventory = require('./models/Inventory');
const Invoice = require('./models/Invoice');

console.log('🧪 Starting Backend Validation Tests...\n');

let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failedTests++;
  }
}

// 1. Test Purchase Validation
const validPurchase = new Purchase({
  category: 'Mobile',
  companyName: 'Samsung',
  modelName: 'Galaxy S23',
  modelNumber: 'SM-S911B',
  imei1: '123456789012345',
  imei2: '987654321098765',
  customerPhone: '03001234567',
  customerIdCard: '36302-1234567-1', // 13 digits with dashes
  price: 150000,
});
const err1 = validPurchase.validateSync();
assert(!err1, 'Valid purchase passes schema validation');

const invalidImeiPurchase = new Purchase({
  category: 'Mobile',
  companyName: 'Apple',
  modelName: 'iPhone 15',
  modelNumber: 'A2846',
  imei1: '12345', // Only 5 digits - should fail
  customerPhone: '03001234567',
  customerIdCard: '3630212345671',
  price: 250000,
});
const err2 = invalidImeiPurchase.validateSync();
assert(err2 && err2.errors.imei1, 'Invalid IMEI (< 15 digits) is rejected');

const invalidCnicPurchase = new Purchase({
  category: 'Mobile',
  companyName: 'Apple',
  modelName: 'iPhone 15',
  modelNumber: 'A2846',
  imei1: '123456789012345',
  customerPhone: '03001234567',
  customerIdCard: '12345', // Only 5 digits - should fail
  price: 250000,
});
const err3 = invalidCnicPurchase.validateSync();
assert(err3 && err3.errors.customerIdCard, 'Invalid ID card (< 13 digits) is rejected');

// 2. Test Optional IMEI on Purchase (Devices with 0 or 1 IMEI)
const optionalImeiPurchase = new Purchase({
  category: 'Accessory',
  companyName: 'Anker',
  modelName: '20W Fast Charger',
  modelNumber: 'A2149',
  customerPhone: '03001234567',
  customerIdCard: '3630212345671',
  price: 3500,
});
const err4 = optionalImeiPurchase.validateSync();
assert(!err4, 'Purchase without IMEI passes (optional IMEIs allowed)');

// 3. Test Sale Validation
const validSale = new Sale({
  category: 'Mobile',
  modelName: 'Galaxy S23',
  modelNumber: 'SM-S911B',
  customerName: 'Muhammad Ali',
  customerNumber: '03007654321',
  imei1: '123456789012345',
  price: 165000,
});
const err5 = validSale.validateSync();
assert(!err5, 'Valid sale passes schema validation');

const invalidSaleImei = new Sale({
  category: 'Mobile',
  modelName: 'Galaxy S23',
  customerName: 'Muhammad Ali',
  customerNumber: '03007654321',
  imei1: '12345678', // 8 digits
  price: 165000,
});
const err6 = invalidSaleImei.validateSync();
assert(err6 && err6.errors.imei1, 'Sale with invalid IMEI is rejected');

// 4. Test Inventory Model
const validInventory = new Inventory({
  category: 'Tablet',
  companyName: 'Apple',
  modelName: 'iPad Air 5',
  modelNumber: 'A2588',
  quantity: 5,
  price: 180000,
  imeis: ['123456789012345'],
});
const err7 = validInventory.validateSync();
assert(!err7, 'Valid inventory item passes validation');

// 5. Test Invoice Model
const validInvoice = new Invoice({
  invoiceNumber: 'UM-1001',
  customerName: 'Usman Tariq',
  customerNumber: '03019876543',
  modelName: 'Samsung Galaxy A54',
  modelNumber: 'SM-A546E',
  imei1: '123456789012345',
  price: 98000,
});
const err8 = validInvoice.validateSync();
assert(!err8, 'Valid invoice passes schema validation');

console.log('\n--- Summary ---');
if (failedTests === 0) {
  console.log('🎉 ALL BACKEND SCHEMA & VALIDATION TESTS PASSED!\n');
  process.exit(0);
} else {
  console.error(`💥 ${failedTests} tests failed.`);
  process.exit(1);
}
