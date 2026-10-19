import confetti from 'canvas-confetti';
import { SCENARIOS } from './scenarios.js';
import { SwitchEngine } from './switchEngine.js';

let currentScenarioIndex = 0;
let engine = null;

// DOM Elements
const scenarioSelect = document.getElementById('scenarioSelect');
const scenarioTitle = document.getElementById('scenarioTitle');
const scenarioCategory = document.getElementById('scenarioCategory');
const scenarioDifficulty = document.getElementById('scenarioDifficulty');
const scenarioDesc = document.getElementById('scenarioDesc');
const topologyView = document.getElementById('topologyView');
const objectivesList = document.getElementById('objectivesList');
const progressBadge = document.getElementById('progressBadge');
const congratsBanner = document.getElementById('congratsBanner');
const toggleHintsBtn = document.getElementById('toggleHintsBtn');
const hintsContent = document.getElementById('hintsContent');
const hintsChevron = document.getElementById('hintsChevron');
const resetLabBtn = document.getElementById('resetLabBtn');

// Modal Elements
const levelCompleteModal = document.getElementById('levelCompleteModal');
const modalLevelTitle = document.getElementById('modalLevelTitle');
const modalLevelDesc = document.getElementById('modalLevelDesc');
const modalScoreDisplay = document.getElementById('modalScoreDisplay');
const modalStreakDisplay = document.getElementById('modalStreakDisplay');
const modalResetBtn = document.getElementById('modalResetBtn');
const modalNextBtn = document.getElementById('modalNextBtn');

const terminalScreen = document.getElementById('terminalScreen');
const cmdInput = document.getElementById('cmdInput');
const promptLabel = document.getElementById('promptLabel');
const scoreDisplay = document.getElementById('scoreDisplay');
const streakDisplay = document.getElementById('streakDisplay');
const scoreDeltaBadge = document.getElementById('scoreDeltaBadge');

// Score State
let userScore = 100;
let userStreak = 0;
let deltaTimeout = null;

function updateScore(delta, reason = "") {
  userScore = Math.max(0, userScore + delta);
  if (delta > 0) {
    userStreak++;
  } else if (delta < 0) {
    userStreak = 0;
  }

  // Update UI
  if (scoreDisplay) scoreDisplay.textContent = userScore;
  if (streakDisplay) streakDisplay.textContent = userStreak;

  // Show animated score feedback badge
  if (scoreDeltaBadge) {
    if (deltaTimeout) clearTimeout(deltaTimeout);
    scoreDeltaBadge.classList.remove('hidden', 'bg-emerald-500/20', 'text-emerald-400', 'border-emerald-500/40', 'bg-rose-500/20', 'text-rose-400', 'border-rose-500/40');
    
    if (delta > 0) {
      scoreDeltaBadge.className = 'text-[11px] font-mono font-bold px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse';
      scoreDeltaBadge.textContent = `+${delta} pts`;
    } else if (delta < 0) {
      scoreDeltaBadge.className = 'text-[11px] font-mono font-bold px-2 py-0.5 rounded border bg-rose-500/20 text-rose-400 border-rose-500/40';
      scoreDeltaBadge.textContent = `${delta} pts`;
    }

    deltaTimeout = setTimeout(() => {
      scoreDeltaBadge.classList.add('hidden');
    }, 2500);
  }
}

// Quick command buttons
document.getElementById('btnQuickShowRun')?.addEventListener('click', () => runQuickCmd('show running-config'));
document.getElementById('btnQuickShowVlan')?.addEventListener('click', () => runQuickCmd('show vlan brief'));
document.getElementById('btnQuickShowTrunk')?.addEventListener('click', () => runQuickCmd('show interfaces trunk'));
document.getElementById('btnQuickShowIp')?.addEventListener('click', () => runQuickCmd('show ip interface brief'));
document.getElementById('btnClearTerm')?.addEventListener('click', () => clearTerminal());

// Initialize App
function init() {
  populateScenarioDropdown();
  loadScenario(0);
  setupEvents();
  cmdInput.focus();
}

