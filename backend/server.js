const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const STORAGE_FILE = path.join(__dirname, 'storage.json');

function readStorage() {
  try {
    const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { chain: null };
  }
}

function writeStorage(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Load current chain (single-chain MVP)
app.get('/api/chain', (_req, res) => {
  const store = readStorage();
  res.json({ chain: store.chain });
});

// Save current chain
app.post('/api/chain', (req, res) => {
  const chain = req.body?.chain;
  if (!chain || !Array.isArray(chain.nodes) || !Array.isArray(chain.edges)) {
    return res.status(400).json({ error: 'Invalid chain: expected { nodes: [], edges: [] }' });
  }
  const store = { chain };
  writeStorage(store);
  res.json({ ok: true });
});

// Mock email sender
async function mockSendEmail({ to, subject, body }) {
  const id = Math.random().toString(36).slice(2);
  console.log('[MockSendEmail]', { id, to, subject, body });
  await new Promise((r) => setTimeout(r, 50));
  return { id, ok: true };
}

// Utility: find next nodes from current via edges, optionally by condition path
function getOutgoingTargets(nodeId, edges, opts = {}) {
  const { pathLabel } = opts; // 'yes' | 'no' | undefined
  return edges
    .filter((e) => e.source === nodeId)
    .filter((e) => {
      if (!pathLabel) return true;
      const edgePath = e?.data?.path || (typeof e.label === 'string' ? e.label.toLowerCase() : undefined);
      return edgePath === pathLabel;
    })
    .map((e) => e.target);
}

function findNodeById(nodes, id) {
  return nodes.find((n) => n.id === id);
}

function asDate(input) {
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d;
}

// Evaluate condition node
function evaluateCondition(node, ctx) {
  const type = node?.data?.conditionType; // 'date' | 'time' | 'opened' | 'clicked'
  const operator = node?.data?.operator || '>';
  const value = node?.data?.value; // date string or time HH:MM or boolean-like

  if (type === 'opened') {
    // Получаем ID письма, которое нужно проверить
    let emailId = node.data?.emailRef || node.data?.emailId;
    
    // Если в условии не указан emailRef, используем глобальное значение
    if (!emailId && ctx.emailOpened) {
      emailId = ctx.emailOpened;
      console.log('Using global emailOpened setting:', emailId);
    }
    
    console.log('Evaluating opened condition for email:', emailId);
    
    // Проверяем, было ли открыто конкретное письмо
    let isOpened = false;
    if (emailId && ctx.emails && ctx.emails[emailId]) {
      isOpened = ctx.emails[emailId].opened || false;
      console.log('Found email in context:', ctx.emails[emailId]);
    } else {
      console.log('Email not found in context or no emailId specified');
    }
    
    console.log('Email opened status:', { emailId, isOpened, expected: true });
    
    // Для условий "opened" всегда ожидаем true
    const result = isOpened === true;
    console.log('Opened condition result:', result);
    
    // Check wait time if specified
    if (result && (node.data?.waitDays || node.data?.waitMinutes || node.data?.waitSeconds)) {
      const waitDays = node.data.waitDays || 0;
      const waitMinutes = node.data.waitMinutes || 0;
      const waitSeconds = node.data.waitSeconds || 0;
      
      // Calculate total wait time in milliseconds
      const totalWaitMs = (waitDays * 24 * 60 * 60 * 1000) + (waitMinutes * 60 * 1000) + (waitSeconds * 1000);
      
      // Check if enough time has passed since the email was sent
      const timeSinceEmail = Date.now() - new Date(ctx.now).getTime();
      return timeSinceEmail >= totalWaitMs;
    }
    
    return result;
  }
  if (type === 'clicked') {
    // Получаем ID письма, которое нужно проверить
    let emailId = node.data?.emailRef || node.data?.emailId;
    
    // Если в условии не указан emailRef, используем глобальное значение
    if (!emailId && ctx.emailClicked) {
      emailId = ctx.emailClicked;
      console.log('Using global emailClicked setting:', emailId);
    }
    
    console.log('Evaluating clicked condition for email:', emailId);
    
    // Проверяем, был ли клик по конкретному письму
    let isClicked = false;
    if (emailId && ctx.emails && ctx.emails[emailId]) {
      isClicked = ctx.emails[emailId].clicked || false;
      console.log('Found email in context:', ctx.emails[emailId]);
    } else {
      console.log('Email not found in context or no emailId specified');
    }
    
    console.log('Email clicked status:', { emailId, isClicked, expected: true });
    
    // Для условий "clicked" всегда ожидаем true
    const result = isClicked === true;
    console.log('Clicked condition result:', result);
    
    // Check wait time if specified
    if (result && (node.data?.waitDays || node.data?.waitMinutes || node.data?.waitSeconds)) {
      const waitDays = node.data.waitDays || 0;
      const waitMinutes = node.data.waitMinutes || 0;
      const waitSeconds = node.data.waitSeconds || 0;
      
      // Calculate total wait time in milliseconds
      const totalWaitMs = (waitDays * 24 * 60 * 60 * 1000) + (waitMinutes * 60 * 1000) + (waitSeconds * 1000);
    
      // Check if enough time has passed since the email was sent
      const timeSinceEmail = Date.now() - new Date(ctx.now).getTime();
      return timeSinceEmail >= totalWaitMs;
    }
    
    return result;
  }
  if (type === 'date') {
    const now = asDate(ctx.now);
    const cmp = asDate(value);
    if (!now || !cmp) return false;
    if (operator === '>') return now > cmp;
    if (operator === '>=') return now >= cmp;
    if (operator === '<') return now < cmp;
    if (operator === '<=') return now <= cmp;
    return now.getTime() === cmp.getTime();
  }
  if (type === 'time') {
    // Compare HH:MM against now's HH:MM
    const [h, m] = String(value || '').split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return false;
    const now = new Date(ctx.now);
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const minutesVal = h * 60 + m;
    if (operator === '>') return minutesNow > minutesVal;
    if (operator === '>=') return minutesNow >= minutesVal;
    if (operator === '<') return minutesNow < minutesVal;
    if (operator === '<=') return minutesNow <= minutesVal;
    return minutesNow === minutesVal;
  }
  return false;
}

function addDelay(nowIso, delayValue, delayUnit) {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) return nowIso;
  const value = parseInt(delayValue, 10) || 0;
  if (delayUnit === 'hours') {
    now.setHours(now.getHours() + value);
  } else {
    // default days
    now.setDate(now.getDate() + value);
  }
  return now.toISOString();
}

