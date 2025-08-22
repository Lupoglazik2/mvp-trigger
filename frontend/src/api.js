import axios from 'axios';

export async function saveChain(chain) {
  await axios.post('/api/chain', { chain });
}

export async function loadChain() {
  const res = await axios.get('/api/chain');
  return res.data.chain;
}

export async function simulate(chain, trigger, context) {
  const res = await axios.post('/api/simulate', { chain, trigger, context });
  return res.data;
}




