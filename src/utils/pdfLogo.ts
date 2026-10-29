import { Unzlib } from 'fflate';

function fail(): never { throw new Error('PDF logo is invalid or exceeds safe decoding limits. Use a small PNG or JPEG.'); }
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const base64 = (bytes: Uint8Array) => {
    let result = '';
    for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(result);
};

// Validate actual bytes before jsPDF can invoke its PNG inflater. Compressed
// ancillary metadata is discarded; palette, transparency and pixel data remain.
export function validatedPdfLogo(logo: string) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo) || logo.length > 180000) fail();
    let raw: Uint8Array<ArrayBuffer>;
    try { raw = Uint8Array.from(atob(logo.split(',')[1]), c => c.charCodeAt(0)); } catch { fail(); }
    if (raw[0] === 255 && raw[1] === 216 && raw[2] === 255) return `data:image/jpeg;base64,${base64(raw)}`;
    if (!signature.every((byte, i) => raw[i] === byte)) fail();
    const view = new DataView(raw.buffer), chunks: Uint8Array[] = [raw.subarray(0, 8)], compressed: Uint8Array[] = [];
    let offset = 8, expected = 0, pixels = false, ended = false, afterPixels = false;
    while (offset < raw.length) {
        if (offset + 12 > raw.length) fail();
        const length = view.getUint32(offset), end = offset + 12 + length;
        if (end > raw.length) fail();
        const type = String.fromCharCode(...raw.subarray(offset + 4, offset + 8));
        if (!/^[A-Za-z]{4}$/.test(type)) fail();
        if (!expected && type !== 'IHDR') fail();
        if (type === 'IHDR') {
            if (expected || length !== 13) fail();
            const width = view.getUint32(offset + 8), height = view.getUint32(offset + 12);
            const depth = raw[offset + 16], color = raw[offset + 17], interlace = raw[offset + 20];
            const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
            if (!width || !height || width > 16384 || height > 16384 || width * height > 4000000
                || !depths[color]?.includes(depth) || interlace > 1 || raw[offset + 18] || raw[offset + 19]) fail();
            const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
            const passes = interlace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
            for (const [x, y, dx, dy] of passes) {
                const w = Math.max(0, Math.ceil((width - x) / dx)), h = Math.max(0, Math.ceil((height - y) / dy));
                if (w && h) expected += (Math.ceil(w * channels * depth / 8) + 1) * h;
            }
            if (expected > 32 * 1024 * 1024) fail();
            chunks.push(raw.subarray(offset, end));
        } else if (type === 'IDAT') {
            if (afterPixels) fail();
            pixels = true; compressed.push(raw.subarray(offset + 8, offset + 8 + length));
            chunks.push(raw.subarray(offset, end));
        } else if (type === 'IEND') {
            if (length || !pixels || end !== raw.length) fail();
            ended = true; chunks.push(raw.subarray(offset, end));
        } else {
            if (pixels) afterPixels = true;
            if (type === 'PLTE' || type === 'tRNS') {
                if (pixels || length > 768 || (type === 'PLTE' && length % 3)) fail();
                chunks.push(raw.subarray(offset, end));
            } else if (type[0] === type[0].toUpperCase()) fail();
        }
        offset = end;
    }
    if (!ended) fail();
    const data = new Uint8Array(compressed.reduce((n, chunk) => n + chunk.length, 0));
    let position = 0;
    for (const chunk of compressed) { data.set(chunk, position); position += chunk.length; }
    let inflated = 0;
    const decoder = new Unzlib(chunk => { inflated += chunk.length; if (inflated > expected) fail(); });
    try {
        for (let i = 0; i < data.length; i += 512) decoder.push(data.subarray(i, i + 512), i + 512 >= data.length);
    } catch { fail(); }
    if (inflated !== expected) fail();
    const safe = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0));
    position = 0;
    for (const chunk of chunks) { safe.set(chunk, position); position += chunk.length; }
    return `data:image/png;base64,${base64(safe)}`;
}