// Simulate chain execution
app.post('/api/simulate', async (req, res) => {
  const chain = req.body?.chain || readStorage().chain;
  const trigger = req.body?.trigger || { type: 'contact_added', payload: {} };
  const context = req.body?.context || { now: new Date().toISOString(), emailOpened: false, emailClicked: false };
  
  // Инициализируем объект для отслеживания писем
  if (!context.emails) context.emails = {};
  
  // Применяем глобальные настройки к письмам СРАЗУ при инициализации
  // Это нужно, чтобы условия могли использовать эти настройки
  if (context.emailOpened) {
    console.log('Pre-initializing emailOpened for:', context.emailOpened);
    context.emails[context.emailOpened] = {
      opened: true,
      clicked: false
    };
  }
  
  if (context.emailClicked) {
    console.log('Pre-initializing emailClicked for:', context.emailClicked);
    if (!context.emails[context.emailClicked]) {
      context.emails[context.emailClicked] = { opened: false, clicked: false };
    }
    context.emails[context.emailClicked].clicked = true;
  }

  if (!chain || !Array.isArray(chain.nodes) || !Array.isArray(chain.edges)) {
    return res.status(400).json({ error: 'No valid chain provided' });
  }

  const logs = [];
  const userMessages = []; // Отдельный массив для человекочитаемых сообщений
  const nodes = chain.nodes;
  const edges = chain.edges;
  
  console.log('Simulation started with:', { 
    nodesCount: nodes.length, 
    edgesCount: edges.length,
    trigger: trigger,
    context: context 
  });
  console.log('Context details:', {
    now: context.now,
    emailOpened: context.emailOpened,
    emailClicked: context.emailClicked
  });
  console.log('Initial userMessages:', userMessages);

  // Identify start nodes by matching event type
  const eventNodes = nodes.filter((n) => n.type === 'event');

  const matchingStarts = eventNodes.filter((n) => {
    const evtType = n?.data?.eventType || 'contact_added';
    if (evtType !== trigger.type) return false;
    if (evtType === 'contact_added') {
      // Optional list match
      const listName = n?.data?.listName;
      if (!listName) return true;
      return trigger?.payload?.listName ? trigger.payload.listName === listName : true;
    }
    if (evtType === 'date') {
      const occurs = asDate(n?.data?.date);
      const now = asDate(context.now);
      return !!occurs && !!now && now >= occurs;
    }
    return true;
  });

  if (matchingStarts.length === 0) {
    logs.push('No matching start event nodes for the specified trigger.');
    return res.json({ logs, userMessages, context });
  }

  // BFS/DFS through the graph from each start; for MVP, take first start
  const startNode = matchingStarts[0];
  let currentNode = startNode;
  let safetyCounter = 0;
  const maxSteps = 100; // prevent infinite loops

  logs.push(`Start at event: ${currentNode.data?.eventType}`);
  
  // Add human-readable start message
  let startMessage = '';
  if (currentNode.data?.eventType === 'contact_added') {
    startMessage = '🚀 Запустил цепочку: новый контакт добавлен';
  } else if (currentNode.data?.eventType === 'date') {
    startMessage = '📅 Запустил цепочку: наступила заданная дата';
  }
  if (startMessage) {
    userMessages.push(startMessage);
    console.log('Added start message:', startMessage, 'userMessages now:', userMessages);
  }

  while (currentNode && safetyCounter < maxSteps) {
    safetyCounter += 1;
    if (currentNode.type === 'event') {
      const nextIds = getOutgoingTargets(currentNode.id, edges);
      if (nextIds.length === 0) break;
      currentNode = findNodeById(nodes, nextIds[0]);
      continue;
    }
    if (currentNode.type === 'action') {
      const actionType = currentNode?.data?.actionType;
      if (actionType === 'wait') {
        const delayValue = currentNode?.data?.delayValue || 1;
        const delayUnit = currentNode?.data?.delayUnit || 'days';
        const newNow = addDelay(context.now, delayValue, delayUnit);
        
        // Format delay description in Russian
        let delayDesc = 'Ждал ';
        if (delayUnit === 'days') {
          delayDesc += `${delayValue} ${delayValue === 1 ? 'день' : delayValue < 5 ? 'дня' : 'дней'}`;
        } else if (delayUnit === 'hours') {
          delayDesc += `${delayValue} ${delayValue === 1 ? 'час' : delayValue < 5 ? 'часа' : 'часов'}`;
        } else {
          delayDesc += `${delayValue} ${delayValue === 1 ? 'минуту' : delayValue < 5 ? 'минуты' : 'минут'}`;
        }
        
        logs.push(`Waited ${delayValue} ${delayUnit}. Time advanced from ${context.now} to ${newNow}`);
        userMessages.push(delayDesc);
        console.log('Added delay message:', delayDesc, 'userMessages now:', userMessages);
        context.now = newNow;
      } else if (actionType === 'send_email') {
        const subject = currentNode?.data?.subject || 'Hello from MVP';
        const body = currentNode?.data?.body || 'This is a test email.';
        const to = trigger?.payload?.email || 'test@example.com';
        const result = await mockSendEmail({ to, subject, body });
        
        // Сохраняем информацию о письме в контексте
        if (!context.emails) context.emails = {};
        const emailId = currentNode.id;
        
        // Сохраняем письмо, но не перезаписываем уже установленные настройки opened/clicked
        const existingSettings = context.emails[emailId] || {};
        context.emails[emailId] = {
          id: result.id,
          subject: subject,
          sentAt: context.now,
          opened: existingSettings.opened || false,
          clicked: existingSettings.clicked || false
        };
        
        // Также сохраняем под внутренним ID для совместимости
        context.emails[result.id] = context.emails[emailId];
        
        logs.push(`Sent email to ${to} (id=${result.id}) with subject: "${subject}"`);
        userMessages.push(`📧 Отправил письмо "${subject}"`);
        console.log('Added email message:', `📧 Отправил письмо "${subject}"`, 'userMessages now:', userMessages);
        console.log('Saved email to context under keys:', { emailId, internalId: result.id });
        console.log('Email data:', context.emails[emailId]);
      } else if (actionType === 'stop') {
        logs.push('Chain stopped.');
        userMessages.push('🛑 Цепочка завершена');
        console.log('Added stop message:', '🛑 Цепочка завершена', 'userMessages now:', userMessages);
        break;
      } else {
        logs.push(`Unknown action: ${actionType}`);
      }
      const nextIds = getOutgoingTargets(currentNode.id, edges);
      if (nextIds.length === 0) break;
      currentNode = findNodeById(nodes, nextIds[0]);
      continue;
    }
    if (currentNode.type === 'condition') {
      const conditionResult = evaluateCondition(currentNode, context);
      console.log('=== CONDITION DEBUG START ===');
      console.log('Condition evaluation result:', { 
        nodeId: currentNode.id, 
        conditionType: currentNode?.data?.conditionType, 
        result: conditionResult 
      });
      console.log('conditionResult value:', conditionResult);
      console.log('conditionResult type:', typeof conditionResult);
      console.log('=== CONDITION DEBUG END ===');
      let conditionDesc = `Condition (${currentNode?.data?.conditionType}`;
      
      if (['opened', 'clicked'].includes(currentNode?.data?.conditionType)) {
        if (currentNode?.data?.waitDays || currentNode?.data?.waitMinutes || currentNode?.data?.waitSeconds) {
          const days = currentNode.data.waitDays || 0;
          const minutes = currentNode.data.waitMinutes || 0;
          const seconds = currentNode.data.waitSeconds || 0;
          
          // Log the wait time before checking condition
          let waitDesc = 'Ждал ';
          if (days > 0) waitDesc += `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
          if (minutes > 0) waitDesc += `${days > 0 ? ' ' : ''}${minutes} ${minutes === 1 ? 'минуту' : minutes < 5 ? 'минуты' : 'минут'}`;
          if (seconds > 0) waitDesc += `${(days > 0 || minutes > 0) ? ' ' : ''}${seconds} ${seconds === 1 ? 'секунду' : seconds < 5 ? 'секунды' : 'секунд'}`;
          
          logs.push(`Condition wait: ${days}д ${minutes}м ${seconds}с`);
          userMessages.push(waitDesc);
          conditionDesc += ` ждать ${days}д ${minutes}м ${seconds}с`;
        }
      } else {
        conditionDesc += ` ${currentNode?.data?.operator || ''} ${currentNode?.data?.value || ''}`;
      }
      
      console.log('Before conditionDesc - conditionResult:', conditionResult);
      conditionDesc += `) → ${conditionResult ? 'YES' : 'NO'}`;
      logs.push(conditionDesc);
      
      // Add human-readable condition result
      let conditionMessage = '';
      if (currentNode?.data?.conditionType === 'opened') {
        console.log('Before opened message - conditionResult:', conditionResult);
        conditionMessage = conditionResult ? '✅ Письмо было открыто' : '❌ Письмо не было открыто';
        console.log('Opened condition message:', { conditionResult, conditionMessage });
      } else if (currentNode?.data?.conditionType === 'clicked') {
        console.log('Before clicked message - conditionResult:', conditionResult);
        conditionMessage = conditionResult ? '✅ Письмо было кликнуто' : '❌ Письмо не было кликнуто';
        console.log('Clicked condition message:', { conditionResult, conditionMessage });
      } else if (currentNode?.data?.conditionType === 'date') {
        conditionMessage = conditionResult ? '✅ Дата соответствует условию' : '❌ Дата не соответствует условию';
      } else if (currentNode?.data?.conditionType === 'time') {
        conditionMessage = conditionResult ? '✅ Время соответствует условию' : '❌ Время не соответствует условию';
      }
      if (conditionMessage) {
        userMessages.push(conditionMessage);
        console.log('Added condition message to userMessages:', conditionMessage);
      }
      
      console.log('Before pathLabel - conditionResult:', conditionResult);
      const pathLabel = conditionResult ? 'yes' : 'no';
      const nextIds = getOutgoingTargets(currentNode.id, edges, { pathLabel });
      const fallback = nextIds.length === 0 ? getOutgoingTargets(currentNode.id, edges) : nextIds;
      if (fallback.length === 0) break;
      currentNode = findNodeById(nodes, fallback[0]);
      continue;
    }
    // Unknown type
    logs.push(`Unknown node type: ${currentNode.type}`);
    break;
  }

  if (safetyCounter >= maxSteps) {
    logs.push('Stopped due to safety limit (possible loop).');
  }

  console.log('Final emails context:', context.emails);
  console.log('Sending response:', { 
    logsCount: logs.length, 
    userMessagesCount: userMessages.length, 
    userMessages: userMessages,
    logs: logs 
  });
  
  return res.json({ logs, userMessages, context });
});

// Minimal event webhook endpoints (mock)
app.post('/api/events/:type', (req, res) => {
  const type = req.params.type;
  console.log('[Webhook Event]', type, req.body || {});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
