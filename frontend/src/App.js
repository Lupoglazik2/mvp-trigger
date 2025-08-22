import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import NodeInspector from './components/NodeInspector';
import SimulationModal from './components/SimulationModal';
import StatsTooltip from './components/StatsTooltip';
import { saveChain, loadChain, simulate } from './api';

const initialNodes = [
  {
    id: 'event1',
    type: 'event',
    position: { x: 0, y: 0 },
    data: { label: 'Контакт добавлен', eventType: 'contact_added', listName: 'Newsletter' },
  },
  {
    id: 'action1',
    type: 'action',
    position: { x: 250, y: 0 },
    data: { label: 'Ждем 1 день', actionType: 'wait', delayValue: 1, delayUnit: 'days' },
  },
  {
    id: 'cond1',
    type: 'condition',
    position: { x: 500, y: -100 },
    data: { label: 'Дата > 2025-08-20', conditionType: 'date', operator: '>', value: '2025-08-20' },
  },
  {
    id: 'action2',
    type: 'action',
    position: { x: 750, y: -150 },
    data: { label: 'Отправить письмо', actionType: 'send_email', subject: 'Здравствуйте!', body: 'Добро пожаловать в нашу рассылку.' },
  },
  {
    id: 'stop1',
    type: 'action',
    position: { x: 1000, y: -150 },
    data: { label: 'Стоп', actionType: 'stop' },
  },
  {
    id: 'stop2',
    type: 'action',
    position: { x: 750, y: 0 },
    data: { label: 'Стоп', actionType: 'stop' },
  },
];

const initialEdges = [
  { id: 'e1-2', source: 'event1', target: 'action1' },
  { id: 'e2-3', source: 'action1', target: 'cond1' },
  { id: 'e3-4', source: 'cond1', target: 'action2', label: 'yes', data: { path: 'yes' } },
  { id: 'e4-5', source: 'action2', target: 'stop1' },
  { id: 'e3-6', source: 'cond1', target: 'stop2', label: 'no', data: { path: 'no' } },
];

function nodeStyleForType(nodeType) {
  if (nodeType === 'event') return { borderColor: '#0ea5e9', background: '#e0f2fe' };
  if (nodeType === 'condition') return { borderColor: '#f59e0b', background: '#fff7ed' };
  return { borderColor: '#10b981', background: '#ecfdf5' };
}

