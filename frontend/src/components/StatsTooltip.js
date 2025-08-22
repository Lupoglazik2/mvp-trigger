import React from 'react';

export default function StatsTooltip({ node, isVisible, position }) {
  if (!isVisible || !node) return null;

  // Тестовые данные статистики (в реальном приложении будут приходить с сервера)
  const getNodeStats = (nodeType, nodeData) => {
    const baseStats = {
      passed: 40,
      waiting: 3
    };

    if (nodeType === 'condition') {
      return {
        ...baseStats,
        yesPath: 15,
        noPath: 16
      };
    }

    if (nodeType === 'action' && nodeData?.actionType === 'stop') {
      return {
        passed: 40
        // Для узла "Остановить цепочку" показываем только количество прошедших
      };
    }

    return baseStats;
  };

  const stats = getNodeStats(node.type, node.data);

  // Позиционирование tooltip с учетом границ экрана
  const tooltipWidth = 200;
  const tooltipHeight = 120;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  let left = position.x;
  let top = position.y;
  let showArrowLeft = false;
  
  // Если tooltip выходит за правую границу, показываем слева от узла
  if (left + tooltipWidth > screenWidth - 20) {
    left = position.x - tooltipWidth - 20;
    showArrowLeft = true;
  }
  
  // Если tooltip выходит за нижнюю границу, показываем выше
  if (top + tooltipHeight > screenHeight - 20) {
    top = position.y - tooltipHeight;
  }
  
  return (
    <div 
      className="stats-tooltip"
      style={{
        position: 'fixed',
        left: left,
        top: top,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: 1000,
        minWidth: '200px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'none',
        '--arrow-position': showArrowLeft ? 'left' : 'right'
      }}
    >
      <div style={{ fontWeight: '600', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', paddingBottom: '4px' }}>
        Статистика узла
      </div>
      
      <div style={{ marginBottom: '6px' }}>
        <span style={{ color: '#a0aec0' }}>Прошло узел: </span>
        <span style={{ color: '#48bb78', fontWeight: '600' }}>{stats.passed}</span>
      </div>
      
      {stats.waiting !== undefined && (
        <div style={{ marginBottom: '6px' }}>
          <span style={{ color: '#a0aec0' }}>Ждут в узле: </span>
          <span style={{ color: '#ed8936', fontWeight: '600' }}>{stats.waiting}</span>
        </div>
      )}
      
      {stats.yesPath !== undefined && (
        <div style={{ marginBottom: '6px' }}>
          <span style={{ color: '#a0aec0' }}>Да: </span>
          <span style={{ color: '#48bb78', fontWeight: '600' }}>{stats.yesPath}</span>
        </div>
      )}
      
      {stats.noPath !== undefined && (
        <div style={{ marginBottom: '6px' }}>
          <span style={{ color: '#a0aec0' }}>Нет: </span>
          <span style={{ color: '#f56565', fontWeight: '600' }}>{stats.noPath}</span>
        </div>
      )}
    </div>
  );
}