function populateScenarioDropdown() {
  scenarioSelect.innerHTML = '';
  SCENARIOS.forEach((sc, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = sc.title;
    scenarioSelect.appendChild(opt);
  });
}

function loadScenario(index) {
  currentScenarioIndex = index;
  const sc = SCENARIOS[index];

  // Update left panel
  scenarioTitle.textContent = sc.title;
  scenarioCategory.textContent = sc.category;
  scenarioDifficulty.textContent = sc.difficulty;
  scenarioDesc.textContent = sc.description;

  // Render hints
  hintsContent.innerHTML = '';
  sc.hints.forEach(h => {
    const p = document.createElement('div');
    p.className = 'hint-item';
    p.textContent = `💡 ${h}`;
    hintsContent.appendChild(p);
  });

  // Reset Switch Engine
  engine = new SwitchEngine(sc.initialConfig);

  // Clear and print Banner to Terminal
  clearTerminal();
  printToTerminal(`*******************************************************************************`, 'banner');
  printToTerminal(`* Cisco IOS Software, Catalyst C2960-X / L3 Multilayer Switch Emulator        *`, 'banner');
  printToTerminal(`* Escenario: ${sc.title.toUpperCase()} *`, 'banner');
  printToTerminal(`* Escribe '?' o 'help' para explorar comandos soportados.                     *`, 'banner');
  printToTerminal(`*******************************************************************************\n`, 'banner');

  // Print syslog messages if any in initial scenario
  if (sc.initialConfig.syslogErrors && sc.initialConfig.syslogErrors.length > 0) {
    sc.initialConfig.syslogErrors.forEach(msg => {
      printToTerminal(msg, 'syslog');
    });
  }

  updatePrompt();
  updateTopology();
  closeModal();
  validateLab();
}

function showModal() {
  const sc = SCENARIOS[currentScenarioIndex];
  const isLastScenario = currentScenarioIndex >= SCENARIOS.length - 1;

  if (modalLevelTitle) {
    modalLevelTitle.textContent = `¡Completaste: ${sc.title}!`;
  }
  if (modalLevelDesc) {
    if (isLastScenario) {
      modalLevelDesc.textContent = '¡Impresionante! Has superado con éxito todos los escenarios de simulación Cisco Switch disponibles.';
    } else {
      modalLevelDesc.textContent = 'Has aplicado la configuración requerida y validado la red con éxito. ¿Deseas reiniciar este escenario o avanzar al siguiente nivel?';
    }
  }
  if (modalScoreDisplay) {
    modalScoreDisplay.textContent = `${userScore} pts`;
  }
  if (modalStreakDisplay) {
    modalStreakDisplay.textContent = `🔥 ${userStreak}`;
  }

  if (modalNextBtn) {
    if (isLastScenario) {
      modalNextBtn.innerHTML = `
        <span>Volver al Inicio</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
        </svg>
      `;
    } else {
      modalNextBtn.innerHTML = `
        <span>Avanzar</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
        </svg>
      `;
    }
  }

  if (levelCompleteModal) {
    levelCompleteModal.classList.remove('hidden');
  }
}

function closeModal() {
  if (levelCompleteModal) {
    levelCompleteModal.classList.add('hidden');
  }
}

function advanceScenario() {
  closeModal();
  if (currentScenarioIndex < SCENARIOS.length - 1) {
    const nextIdx = currentScenarioIndex + 1;
    scenarioSelect.value = nextIdx;
    loadScenario(nextIdx);
  } else {
    // Loop back to first scenario
    scenarioSelect.value = 0;
    loadScenario(0);
  }
}

