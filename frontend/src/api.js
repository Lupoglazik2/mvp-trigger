// frontend/src/api.js
import axios from 'axios';

// Базовый URL API - берем из переменной окружения или используем пустую строку для локальной разработки
const API_BASE = process.env.REACT_APP_API_URL || '';

export async function saveChain(chain) {
  await axios.post(`${API_BASE}/api/chain`, { chain });
}

export async function loadChain() {
  const res = await axios.get(`${API_BASE}/api/chain`);
  return res.data.chain;
}

export async function simulate(chain, trigger, context) {
  const res = await axios.post(`${API_BASE}/api/simulate`, { chain, trigger, context });
  return res.data;
}



