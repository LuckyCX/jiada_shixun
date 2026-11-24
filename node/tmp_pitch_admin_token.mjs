import jwt from 'jsonwebtoken';
import { getConfigValue } from './src/lib/systemConfig.js';
const sec = await getConfigValue('security');
const token = jwt.sign({ sub: '999', username: 'local-test', role: 'admin' }, sec.jwt.secret, { expiresIn: '10m' });
console.log(token);
