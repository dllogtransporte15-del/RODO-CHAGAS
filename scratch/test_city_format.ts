import { formatCityState } from '../utils/cityUtils.ts';

console.log('1. Typing city:', JSON.stringify(formatCityState('rio')));
console.log('2. Space after word:', JSON.stringify(formatCityState('rio ')));
console.log('3. Compound city:', JSON.stringify(formatCityState('rio verde')));
console.log('4. Space after compound city:', JSON.stringify(formatCityState('rio verde ')));
console.log('5. Added comma manually:', JSON.stringify(formatCityState('rio verde,')));
console.log('6. Typing 1st UF letter:', JSON.stringify(formatCityState('rio verde, g')));
console.log('7. Typing 2nd UF letter:', JSON.stringify(formatCityState('rio verde, go')));
console.log('8. Typing 3rd letter/number:', JSON.stringify(formatCityState('rio verde, gox123')));
console.log('9. Patos de minas, mg:', JSON.stringify(formatCityState('patos de minas, mg')));
console.log('10. Deleting UF back to comma:', JSON.stringify(formatCityState('rio verde, ')));
console.log('11. Deleting comma back to city:', JSON.stringify(formatCityState('rio verde')));
