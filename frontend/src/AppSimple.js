import React, { useState } from 'react';
import NodeInspector from './components/NodeInspector';
import SimulationModal from './components/SimulationModal';
import { saveChain, loadChain, simulate } from './api';

export default function AppSimple() {
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);
  const [userMessages, setUserMessages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [contextInputs, setContextInputs] = useState({ emailOpened: false, emailClicked: false });
  const [error, setError] = useState(null);
  const [simOpen, setSimOpen] = useState(false);

  const handleSimulate = async () => {
    try {
      console.log('Starting simulation...');
      const result = await simulate({ nodes: [], edges: [] }, { type: 'contact_added' }, { now, ...contextInputs });
      console.log('Simulation result:', result);
      
      setLogs(result.logs || []);
      setUserMessages(result.userMessages || []);
      setModalOpen(true);
    } catch (error) {
      console.error('Simulation error:', error);
      alert(`Ошибка симуляции: ${error.message}`);
    }
  };

  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h1>Ошибка в приложении</h1>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Попробовать снова</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Тестовая версия приложения</h1>
      
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setSimOpen(!simOpen)}>
          {simOpen ? 'Скрыть' : 'Показать'} контекст симуляции
        </button>
      </div>

      {simOpen && (
        <div style={{ marginBottom: 20, padding: 20, border: '1px solid #ccc' }}>
          <h3>Контекст симуляции</h3>
          <div>
            <label>Текущее время (ISO):</label>
            <input 
              value={now} 
              onChange={(e) => setNow(e.target.value)}
              style={{ marginLeft: 10, padding: 5 }}
            />
          </div>
          <div style={{ marginTop: 10 }}>
            <label>
              <input
                type="checkbox"
                checked={contextInputs.emailOpened}
                onChange={(e) => setContextInputs(c => ({ ...c, emailOpened: e.target.checked }))}
              />
              Открытие письма
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>
              <input
                type="checkbox"
                checked={contextInputs.emailClicked}
                onChange={(e) => setContextInputs(c => ({ ...c, emailClicked: e.target.checked }))}
              />
              Клик по письму
            </label>
          </div>
          <button 
            onClick={handleSimulate}
            style={{ marginTop: 20, padding: '10px 20px', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: 8 }}
          >
            Запустить симуляцию
          </button>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h3>Логи</h3>
        <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ccc', padding: 10 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>
              {log}
            </div>
          ))}
        </div>
      </div>

      <SimulationModal 
        open={modalOpen} 
        steps={logs} 
        userMessages={userMessages} 
        onClose={() => setModalOpen(false)} 
      />
    </div>
  );
}

