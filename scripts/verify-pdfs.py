"""Optional QA: pip install pypdf pypdfium2 pillow; run after pdf-samples.cjs."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

folder = Path(sys.argv[1] if len(sys.argv) > 1 else '../output/pdf')
expected = json.loads((folder / 'expected.json').read_text())
texts = {}
for name in ['invoice', 'credit', 'statement', 'interstate', 'empty', 'legacy', 'logoPng', 'logoJpeg', 'cancelled']:
    source = folder / f'{name}.pdf'
    reader = PdfReader(source)
    pages = [page.extract_text() for page in reader.pages]
    text = '\n'.join(pages)
    texts[name] = text
    assert '₹' in text and '\ufffd' not in text, name
    for i, page in enumerate(pages):
        assert f'Page {i+1} of {len(pages)}' in page, (name, i)
        if name in ('invoice', 'credit') and re.search(r'Product \d+', page):
            assert ('Description' if name == 'invoice' else 'Item / HSN') in page, (name, i)
        if name == 'statement' and 'BF/2627/' in page:
            assert all(header in page for header in ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance']), (name, i)
    (folder / f'{name}.txt').write_text(text)
    document = pdfium.PdfDocument(source)
    thumbnails = []
    for i, page in enumerate(document):
        image = page.render(scale=1.4).to_pil()
        image.save(folder / f'{name}-{i+1}.png')
        image.thumbnail((298, 422))
        thumbnails.append(image)
    sheet = Image.new('RGB', (min(4, len(thumbnails))*310, ((len(thumbnails)+3)//4)*450), '#dce2e8')
    draw = ImageDraw.Draw(sheet)
    for i, image in enumerate(thumbnails):
        x, y = (i%4)*310+6, (i//4)*450+20
        sheet.paste(image, (x, y)); draw.text((x, y-15), f'{name} - page {i+1}', fill='black')
    sheet.save(folder / f'{name}-contact.png')
    print(name, len(pages), 'pages: searchable rupees, headers, page numbers checked')

# Compare amounts independent of display grouping (Indian vs western separators).
for name, keys in [('invoice', ['invoiceTotal', 'taxable', 'cgst', 'stateTax']), ('credit', ['credit', 'taxable', 'cgst', 'stateTax']), ('statement', ['closingBalance'])]:
    plain = texts[name].replace(',', '')
    for key in keys:
        assert f'₹{expected[key]:.2f}' in plain, (name, key)
for name in ('invoice', 'credit'):
    assert all(re.search(rf'Product {n}\b', texts[name]) for n in range(1, 76)), name
assert 'IGST' in texts['interstate'] and 'Maharashtra' in texts['interstate']
assert 'Café Müller' in texts['invoice']
assert 'No transactions recorded.' in texts['empty']
assert 'Legacy fallback product' in texts['legacy']
assert 'CANCELLED' in texts['cancelled'] and 'Balance due' in texts['cancelled']
for name, ratio in [('logoPng', 4), ('logoJpeg', 60/160)]:
    page = PdfReader(folder / f'{name}.pdf').pages[0]
    images = [obj.get_object() for obj in page['/Resources']['/XObject'].get_object().values() if obj.get_object()['/Subtype'] == '/Image']
    assert images and abs(images[0]['/Width']/images[0]['/Height']-ratio) < 0.001
print('PASS: totals, all 75 item descriptions, GST, accents, legacy, empty, cancellation and PNG/JPEG images')