function setupEvents() {
  scenarioSelect.addEventListener('change', (e) => {
    loadScenario(parseInt(e.target.value));
  });

  resetLabBtn.addEventListener('click', () => {
    loadScenario(currentScenarioIndex);
  });

  // Modal Buttons
  modalResetBtn?.addEventListener('click', () => {
    closeModal();
    loadScenario(currentScenarioIndex);
  });

  modalNextBtn?.addEventListener('click', () => {
    advanceScenario();
  });

  toggleHintsBtn.addEventListener('click', () => {
    const isHidden = hintsContent.classList.contains('hidden');
    if (isHidden) {
      hintsContent.classList.remove('hidden');
      hintsChevron.textContent = '▲';
    } else {
      hintsContent.classList.add('hidden');
      hintsChevron.textContent = '▼';
    }
  });

  // Terminal Input Handling
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = cmdInput.value;
      cmdInput.value = '';
      executeCommand(cmd);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (engine.history.length > 0 && engine.historyIndex > 0) {
        engine.historyIndex--;
        cmdInput.value = engine.history[engine.historyIndex] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (engine.historyIndex < engine.history.length - 1) {
        engine.historyIndex++;
        cmdInput.value = engine.history[engine.historyIndex] || '';
      } else {
        engine.historyIndex = engine.history.length;
        cmdInput.value = '';
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      autoComplete(cmdInput.value);
    }
  });

  // Focus terminal input when clicking anywhere inside terminal body
  terminalScreen.addEventListener('click', () => {
    cmdInput.focus();
  });
}

function executeCommand(rawCmd) {
  const prompt = engine.getPrompt();
  printToTerminal(`${prompt} ${rawCmd}`, 'cmd-echo');

  // Check objective state before executing
  const sc = SCENARIOS[currentScenarioIndex];
  const prevChecks = sc.validate(engine.state).checks;
  const prevPassedCount = prevChecks.filter(c => c.passed).length;

  const result = engine.execute(rawCmd);

  // Evaluate command correctness
  const trimmed = rawCmd.trim();
  if (trimmed && trimmed !== '?' && trimmed !== 'cls' && trimmed !== 'clear') {
    const isError = typeof result === 'string' && (result.startsWith('%') || result.includes('Invalid input') || result.includes('Incomplete command') || result.includes('Unrecognized') || result.includes('Error:'));

    if (isError) {
      // Penalize for invalid command syntax
      updateScore(-10, "Comando erróneo o sintaxis inválida");
    } else {
      // Award base points for correct valid command
      let pts = 5;

      // Check if an objective was newly unlocked
      const newChecks = sc.validate(engine.state).checks;
      const newPassedCount = newChecks.filter(c => c.passed).length;
      if (newPassedCount > prevPassedCount) {
        pts += 25 * (newPassedCount - prevPassedCount); // +25 bonus per unlocked objective
      }

      updateScore(pts, "Comando ejecutado correctamente");
    }
  }

  if (result === '__CLEAR__') {
    clearTerminal();
  } else if (result) {
    printToTerminal(result, 'output-text');
  }

  updatePrompt();
  updateTopology();
  validateLab();
  scrollToBottom();
}

function runQuickCmd(cmd) {
  cmdInput.value = '';
  executeCommand(cmd);
  cmdInput.focus();
}

function autoComplete(partial) {
  const tokens = ['enable', 'configure terminal', 'show vlan brief', 'show interfaces trunk', 'show interfaces status', 'show ip interface brief', 'show running-config', 'show spanning-tree', 'switchport mode access', 'switchport mode trunk', 'switchport access vlan', 'switchport trunk allowed vlan', 'switchport trunk native vlan', 'spanning-tree vlan', 'spanning-tree portfast', 'spanning-tree bpduguard enable', 'ip routing', 'ipv6 unicast-routing', 'no shutdown', 'shutdown'];
  const match = tokens.find(t => t.startsWith(partial.trim().toLowerCase()));
  if (match) {
    cmdInput.value = match;
  }
}

function updatePrompt() {
  promptLabel.textContent = engine.getPrompt();
}

function printToTerminal(text, type = 'output-text') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = text;
  terminalScreen.appendChild(line);
}

function clearTerminal() {
  terminalScreen.innerHTML = '';
}

function scrollToBottom() {
  terminalScreen.scrollTop = terminalScreen.scrollHeight;
}

