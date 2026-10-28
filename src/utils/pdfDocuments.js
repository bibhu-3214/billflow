import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { money, paymentSummary, states, today } from './indiaBilling';
import { statementRows } from './statements';

const FONT = 'NotoSans';
const LEFT = 14, WIDTH = 182, TOP = 30, BOTTOM = 275;
let fontRequest;

// Same-origin assets only. Cache successes; a network failure can be retried.
export function loadPdfFonts() {
    if (!fontRequest) fontRequest = Promise.all(['Regular', 'Bold'].map(async style => {
        const response = await fetch(`${process.env.PUBLIC_URL || ''}/fonts/NotoSans-${style}.ttf`);
        if (!response.ok) throw new Error('PDF fonts could not load. Check your connection and try again.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return btoa(binary);
    })).catch(error => { fontRequest = undefined; throw error; });
    return fontRequest;
}

export function pdfFilename(reference, fallback = 'Invoice') {
    const name = String(reference || fallback).normalize('NFKC')
        .replace(/[<>:"/\\|?*]/g, '-')
        .split('').map(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '-' : char).join('').replace(/[. ]+$/g, '').slice(0, 120);
    return `${name || fallback}.pdf`;
}

function documentLayout(title, reference, fonts, logo) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
    ['normal', 'bold'].forEach((style, i) => {
        doc.addFileToVFS(`${style}.ttf`, fonts[i]);
        doc.addFont(`${style}.ttf`, FONT, style);
    });
    doc.setFont(FONT);
    doc.setProperties({ title: `${title} - ${reference}`, creator: 'BillFlow', author: 'BillFlow' });
    const fontMaps = ['normal', 'bold'].map(style => doc.getFont(FONT, style).metadata);
    // Never silently drop unsupported script/emoji characters from financial documents.
    const text = value => {
        const result = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
        for (const char of result) {
            if (char === '\n') continue;
            if (fontMaps.some(font => !font.characterToGlyph(char.codePointAt(0)))) {
                throw new Error(`PDF font does not support “${char}” (U+${char.codePointAt(0).toString(16).toUpperCase()}). Use Latin text for this export; the saved record is unchanged.`);
            }
        }
        return result;
    };
    text(title); text(reference);
    let y = TOP;
    const paragraph = (value, bold = false) => {
        if (!value) return;
        doc.setFont(FONT, bold ? 'bold' : 'normal').setFontSize(9).setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(text(value), WIDTH);
        lines.forEach(line => {
            if (y > BOTTOM - 5) { doc.addPage(); y = TOP; }
            doc.text(line, LEFT, y);
            y += 4.7;
        });
        y += 2;
    };
    const table = (head, body, widths, extra = {}) => {
        const clean = rows => rows.map(row => row.map(text));
        autoTable(doc, {
            startY: y, margin: { left: LEFT, right: LEFT, top: TOP, bottom: 22 },
            head: head ? clean([head]) : [], body: clean(body), theme: 'grid',
            showHead: 'everyPage', rowPageBreak: 'avoid',
            styles: { font: FONT, fontSize: 8, cellPadding: 2, overflow: 'linebreak', textColor: [30, 41, 59], lineColor: [214, 222, 232], lineWidth: 0.15 },
            headStyles: { fillColor: [30, 51, 76], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [246, 248, 251] },
            columnStyles: Object.fromEntries(widths.map((cellWidth, i) => [i, { cellWidth, ...(i > 1 ? { halign: 'right' } : {}) }])),
            ...extra,
        });
        y = doc.lastAutoTable.finalY + 5;
    };
    if (logo) {
        if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 180000) {
            throw new Error('PDF logo must be a PNG or JPEG under 130 KB. Update the business logo and try again.');
        }
        try {
            const image = doc.getImageProperties(logo);
            if (!image.width || !image.height || image.width * image.height > 16000000) throw new Error('Invalid dimensions');
            const scale = Math.min(40 / image.width, 18 / image.height);
            doc.addImage(logo, image.fileType, LEFT, y, image.width * scale, image.height * scale);
            y += image.height * scale + 5;
        } catch (_) { throw new Error('PDF logo could not be read. Use a valid PNG or JPEG; no document was downloaded.'); }
    }
    const totals = rows => table(null, rows, [122, 60], {
        pageBreak: 'avoid', theme: 'plain',
        columnStyles: { 0: { cellWidth: 122, halign: 'right' }, 1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' } },
        alternateRowStyles: { fillColor: [246, 248, 251] },
    });
    const finish = () => {
        const pages = doc.getNumberOfPages();
        for (let page = 1; page <= pages; page++) {
            doc.setPage(page);
            doc.setFont(FONT, 'bold').setFontSize(13).setTextColor(30, 51, 76);
            doc.text(title, LEFT, 13);
            doc.setFont(FONT, 'normal').setFontSize(8);
            // Record identifiers are bounded in the data model; wrap unusually long legacy references.
            const refs = doc.splitTextToSize(text(reference), WIDTH);
            doc.text(refs.slice(0, 2), LEFT, 19);
            doc.setDrawColor(214, 222, 232).line(LEFT, 25, 196, 25);
            doc.setFontSize(8).setTextColor(80, 90, 105);
            doc.text('BillFlow | Business records', LEFT, 286);
            doc.text(`Page ${page} of ${pages}`, 196, 286, { align: 'right' });
        }
        return doc;
    };
    return { paragraph, table, totals, finish };
}

const party = (label, person, fallback) => [label, person.name || fallback, person.address,
    person.email, person.mobile, person.gstin && `GSTIN: ${person.gstin}`].filter(Boolean).join('\n');
const taxRows = bill => !bill.gst ? [] : bill.interstate ? [['IGST', money(bill.igst)]] : [
    ['CGST', money(bill.cgst)], [bill.localTax || 'SGST', money(bill.stateTax)],
];

export function createInvoicePdf({ bill, customer = {}, products = [], fonts, credit = false }) {
    const supplier = bill.supplierSnapshot || {};
    customer = bill.customerSnapshot || customer;
    const note = credit ? bill.creditNote : null;
    if (credit && !note) throw new Error('This invoice has no credit note.');
    const title = credit ? 'Credit note' : bill.gst ? 'Tax invoice' : 'Invoice';
    const reference = credit ? note.number : bill.invoiceNumber || 'Legacy invoice';
    const layout = documentLayout(title, reference, fonts, supplier.logo);
    const { paragraph, table, totals } = layout;
    paragraph(credit ? `Date: ${note.date}\nOriginal invoice: ${bill.invoiceNumber} | ${bill.date?.slice(0, 10)}` :
        `Issued: ${bill.date?.slice(0, 10) || ''}${bill.dueDate ? ` | Due: ${bill.dueDate}` : ''}`);
    if (!credit && bill.cancellation) paragraph(`CANCELLED | ${bill.cancellation.date}\n${bill.cancellation.reason}`, true);
    if (!credit && bill.creditNote) paragraph(`Fully credited by ${bill.creditNote.number}`, true);
    table(null, [[party('FROM', supplier, 'Business details not recorded'), party('BILL TO / DELIVER TO', customer, 'Customer unavailable')]], [91, 91], {
        theme: 'plain', alternateRowStyles: {}, columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
    });
    if (bill.gst) paragraph(`Supplier state: ${bill.supplierState} - ${states[bill.supplierState] || ''}\nPlace of supply: ${bill.placeOfSupply} - ${states[bill.placeOfSupply] || ''}${credit ? '' : '\nReverse charge: No'}`);
    if (credit) paragraph(`Full invoice credit | ${note.reason}`);
    else {
        if (bill.sourceQuotationNumber) paragraph(`Converted from quotation ${bill.sourceQuotationNumber}`);
        if (!bill.invoiceNumber) paragraph('Legacy record: customer and product names were not saved at issue time.');
    }
    const description = item => `${item.name || products.find(p => p._id === item.product)?.name || 'Unavailable'}${item.hsn ? `\nHSN/SAC ${item.hsn}` : ''}`;
    if (credit) {
        table(['Item / HSN', 'Qty / unit', 'Taxable', 'CGST', bill.localTax || 'SGST', 'IGST', 'Total'], bill.lineItems.map(item => [
            `${description(item)}${bill.gst ? `\nGST ${item.gstRate}%` : ''}`, `${item.quantity} ${item.unit || ''}`, money(item.taxable), money(item.cgst), money(item.stateTax), money(item.igst), money(item.subTotal),
        ]), [50, 17, 23, 23, 23, 23, 23]);
        totals([['Taxable credit', money(note.taxable)], ...taxRows(bill), ['Total credit', money(note.amount)]]);
        paragraph(`Recorded by ${note.actor}. This document does not submit a GST return or process a refund.`);
    } else {
        table(['Description', 'Qty / unit', 'Rate', 'Disc.', ...(bill.gst ? ['GST', 'Taxable'] : []), 'Amount'], bill.lineItems.map(item => [
            description(item), `${item.quantity} ${item.unit || ''}`, money(item.price), `${item.discount || 0}%`,
            ...(bill.gst ? [`${item.gstRate}%\n${bill.interstate ? `IGST ${money(item.igst)}` : `CGST ${money(item.cgst)}\n${bill.localTax || 'SGST'} ${money(item.stateTax)}`}`, money(item.taxable)] : []), money(item.subTotal),
        ]), bill.gst ? [47, 17, 24, 14, 27, 25, 28] : [75, 22, 30, 20, 35]);
        const summary = paymentSummary(bill);
        totals([...(bill.invoiceNumber ? [['Subtotal', money(bill.gross)], ['Discount', `-${money(bill.discountAmount)}`], ['Taxable value', money(bill.taxable)]] : []),
            ...taxRows(bill), ['Invoice total', money(bill.total)], ['Recorded payments', money(summary.paid)], ['Balance due', money(summary.balance)]]);
        if (supplier.bankDetails) { paragraph('Payment instructions', true); paragraph(supplier.bankDetails); }
        paragraph(bill.notes);
    }
    if (credit || bill.gst) { paragraph(`For ${supplier.name || 'Business'}`, true); paragraph('\nAuthorised signatory'); }
    return { doc: layout.finish(), filename: pdfFilename(credit ? note.number : bill.invoiceNumber) };
}

export function createStatementPdf({ bills, customer, business, fonts, date = today() }) {
    const layout = documentLayout('Statement of account', `Generated ${date}`, fonts, business.logo);
    layout.paragraph(party('BUSINESS', business, 'Business details not recorded'));
    layout.paragraph(party('CUSTOMER', customer, 'Customer unavailable'));
    layout.paragraph('All recorded activity');
    const rows = statementRows(bills, customer._id);
    layout.table(['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'], rows.map(row => [
        row.date, row.reference, row.description, money(row.debit), money(row.credit), money(row.balance),
    ]), [22, 32, 44, 28, 28, 28], { columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 32 }, 2: { cellWidth: 44 }, 3: { cellWidth: 28, halign: 'right' }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' } } });
    if (!rows.length) layout.paragraph('No transactions recorded.');
    layout.totals([['Closing balance', money(rows.length ? rows[rows.length - 1].balance : 0)]]);
    layout.paragraph('Based on records in this workspace. Payment entries are recorded manually.');
    return { doc: layout.finish(), filename: pdfFilename(`Statement-${date}`) };
}

export async function downloadInvoicePdf(options) {
    const result = createInvoicePdf({ ...options, fonts: await loadPdfFonts() });
    await result.doc.save(result.filename, { returnPromise: true });
}
export async function downloadStatementPdf(options) {
    const result = createStatementPdf({ ...options, fonts: await loadPdfFonts() });
    await result.doc.save(result.filename, { returnPromise: true });
}
