// Reproducible fictional PDF fixtures using the production renderer, without a browser.
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (module, filename) => {
    const { code } = babel.transformFileSync(filename, { babelrc: false, configFile: false,
        presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'] });
    module._compile(code, filename);
};
const { createInvoicePdf, createStatementPdf } = require('../src/utils/pdfDocuments');
const { calculateInvoice } = require('../src/utils/indiaBilling');
const fonts = ['Regular', 'Bold'].map(style => fs.readFileSync(path.join(root, `public/fonts/NotoSans-${style}.ttf`)).toString('base64'));
const customer = { _id: 'customer', name: 'Café Müller & Co.', email: 'sample@example.com', mobile: '0000000000', address: '42 Example Street\nBengaluru, Karnataka 560001', gstin: '29ABCDE1234F1Z5' };
const business = { name: 'BillFlow Sample Trading', address: '17 Fictional Road\nBengaluru, Karnataka 560002', gstin: '29ABCDE1234F1Z5', bankDetails: 'Sample payment instructions only. No real bank account.', logo: '' };
const items = Array.from({ length: 75 }, (_, i) => ({ _id: `item-${i}`, product: `p-${i}`, name: `Product ${i + 1} - precision component with a deliberately long searchable description`, hsn: '8205', unit: 'pcs', price: 1234.56 + i, quantity: 2, discount: 10, gstRate: 18 }));
const make = (n, state = '29', lines = items) => ({ _id: `bill-${n}`, customer: customer._id, invoiceNumber: `BF/2627/${String(n).padStart(6, '0')}`, date: '2026-10-14', dueDate: '2026-10-28', gst: true, supplierState: '29', placeOfSupply: state, supplierSnapshot: business, customerSnapshot: customer, notes: 'Thank you. Amounts are in Indian rupees (₹).\nFictional data for PDF verification.', ...calculateInvoice(lines, { gst: true, supplierState: '29', placeOfSupply: state }) });
const bill = make(1);
const credit = { ...bill, creditNote: { number: 'CN/2627/000001', date: '2026-10-14', reason: 'Full return of sample order', amount: bill.total, taxable: bill.taxable, actor: 'Sample operator' } };
const statementBills = Array.from({ length: 65 }, (_, i) => ({ ...make(i + 1, '29', items.slice(0, 1)), payments: [{ _id: `pay-${i}`, date: '2026-10-14', amount: 100, method: 'UPI' }] }));
const output = path.resolve(process.argv[2] || path.join(root, '../output/pdf'));
fs.mkdirSync(output, { recursive: true });
const logos = require('./pdf-logo-fixtures.json');
const fixtures = {
    logoPng: createInvoicePdf({ bill: { ...make(3, '29', items.slice(0, 2)), supplierSnapshot: { ...business, logo: logos.png } }, fonts }),
    logoJpeg: createInvoicePdf({ bill: { ...make(4, '29', items.slice(0, 2)), supplierSnapshot: { ...business, logo: logos.jpeg } }, fonts }),
    cancelled: createInvoicePdf({ bill: { ...make(5, '29', items.slice(0, 1)), cancellation: { date: '2026-10-14', reason: 'Sample cancellation' } }, fonts }),
    invoice: createInvoicePdf({ bill, fonts }),
    credit: createInvoicePdf({ bill: credit, fonts, credit: true }),
    statement: createStatementPdf({ bills: statementBills, customer, business, fonts, date: '2026-10-14' }),
    interstate: createInvoicePdf({ bill: make(2, '27', items.slice(0, 3)), fonts }),
    empty: createStatementPdf({ bills: [], customer, business, fonts, date: '2026-10-14' }),
    legacy: createInvoicePdf({ bill: { _id: 'legacy', customer: customer._id, date: '2026-10-14', total: 50, lineItems: [{ _id: 'line', product: 'p', quantity: 1, price: 50, subTotal: 50 }] }, customer, products: [{ _id: 'p', name: 'Legacy fallback product' }], fonts }),
};
for (const [name, { doc, filename }] of Object.entries(fixtures)) {
    fs.writeFileSync(path.join(output, `${name}.pdf`), Buffer.from(doc.output('arraybuffer')));
    console.log(`${name}: ${doc.getNumberOfPages()} pages; download filename ${filename}`);
}
fs.writeFileSync(path.join(output, 'expected.json'), JSON.stringify({ invoiceTotal: bill.total, taxable: bill.taxable, cgst: bill.cgst, stateTax: bill.stateTax, credit: credit.creditNote.amount, closingBalance: statementBills.reduce((sum, row) => sum + row.total - 100, 0) }, null, 2));
