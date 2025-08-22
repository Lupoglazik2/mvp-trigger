import React, { useRef } from 'react';

export default function NodeInspector({ node, onChange, emailOptions = [] }) {
  if (!node) return <div className="ui-section" style={{ color: '#666' }}>Select a node to edit.</div>;

  const isEvent = node.type === 'event';
  const isAction = node.type === 'action';
  const isCondition = node.type === 'condition';

  const set = (key, value) => {
    onChange({ ...node, data: { ...node.data, [key]: value } });
  };

  const fileInputRef = useRef(null);
  const handleAddFile = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const names = files.map((f) => f.name);
    const current = Array.isArray(node.data?.attachments) ? node.data.attachments : [];
    set('attachments', current.concat(names));
    // reset input value to allow re-adding same file names
    e.target.value = '';
  };
  const handleChooseTemplate = () => {
    const name = window.prompt('Введите название шаблона');
    if (name) set('templateName', name);
  };

  const handleConditionTypeChange = (newType) => {
    const nextData = { ...node.data, conditionType: newType };
    if (newType === 'opened' || newType === 'clicked') {
      nextData.value = 'true';
      delete nextData.operator;
    } else if (newType === 'date' || newType === 'time') {
      nextData.operator = node.data?.operator || '>';
      // keep previous value if user set it; otherwise empty
      if (typeof nextData.value === 'undefined') nextData.value = '';
    }
    onChange({ ...node, data: nextData });
  };

  return (
    <div className="ui-section">
      <h3 className="ui-h3">Свойства узла</h3>
      <div className="ui-field">
        <label className="ui-label">Заголовок</label>
        <input
          className="ui-input"
          value={node.data?.label || ''}
          onChange={(e) => set('label', e.target.value)}
          placeholder="Подпись узла"
        />
      </div>

      {isEvent && (
        <div>
          <div className="ui-field">
            <label className="ui-label">Тип события</label>
            <select
              className="ui-select"
              value={node.data?.eventType || 'contact_added'}
              onChange={(e) => set('eventType', e.target.value)}
            >
              <option value="contact_added">Контакт добавлен</option>
              <option value="date">Конкретная дата</option>
            </select>
          </div>
          {node.data?.eventType === 'contact_added' && (
            <div className="ui-field">
              <label className="ui-label">Список</label>
              <select
                className="ui-select"
                value={node.data?.listName || 'тестовый'}
                onChange={(e) => set('listName', e.target.value)}
              >
                <option value="тестовый">тестовый</option>
                <option value="мои контакты">мои контакты</option>
              </select>
            </div>
          )}
          {node.data?.eventType === 'date' && (
            <div className="ui-field">
              <label className="ui-label">Дата</label>
              <input
                className="ui-input"
                type="date"
                value={node.data?.date || ''}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
          )}
          {node.data?.eventType === 'date' && (
            <div className="ui-field">
              <label className="ui-label">Для всех контактов из списка</label>
              <select
                className="ui-select"
                value={node.data?.listName || 'тестовый'}
                onChange={(e) => set('listName', e.target.value)}
              >
                <option value="тестовый">тестовый</option>
                <option value="мои контакты">мои контакты</option>
              </select>
            </div>
          )}
        </div>
      )}

      {isAction && (
        <div>
          <div className="ui-field">
            <label className="ui-label">Тип действия</label>
            <select
              className="ui-select"
              value={node.data?.actionType || 'wait'}
              onChange={(e) => set('actionType', e.target.value)}
            >
              <option value="wait">Ожидание</option>
              <option value="send_email">Отправить письмо</option>
              <option value="stop">Остановить цепочку</option>
            </select>
          </div>
          {node.data?.actionType === 'wait' && (
            <div className="ui-row" style={{ marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label className="ui-label">Задержка</label>
                <input
                  className="ui-input"
                  type="number"
                  min="0"
                  value={node.data?.delayValue || 1}
                  onChange={(e) => set('delayValue', e.target.value)}
                />
              </div>
              <div>
                <label className="ui-label">Единица</label>
                <select
                  className="ui-select"
                  value={node.data?.delayUnit || 'days'}
                  onChange={(e) => set('delayUnit', e.target.value)}
                >
                  <option value="days">дни</option>
                  <option value="hours">часы</option>
                </select>
              </div>
            </div>
          )}
          {node.data?.actionType === 'send_email' && (
            <div>
              <div className="ui-field">
                <label className="ui-label">Отправитель</label>
                <select
                  className="ui-select"
                  value={node.data?.sender || 'irina@ruru.ru'}
                  onChange={(e) => set('sender', e.target.value)}
                >
                  <option value="irina@ruru.ru">irina@ruru.ru</option>
                  <option value="no-reply@example.com">no-reply@example.com</option>
                </select>
              </div>
              <div className="ui-field">
                <label className="ui-label">Тема</label>
                <input
                  className="ui-input"
                  value={node.data?.subject || ''}
                  onChange={(e) => set('subject', e.target.value)}
                  placeholder="Здравствуйте!"
                />
              </div>
              <div className="ui-field">
                <label className="ui-label">Прехедер</label>
                <input
                  className="ui-input"
                  value={node.data?.preheader || ''}
                  onChange={(e) => set('preheader', e.target.value)}
                  placeholder="Краткий текст предпросмотра"
                />
              </div>


              <div className="ui-field">
                <label className="ui-label">Шаблон письма</label>
                <div className="ui-row">
                  <button className="ui-button" onClick={handleChooseTemplate}>Выбрать шаблон</button>
                  {node.data?.templateName && (
                    <span className="ui-chip">{node.data.templateName}</span>
                  )}
                </div>
              </div>

              <div className="ui-field">
                <label className="ui-label">Дополнительно</label>
                <div className="ui-row" style={{ marginBottom: 8 }}>
                  <button className="ui-button" onClick={handleAddFile}>Добавить файл</button>
                  <input ref={fileInputRef} type="file" style={{ display: 'none' }} multiple onChange={handleFilesSelected} />
                </div>
                {Array.isArray(node.data?.attachments) && node.data.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {node.data.attachments.map((name, idx) => (
                      <span key={idx} className="ui-chip">{name}</span>
                    ))}
                  </div>
                )}
                <div className="ui-field" style={{ marginTop: 10 }}>
                  <label className="ui-label">UTM-метки</label>
                  <input
                    className="ui-input"
                    value={node.data?.utm || ''}
                    onChange={(e) => set('utm', e.target.value)}
                    placeholder="Добавить метку к ссылкам"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isCondition && (
        <div>
          <div className="ui-field">
            <label className="ui-label">Тип условия</label>
            <select
              className="ui-select"
              value={node.data?.conditionType || 'opened'}
              onChange={(e) => handleConditionTypeChange(e.target.value)}
            >
              <option value="date">Дата</option>
              <option value="time">Время</option>
              <option value="opened">Открытие письма (mock)</option>
              <option value="clicked">Клик по письму (mock)</option>
            </select>
          </div>

          {['date', 'time'].includes(node.data?.conditionType) && (
            <div className="ui-field">
              <label className="ui-label">Оператор</label>
              <select
                className="ui-select"
                value={node.data?.operator || '>'}
                onChange={(e) => set('operator', e.target.value)}
              >
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
                <option value="=">=</option>
              </select>
            </div>
          )}

          {['date'].includes(node.data?.conditionType) && (
            <div className="ui-field">
              <label className="ui-label">Дата</label>
              <input
                className="ui-input"
                type="date"
                value={node.data?.value || ''}
                onChange={(e) => set('value', e.target.value)}
              />
            </div>
          )}
          {node.data?.conditionType === 'time' && (
            <div className="ui-field">
              <label className="ui-label">Время (HH:MM)</label>
              <input
                className="ui-input"
                type="time"
                value={node.data?.value || ''}
                onChange={(e) => set('value', e.target.value)}
              />
            </div>
          )}
          {['opened', 'clicked'].includes(node.data?.conditionType) && (
            <>
              <div className="ui-field">
                <label className="ui-label">Письмо из цепочки</label>
                <select
                  className="ui-select"
                  value={node.data?.emailRef || ''}
                  onChange={(e) => set('emailRef', e.target.value)}
                >
                  <option value="">—</option>
                  {emailOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} style={opt.isFuture ? { color: '#9ca3af' } : undefined}>
                      {opt.name}{opt.isFuture ? ' (позже по цепочке)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="ui-field">
                <label className="ui-label">Ждать</label>
                <div className="ui-row" style={{ marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label className="ui-label">Дни</label>
                    <input
                      className="ui-input"
                      type="number"
                      min="0"
                      value={node.data?.waitDays || 0}
                      onChange={(e) => set('waitDays', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="ui-label">Минуты</label>
                    <input
                      className="ui-input"
                      type="number"
                      min="0"
                      value={node.data?.waitMinutes || 0}
                      onChange={(e) => set('waitMinutes', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="ui-field">
                  <label className="ui-label">Секунды</label>
                  <input
                    className="ui-input"
                    type="number"
                    min="0"
                    value={node.data?.waitSeconds || 0}
                    onChange={(e) => set('waitSeconds', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


