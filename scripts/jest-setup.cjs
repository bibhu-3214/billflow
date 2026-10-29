const { TextEncoder, TextDecoder } = require('node:util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Layout APIs used by headless controls; geometry is verified in real browsers.
if (!global.ResizeObserver) global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (typeof HTMLElement !== 'undefined') {
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = function () {};
if (!HTMLElement.prototype.hasPointerCapture) HTMLElement.prototype.hasPointerCapture = function () { return false; };
if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = function () {};
if (!HTMLElement.prototype.releasePointerCapture) HTMLElement.prototype.releasePointerCapture = function () {};
}
