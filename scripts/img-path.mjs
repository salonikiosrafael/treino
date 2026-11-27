// Caminho curto e estável para cada imagem: <hash do id>-<n>.webp
import { createHash } from 'node:crypto';
export const imgFile = (rel) => {
  const [id, file] = rel.split('/');
  const n = file.replace(/\.\w+$/, '');
  return createHash('sha1').update(id).digest('hex').slice(0, 10) + '-' + n + '.webp';
};
