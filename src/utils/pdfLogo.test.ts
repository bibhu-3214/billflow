/** @jest-environment node */
import fixtures from '../../scripts/pdf-logo-fixtures.json';
import { deflateSync } from 'zlib';
import { validatedPdfLogo } from './pdfLogo';

const crc = (bytes: Uint8Array) => {
    let value = 0xffffffff;
    for (const byte of bytes) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
    return (value ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
    const result = Buffer.alloc(data.length + 12);result.writeUInt32BE(data.length);result.write(type, 4);data.copy(result, 8);
    result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4);return result;
};
const png = ({ width = 1, pixels = Buffer.from([0, 0, 0, 0, 0]), metadata = [] }: {width?: number; pixels?: Buffer; metadata?: Buffer[]} = {}) => {
    const header = Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(1, 4);header[8] = 8;header[9] = 6;
    return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), ...metadata, chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
};

test('PNG dimensions and inflated data are bounded before PDF decoding, including MIME aliases', () => {
    expect(() => validatedPdfLogo(png({ width: 1000000 }))).toThrow(/safe decoding/);
    const bomb = png({ pixels: Buffer.alloc(2 * 1024 * 1024) });
    expect(() => validatedPdfLogo(bomb)).toThrow(/safe decoding/);
    expect(() => validatedPdfLogo(bomb.replace('image/png', 'image/jpeg'))).toThrow(/safe decoding/);
});

test('compressed ancillary profiles are removed while transparent PNG pixels remain valid', () => {
    const profile = chunk('iCCP', Buffer.concat([Buffer.from('profile\0\0'), deflateSync(Buffer.alloc(1024 * 1024))]));
    const safe = validatedPdfLogo(png({ metadata: [profile] }));
    expect(Buffer.from(safe.split(',')[1], 'base64').includes(Buffer.from('iCCP'))).toBe(false);
    expect(safe).toBe(validatedPdfLogo(png()));
});

test('real PNG/JPEG fixtures preserve safe image encoding', () => {

    for (const value of Object.values(fixtures)) if (typeof value === 'string' && value.startsWith('data:image/')) expect(validatedPdfLogo(value)).toMatch(/^data:image\/(png|jpeg);base64,/);
});
