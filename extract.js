const fs = require('fs');
const content = fs.readFileSync('DDSD');
console.log('Buffer size:', content.length);
console.log('First 100 bytes:', content.slice(0, 100).toString('hex'));
console.log('As utf8:', content.slice(0, 100).toString('utf8'));
console.log('As utf16le:', content.slice(0, 100).toString('utf16le'));