// Topology & Port LEDs rendering
function updateTopology() {
  const sc = SCENARIOS[currentScenarioIndex];
  const state = engine.state;
  const ifaces = state.interfaces || {};

  let portsHtml = '';
  for (const [name, p] of Object.entries(ifaces)) {
    const isUp = p.status === 'up';
    const isTrunk = p.mode === 'trunk';
    let ledClass = isUp ? (isTrunk ? 'trunk' : 'up') : 'down';

    portsHtml += `
      <div class="flex flex-col items-center bg-slate-900/90 border border-slate-800 p-1.5 rounded-lg text-[10px] min-w-[50px] shadow-sm">
        <div class="flex items-center gap-1 mb-1">
          <span class="port-led ${ledClass}"></span>
          <span class="font-mono font-bold text-slate-300">${name}</span>
        </div>
        <div class="text-[9px] font-mono ${isTrunk ? 'text-cyan-400 font-bold' : 'text-slate-400'}">
          ${isTrunk ? 'TRUNK' : `V:${p.vlan || 1}`}
        </div>
        <div class="text-[8px] text-slate-500 truncate max-w-[50px]">
          ${p.description || (isUp ? 'UP' : 'DOWN')}
        </div>
      </div>
    `;
  }

  // Active VLAN tags
  const vlanTags = Object.keys(state.vlans).map(v => `<span class="vlan-tag-chip">VLAN ${v} (${state.vlans[v].name})</span>`).join('');

  // SVI tags
  let sviTags = '';
  for (const [sviName, svi] of Object.entries(state.svi || {})) {
    if (svi.ipv4 || svi.ipv6) {
      sviTags += `<div class="text-[10px] font-mono text-emerald-400">⚡ ${sviName}: ${svi.ipv4 || ''} ${svi.ipv6 ? `| ${svi.ipv6}` : ''} [${svi.status || 'up'}]</div>`;
    }
  }

  topologyView.innerHTML = `
    <div class="switch-box p-3 w-full">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-cyan-500 animate-pulse"></div>
          <span class="font-mono font-bold text-xs text-white">${state.hostname}</span>
          ${state.ipRouting ? '<span class="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-mono">L3 Routing ON</span>' : ''}
          ${state.ipv6Routing ? '<span class="bg-purple-950 text-purple-400 border border-purple-800 text-[9px] px-1.5 py-0.2 rounded font-mono">IPv6 ON</span>' : ''}
        </div>
        <div class="text-[10px] text-slate-400 font-mono">STP: ${state.spanningTree?.mode || 'PVST'}</div>
      </div>

      <div class="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
        ${portsHtml}
      </div>

      <div class="border-t border-slate-800/80 pt-2 space-y-1.5">
        <div class="text-[10px] text-slate-400 font-bold mb-1">VLANs activas:</div>
        <div class="vlan-badges-container">
          ${vlanTags}
        </div>
        ${sviTags ? `<div class="mt-1.5 pt-1.5 border-t border-slate-800/60">${sviTags}</div>` : ''}
      </div>
    </div>
  `;
}

// Objective Validator
function validateLab() {
  const sc = SCENARIOS[currentScenarioIndex];
  const { completed, checks } = sc.validate(engine.state);

  objectivesList.innerHTML = '';
  let passedCount = 0;

  checks.forEach(chk => {
    if (chk.passed) passedCount++;
    const li = document.createElement('li');
    li.className = `check-item flex items-start gap-2.5 p-2 rounded-lg border transition ${chk.passed ? 'done border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/40'}`;
    li.innerHTML = `
      <div class="mt-0.5 flex-shrink-0">
        ${chk.passed 
          ? `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`
          : `<svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"></circle></svg>`
        }
      </div>
      <span class="flex-1 ${chk.passed ? 'text-emerald-300 font-medium' : 'text-slate-400'}">${chk.label}</span>
    `;
    objectivesList.appendChild(li);
  });

  const percentage = Math.round((passedCount / checks.length) * 100);
  progressBadge.textContent = `${percentage}%`;

  if (completed) {
    if (congratsBanner.classList.contains('hidden')) {
      congratsBanner.classList.remove('hidden');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      // Show level completed modal after a slight delay for better UX
      setTimeout(() => {
        showModal();
      }, 500);
    }
  } else {
    congratsBanner.classList.add('hidden');
    closeModal();
  }
}

init();
