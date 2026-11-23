import { copyId, copyKey } from '../src/copy-id.ts';
const value = process.argv[2];
if (!value) throw new Error('Pass one complete label from your local Canvas installation.');
console.log(process.argv.includes('--id') ? copyId(value) : copyKey(value));