function DefaultNode({ data, nodeType }) {
  let style = nodeStyleForType(nodeType);
  if (nodeType === 'action' && (data?.actionType === 'stop' || (data?.label || '').toLowerCase() === 'стоп')) {
    style = { borderColor: '#ef4444', background: '#fee2e2' };
  }
  return (
    <div style={{
      padding: 8,
      border: '1px solid ' + style.borderColor,
      background: style.background,
      borderRadius: 6,
      minWidth: 140,
      textAlign: 'center',
      fontSize: 12,
    }}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>{data?.label || nodeType}</div>
      <div style={{ color: '#666', marginTop: 4 }}>
        {nodeType === 'event' && (data?.eventType || '')}
        {nodeType === 'action' && (data?.actionType || '')}
        {nodeType === 'condition' && (data?.conditionType || '')}
      </div>
      {nodeType === 'condition' ? (
        <>
          <Handle type="source" id="yes" position={Position.Right} style={{ top: '30%' }} />
          <Handle type="source" id="no" position={Position.Right} style={{ top: '70%' }} />
        </>
      ) : nodeType === 'action' && data?.actionType === 'stop' ? null : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);
  const [userMessages, setUserMessages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [contextInputs, setContextInputs] = useState({ emailOpened: '', emailClicked: '' });
  const [error, setError] = useState(null);
  const [simOpen, setSimOpen] = useState(false);
  const [isStatsMode, setIsStatsMode] = useState(false);

  const nodeTypes = useMemo(() => ({
    event: (props) => <DefaultNode {...props} nodeType="event" />,
    action: (props) => <DefaultNode {...props} nodeType="action" />,
    condition: (props) => <DefaultNode {...props} nodeType="condition" />,
  }), []);

  const emailOptions = useMemo(() => {
    return nodes
      .filter((n) => n.type === 'action' && n?.data?.actionType === 'send_email')
      .map((n) => ({ id: n.id, name: n?.data?.subject || n?.data?.label || `Email ${n.id}` }));
  }, [nodes]);

  const downstreamEmailIds = useMemo(() => {
    if (!selected) return new Set();
    const queue = [selected.id];
    const visited = new Set(queue);
    const result = new Set();
    while (queue.length) {
      const curr = queue.shift();
      edges.filter((e) => e.source === curr).forEach((e) => {
        const t = e.target;
        if (!visited.has(t)) {
          visited.add(t);
          queue.push(t);
        }
      });
    }
    nodes.forEach((n) => {
      if (visited.has(n.id) && n.id !== selected.id && n.type === 'action' && n?.data?.actionType === 'send_email') {
        result.add(n.id);
      }
    });
    return result;
  }, [selected, edges, nodes]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const newEdge = { ...params, id: `e-${Math.random().toString(36).slice(2, 8)}` };
      if (sourceNode?.type === 'condition') {
        const path = params.sourceHandle === 'yes' ? 'yes' : 'no';
        newEdge.data = { ...(newEdge.data || {}), path };
        newEdge.label = path;
      }
      return addEdge(newEdge, eds);
    });
  }, [setEdges, nodes]);

  const onNodeClick = useCallback((_e, node) => {
    setSelected(node);
  }, []);



  const onNodeUpdate = (updatedNode) => {
    setNodes((nds) => nds.map((n) => (n.id === updatedNode.id ? updatedNode : n)));
    setSelected(updatedNode);
  };

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSave = async () => {
    await saveChain({ nodes, edges });
    alert('Saved');
  };

  const handleLoad = async () => {
    const chain = await loadChain();
    if (chain) {
      setNodes(chain.nodes);
      setEdges(chain.edges);
      setSelected(null);
    } else {
      alert('No saved chain found');
    }
  };

  const handleSimulate = async () => {
    try {
      console.log('Starting simulation with:', { nodes, edges, now, contextInputs });
      
      // Find the first event node to determine trigger type
      const firstEvent = nodes.find(n => n.type === 'event');
      if (!firstEvent) {
        alert('Нет событий в цепочке для симуляции');
        return;
      }
      
      const trigger = { 
        type: firstEvent.data?.eventType || 'contact_added', 
        payload: { 
          listName: firstEvent.data?.listName || 'Newsletter', 
          email: 'user@example.com' 
        } 
      };
      
      console.log('Using trigger:', trigger);
      
      const result = await simulate({ nodes, edges }, trigger, { now, ...contextInputs });
      console.log('Simulation result:', result);
      console.log('userMessages from result:', result.userMessages);
      console.log('logs from result:', result.logs);
      
      setLogs(result.logs || []);
      setUserMessages(result.userMessages || []);
      console.log('userMessages state after set:', result.userMessages || []);
      if (result.context?.now) setNow(result.context.now);
      setModalOpen(true);
    } catch (error) {
      console.error('Simulation error:', error);
      alert(`Ошибка симуляции: ${error.message}`);
    }
  };

  useEffect(() => {
    // Ensure a clean selection if node removed
    if (selected && !nodes.find((n) => n.id === selected.id)) {
      setSelected(null);
    }
  }, [nodes, selected]);

  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h1>Ошибка в приложении</h1>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Попробовать снова</button>
      </div>
    );
  }

  try {
    return (
      <>
        <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
          <div className="ui-panel" style={{ width: 280 }}>
            <div className="ui-panel-header">
              <h2 className="ui-title">Конструктор цепочек писем</h2>
            </div>
            
            <div className="ui-section">
              <div className="ui-field">
                <label className="ui-label">Режим работы</label>
                <div className="ui-row" style={{ gap: 8 }}>
                  <button 
                    className={`ui-button ${!isStatsMode ? 'ui-button-primary' : 'ui-button-outline'}`}
                    onClick={() => setIsStatsMode(false)}
                    style={{ flex: 1 }}
                  >
                    Редактирование
                  </button>
                  <button 
                    className={`ui-button ${isStatsMode ? 'ui-button-primary' : 'ui-button-outline'}`}
                    onClick={() => setIsStatsMode(true)}
                    style={{ flex: 1 }}
                  >
                    Статистика
                  </button>
                </div>
              </div>
            </div>

            {!isStatsMode ? (
              <div className="ui-section">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <button className="ui-button ui-button-outline--event" draggable onDragStart={(e) => onDragStart(e, 'event')}>Добавить событие</button>
                  <button className="ui-button ui-button-outline--action" draggable onDragStart={(e) => onDragStart(e, 'action')}>Добавить действие</button>
                  <button className="ui-button ui-button-outline--condition" draggable onDragStart={(e) => onDragStart(e, 'condition')}>Добавить условие</button>
                </div>

                <div className="ui-row" style={{ marginBottom: 8 }}>
                  <button className="ui-button" onClick={handleSave}>Сохранить</button>
                  <button className="ui-button" onClick={handleLoad}>Загрузить</button>
                </div>

                <div className="ui-field">
                  <button className="ui-accordion" onClick={() => setSimOpen((v) => !v)}>
                    <span>Контекст симуляции</span>
                    <span className="ui-badge">локально</span>
                    <span style={{ marginLeft: 'auto' }}>{simOpen ? '▲' : '▼'}</span>
                  </button>
                </div>
                {simOpen && (
                  <>
                    <div className="ui-field">
                      <label className="ui-label">Текущее время (ISO)</label>
                      <input className="ui-input" value={now} onChange={(e) => setNow(e.target.value)} />
                    </div>
                    <div className="ui-field">
                      <label className="ui-label">Открытие писем</label>
                      <select 
                        className="ui-select" 
                        value={contextInputs.emailOpened || ''} 
                        onChange={(e) => setContextInputs((c) => ({ ...c, emailOpened: e.target.value }))}
                      >
                        <option value="">Не открыто</option>
                        {emailOptions.map((email) => (
                          <option key={email.id} value={email.id}>
                            {email.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="ui-field">
                      <label className="ui-label">Клик по письмам</label>
                      <select 
                        className="ui-select" 
                        value={contextInputs.emailClicked || ''} 
                        onChange={(e) => setContextInputs((c) => ({ ...c, emailClicked: e.target.value }))}
                      >
                        <option value="">Не кликнуто</option>
                        {emailOptions.map((email) => (
                          <option key={email.id} value={email.id}>
                            {email.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button className="ui-button ui-button-primary" onClick={handleSimulate} style={{ width: '100%', marginBottom: 12 }}>Запустить симуляцию</button>
                  </>
                )}

                <div className="ui-field">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Логи</div>
                  <div className="ui-logs">
                    {(logs || []).map((l, i) => (
                      <div key={i} style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, marginBottom: 4 }}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ui-section">
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#6366f1' }}>
                    📊 Режим статистики
                  </div>
                  <div style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5' }}>
                    Наведите курсор на любой узел цепочки для просмотра статистики
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex' }}>
        <ReactFlowProvider>
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            setNodes={setNodes}
            setSelected={setSelected}
            isStatsMode={isStatsMode}
          />
          {!isStatsMode && (
            <div className="ui-panel ui-panel-right" style={{ width: 360 }}>
              <NodeInspector
                node={selected}
                onChange={onNodeUpdate}
                emailOptions={emailOptions.map((opt) => ({ ...opt, isFuture: downstreamEmailIds.has(opt.id) }))}
              />
            </div>
          )}
        </ReactFlowProvider>
      </div>
      <SimulationModal open={modalOpen} steps={logs} userMessages={userMessages} onClose={() => setModalOpen(false)} />
        </div>
      </>
    );
  } catch (err) {
    console.error('Render error:', err);
    setError(err.message || 'Неизвестная ошибка рендера');
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h1>Ошибка в приложении</h1>
        <p>{err.message || 'Неизвестная ошибка'}</p>
        <button onClick={() => setError(null)}>Попробовать снова</button>
      </div>
    );
  }
}

function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick, nodeTypes, setNodes, setSelected, isStatsMode }) {
  try {
    const { project } = useReactFlow();
    const wrapperRef = useRef(null);
    const [tooltipState, setTooltipState] = useState({ isVisible: false, node: null, position: { x: 0, y: 0 } });

    const onDragOver = useCallback((event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event) => {
      if (isStatsMode) return; // Отключаем в режиме статистики
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      const id = `${type}-${Math.random().toString(36).slice(2, 7)}`;
      const base = { id, type, position, data: { label: type } };
      if (type === 'event') base.data = { ...base.data, eventType: 'contact_added' };
      if (type === 'action') base.data = { ...base.data, actionType: 'wait', delayValue: 1, delayUnit: 'days' };
      if (type === 'condition') base.data = { ...base.data, conditionType: 'date', operator: '>', value: '' };
      setNodes((nds) => nds.concat(base));
      setSelected(base);
    }, [project, setNodes, setSelected, isStatsMode]);

    const onNodeMouseEnter = useCallback((_e, node) => {
      if (!isStatsMode) return;
      setTooltipState({
        isVisible: true,
        node,
        position: { 
          x: _e.clientX + 20, 
          y: _e.clientY - 20
        }
      });
    }, [isStatsMode]);

    const onNodeMouseLeave = useCallback(() => {
      if (!isStatsMode) return;
      setTooltipState(prev => ({ ...prev, isVisible: false }));
    }, [isStatsMode]);

    return (
      <div ref={wrapperRef} style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isStatsMode ? undefined : onNodesChange}
          onEdgesChange={isStatsMode ? undefined : onEdgesChange}
          onConnect={isStatsMode ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodeTypes={nodeTypes}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background gap={12} size={1} />
        </ReactFlow>
        
        {isStatsMode && (
          <StatsTooltip
            node={tooltipState.node}
            isVisible={tooltipState.isVisible}
            position={tooltipState.position}
          />
        )}
      </div>
    );
  } catch (err) {
    console.error('FlowCanvas error:', err);
    return (
      <div style={{ padding: 20, color: 'red', flex: 1 }}>
        <h3>Ошибка в холсте</h3>
        <p>{err.message || 'Неизвестная ошибка'}</p>
      </div>
    );
  }
}


