const React = require('react');
const radixSlot = require('./node_modules/@radix-ui/react-slot/dist/index.js');
const radixUiSlot = require('./node_modules/radix-ui/dist/slot.js');

console.log('=== @radix-ui/react-slot (v' + require('./node_modules/@radix-ui/react-slot/package.json').version + ') ===');
console.log('exports:', Object.keys(radixSlot));
console.log('Root type:', typeof radixSlot.Root);
console.log('Root forwardRef?', radixSlot.Root && radixSlot.Root.$$typeof === React.forwardRef(identity).$$typeof ? 'YES' : 'NO');
console.log('Root.$$typeof:', radixSlot.Root && radixSlot.Root.$$typeof?.toString?.());

console.log('\n=== radix-ui v1 umbrella (/dist/slot.js) ===');
console.log('exports:', Object.keys(radixUiSlot));
console.log('Slot type:', typeof radixUiSlot.Slot);
console.log('Slot forwardRef?', radixUiSlot.Slot && radixUiSlot.Slot.$$typeof === React.forwardRef(identity).$$typeof ? 'YES' : 'NO');

function identity(x) { return x; }
