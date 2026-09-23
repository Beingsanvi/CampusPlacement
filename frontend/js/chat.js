/**
 * Agent Chat & RAG Console
 * Wires the composer + left-panel telemetry to the real backend (/api/chat, /api/status, /api/profile).
 */
(function initAgentConsole() {
  const promptInput = document.getElementById('prompt-input');
  const submitBtn = document.getElementById('submit-btn');
  const messageContainer = document.getElementById('message-container');
  const clearBtn = document.getElementById('clear-feed-btn');
  if (messageContainer) messageContainer.style.scrollBehavior = 'smooth';
  const tokenCounter = document.getElementById('token-count');
  const presetButtons = document.querySelectorAll('.preset-trigger');
  const hintPills = document.querySelectorAll('.hint-pill');

  let deepDocs = true;
  let planMode = false;
  let strictGrounding = true;

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Lightweight markdown renderer (headings, lists, bold, code, paragraphs) ---
  function renderMarkdown(text) {
    if (!text) return '';
    text = String(text);

    const blocks = [];
    text = text.replace(/```([\s\S]*?)```/g, function (_, code) {
      blocks.push('<pre class="bg-surface-container-low p-space-md overflow-x-auto font-code-telemetry text-code-telemetry text-bone-dim leading-relaxed mt-2 mb-2">' + escapeHtml(code.trim()) + '</pre>');
      return '\x00CODEBLOCK\x00';
    });

    const lines = text.split('\n');
    let html = '';
    let listTag = null;
    let inList = false;

    function closeList() {
      if (inList) { html += '</' + listTag + '>'; inList = false; }
    }

    lines.forEach(function (line) {
      const trimmed = line.trim();

      if (trimmed === '\x00CODEBLOCK\x00') {
        closeList();
        html += blocks.shift() || '';
        return;
      }
      if (!trimmed) { closeList(); return; }

      const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        closeList();
        const size = heading[1].length;
        const cls = size === 1
          ? 'font-headline-sm text-headline-sm text-chalk-text mt-space-md mb-space-sm uppercase'
          : 'font-label-md text-label-md text-primary-fixed uppercase tracking-wider mt-space-md mb-space-sm';
        html += '<div class="' + cls + '">' + escapeHtml(heading[2]) + '</div>';
        return;
      }

      const bullet = trimmed.match(/^[-*]\s+(.*)$/);
      if (bullet) {
        if (!inList || listTag !== 'ul') { closeList(); listTag = 'ul'; html += '<ul class="list-none space-y-space-sm pl-0 mt-space-xs mb-space-xs">'; inList = true; }
        html += '<li class="font-body-md text-body-md text-chalk-text flex gap-space-sm"><span class="text-primary-container shrink-0 pt-1">▹</span><span>' + renderInline(bullet[1]) + '</span></li>';
        return;
      }

      const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
      if (numbered) {
        if (!inList || listTag !== 'ol') { closeList(); listTag = 'ol'; html += '<ol class="space-y-space-sm pl-0 mt-space-xs mb-space-xs">'; inList = true; }
        html += '<li class="font-body-md text-body-md text-chalk-text flex gap-space-sm"><span class="font-code-telemetry text-code-telemetry text-primary-fixed shrink-0 pt-1">' + numbered[1] + '.</span><span>' + renderInline(numbered[2]) + '</span></li>';
        return;
      }

      closeList();
      html += '<p class="font-body-md text-body-md text-chalk-text leading-relaxed my-space-xs">' + renderInline(trimmed) + '</p>';
    });

    closeList();
    return html;
  }

  function renderInline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-chalk-text">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em class="text-bone-dim">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="font-code-telemetry text-primary-fixed bg-surface-container px-1">$1</code>');
  }

  function timeStr() {
    return new Date().toTimeString().split(' ')[0];
  }

  function marker() {
    return '[' + new Date().toISOString().replace('T', ' // ').slice(0, 19) + ' UTC]';
  }

  // --- Utilitarian Answer Header Strip ---
  function agentLabel(queryType) {
    const map = { faq: 'FAQ RAG AGENT', preparation: 'PREPARATION_AGENT', general: 'MAIN ROUTER', unknown: 'MAIN ROUTER' };
    return map[queryType] || 'MAIN ROUTER';
  }

  // --- Preset & hint-pill wiring ---
  presetButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) { promptInput.value = prompt; promptInput.focus(); updateTokenCount(); }
    });
  });

  hintPills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      promptInput.value += ' ' + pill.innerText.trim();
      promptInput.focus();
      updateTokenCount();
    });
  });

  function updateTokenCount() {
    const text = promptInput.value || '';
    const estimated = Math.max(388, Math.floor(text.length / 3.8) + 388);
    tokenCounter.innerText = estimated + ' / 8,192';
  }
  promptInput.addEventListener('input', updateTokenCount);

  // --- Modifier toggles ---
  const toggleDeepDocs = document.getElementById('toggle-deep-docs');
  const togglePlanMode = document.getElementById('toggle-plan-mode');
  const toggleStrict = document.getElementById('toggle-strict');

  function updateToggleState(el, active) {
    el.className = active
      ? 'composer-toggle flex items-center gap-space-xs px-space-md py-1 bg-primary-container text-obsidian-base font-label-sm text-label-sm uppercase font-semibold transition-all'
      : 'composer-toggle flex items-center gap-space-xs px-space-md py-1 bg-slate-elevated text-chalk-text hover:bg-surface-container-high font-label-sm text-label-sm uppercase font-medium transition-all';
  }
  toggleDeepDocs.addEventListener('click', function () { deepDocs = !deepDocs; updateToggleState(toggleDeepDocs, deepDocs); });
  togglePlanMode.addEventListener('click', function () { planMode = !planMode; updateToggleState(togglePlanMode, planMode); });
  toggleStrict.addEventListener('click', function () { strictGrounding = !strictGrounding; updateToggleState(toggleStrict, strictGrounding); });

  // --- Chat execution against the real agent backend ---
  function appendUserMessage(query) {
    const html = [
      '<div class="anim-in sf-swoop flex flex-col items-end gap-space-xs self-end max-w-2xl w-full">',
      '  <div class="flex items-center gap-space-md font-code-telemetry text-code-telemetry text-titanium-muted">',
      '    <span>DISPATCHER::OPERATOR</span><span>' + timeStr() + '</span>',
      '  </div>',
      '  <div class="bg-slate-elevated rounded-xl p-space-lg w-full text-chalk-text font-body-md text-body-md shadow-sm">' + escapeHtml(query) + '</div>',
      '</div>',
    ].join('\n');
    messageContainer.insertAdjacentHTML('beforeend', html);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  function appendLoading(node) {
    const html = [
      '<div class="anim-in flex flex-col items-start gap-space-xs self-start max-w-full w-full" id="' + node + '">',
      '  <div class="w-full bg-surface-container-low px-space-md py-space-sm">',
      '    <span class="font-label-sm text-label-sm uppercase text-chalk-text font-semibold flex items-center gap-1">',
      '      <span class="w-2 h-2 bg-primary-container sf-pulse-ring rounded-full"></span>',
      '      AGENT: ROUTING INTENT...',
      '    </span>',
      '  </div>',
      '  <div class="bg-slate-elevated rounded-xl p-gutter-lg w-full font-code-telemetry text-code-telemetry text-bone-dim flex items-center gap-space-sm">',
      '    <span class="material-symbols-outlined text-primary-container animate-spin text-[16px]">autorenew</span>',
      '    <span>GROUNDING QUERY AGAINST AZURE AI SEARCH INDEX</span>',
      '    <span class="sf-typing text-primary-fixed"><span></span><span></span><span></span></span>',
      '  </div>',
      '</div>',
    ].join('\n');
    messageContainer.insertAdjacentHTML('beforeend', html);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  function appendAgentResponse(response, latencyMs) {
    const answer = response.answer || 'No response generated.';
    const confidence = typeof response.confidence === 'number'
      ? (response.confidence >= 1 ? response.confidence.toFixed(1) : (response.confidence * 100).toFixed(1))
      : '--';
    const label = agentLabel(response.query_type);
    const sources = Array.isArray(response.sources) ? response.sources : [];
    const srcLine = sources.length
      ? sources[0]
      : (label === 'FAQ RAG AGENT' ? 'placement-policy / eligibility docs' : 'preparation-syllabus / rubrics');

    let html = [
      '<div class="anim-in sf-swoop flex flex-col items-start gap-space-xs self-start max-w-full w-full">',
      '  <div class="w-full bg-surface-container-low px-space-md py-space-sm flex flex-wrap items-center justify-between gap-space-sm">',
      '    <div class="flex items-center gap-space-md flex-wrap">',
      '      <span class="font-label-sm text-label-sm uppercase text-chalk-text font-semibold flex items-center gap-1">',
      '        <span class="w-2 h-2 bg-primary-container"></span>',
      '        AGENT: ' + label + '',
      '      </span>',
      '      <span class="font-code-telemetry text-code-telemetry text-bone-dim">SRC: Azure AI Search / ' + escapeHtml(srcLine) + '</span>',
      '    </div>',
      '    <div class="flex items-center gap-space-xs">',
      '      <span class="font-label-sm text-label-sm text-titanium-muted uppercase">CONFIDENCE:</span>',
      '      <span class="font-code-telemetry text-code-telemetry text-primary-fixed font-semibold">' + confidence + '%</span>',
      '      <span class="text-slate-border">|</span>',
      '      <span class="font-code-telemetry text-code-telemetry text-titanium-muted">' + latencyMs + 'ms</span>',
      '    </div>',
      '  </div>',
      '  <div class="bg-slate-elevated rounded-xl p-gutter-lg w-full text-chalk-text">' + renderMarkdown(answer) + '</div>',
    ].join('\n');

    if (sources.length) {
      html += [
        '  <div class="bg-slate-elevated rounded-lg p-space-md w-full">',
        '    <span class="font-label-sm text-label-sm uppercase text-titanium-muted tracking-wider block pb-space-xs">VERIFIABLE GROUNDING CITATIONS:</span>',
        '    <div class="flex flex-wrap gap-space-sm">',
        sources.slice(0, 6).map(function (s) {
          return '<span class="px-space-md py-1 flex items-center gap-space-xs text-bone-dim font-code-telemetry text-code-telemetry bg-surface-container-low">'
            + '<span class="material-symbols-outlined text-[13px] text-primary-fixed">verified</span>' + escapeHtml(s) + '</span>';
        }).join(''),
        '    </div>',
        '  </div>',
      ].join('\n');
    }

    html += '</div>';
    messageContainer.insertAdjacentHTML('beforeend', html);
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  function executeDispatch() {
    const query = promptInput.value.trim();
    if (!query) return;

    appendUserMessage(query);
    promptInput.value = '';
    updateTokenCount();

    const nodeId = 'stream-' + Date.now();
    appendLoading(nodeId);

    const started = performance.now();
    window.CampusPlacementAPI.sendChatMessage(query)
      .then(function (response) {
        const el = document.getElementById(nodeId);
        if (el) el.remove();
        const latency = Math.max(12, Math.round(performance.now() - started));
        appendAgentResponse(response, latency);

        const runEl = document.getElementById('latency-run');
        if (runEl) runEl.textContent = latency + 'ms';
      })
      .catch(function (err) {
        const el = document.getElementById(nodeId);
        if (el) el.remove();
        const html = [
          '<div class="anim-in sf-swoop flex flex-col items-start gap-space-xs self-start max-w-full w-full">',
          '  <div class="w-full bg-error-container/10 px-space-md py-space-sm border-l-2 border-error">',
          '    <span class="font-label-sm text-label-sm uppercase text-error font-semibold">AGENT FAULT // ' + escapeHtml(String(err.message || err)) + '</span>',
          '  </div>',
          '</div>',
        ].join('\n');
        messageContainer.insertAdjacentHTML('beforeend', html);
        messageContainer.scrollTop = messageContainer.scrollHeight;
      });
  }

  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); executeDispatch(); }
  });
  submitBtn.addEventListener('click', executeDispatch);

  clearBtn.addEventListener('click', function () {
    messageContainer.innerHTML =
      '<div class="flex items-center justify-center gap-space-md my-space-xs">'
      + '<div class="h-px bg-slate-border flex-1"></div>'
      + '<span class="font-code-telemetry text-code-telemetry text-titanium-muted uppercase tracking-widest">[CONTEXT RESET: SESSION PURGED // ' + timeStr() + ']</span>'
      + '<div class="h-px bg-slate-border flex-1"></div></div>';
  });

  // --- Left-panel live telemetry (fleet status, candidate focus) ---
  function setFleetBadge(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) {
      el.className = 'flex items-center gap-space-xs bg-primary-container/10 px-space-sm py-0.5';
      el.innerHTML = '<span class="w-1.5 h-1.5 bg-primary-container rounded-none"></span><span class="font-label-sm text-label-sm text-primary-fixed uppercase font-semibold">ACTIVE</span>';
    } else {
      el.className = 'flex items-center gap-space-xs bg-slate-elevated px-space-sm py-0.5';
      el.innerHTML = '<span class="w-1.5 h-1.5 bg-titanium-muted rounded-none"></span><span class="font-label-sm text-label-sm text-titanium-muted uppercase font-semibold">STANDBY</span>';
    }
  }

  function loadTelemetry() {
    window.CampusPlacementAPI.getSystemStatus()
      .then(function (status) {
        setFleetBadge('faq-fleet-badge', status.faq_agent === 'active');
        setFleetBadge('prep-fleet-badge', status.preparation_agent === 'active');
        document.getElementById('kernel-marker').textContent = marker();
        if (status.smtp_configured) document.getElementById('sync-status').textContent = 'SMTP GATE CONFIGURED';
        const searchHealth = document.getElementById('search-health');
        if (searchHealth) searchHealth.textContent = status.search_key_set ? 'HEALTH: 100%' : 'HEALTH: KEY MISSING';
        document.getElementById('foundry-model').textContent = status.foundry_configured ? 'GPT-4.1-MINI' : 'NOT CONFIGURED';
      })
      .catch(function () {
        document.getElementById('kernel-marker').textContent = '[BACKEND OFFLINE: START dev_server.py]';
        const searchHealth = document.getElementById('search-health');
        if (searchHealth) searchHealth.textContent = 'HEALTH: OFFLINE';
      });

    window.CampusPlacementAPI.getProfile()
      .then(function (data) {
        const p = data && data.profile;
        const cname = document.getElementById('candidate-name');
        const csub = document.getElementById('candidate-sub');
        const ccgpa = document.getElementById('candidate-cgpa');
        if (!p || !p.name) {
          cname.textContent = 'Arjun Ramanathan (Local)';
          csub.textContent = 'CS_ENG // ROLL: 2021-CS-084';
          ccgpa.textContent = 'CGPA: 9.14 // TIER-1 ELIGIBLE';
          return;
        }
        const edu = p.education || {};
        cname.textContent = p.name;
        csub.textContent = (edu.degree ? edu.degree.toUpperCase() + ' // ' : '') + (p.role_preference ? 'TARGET: ' + p.role_preference.toUpperCase() : '');
        ccgpa.textContent = edu.cgpa ? 'CGPA: ' + edu.cgpa + ' // PROFILE SYNCED' : 'PROFILE SYNCED';
      })
      .catch(function () { /* profile not reachable — keep defaults */ });
  }

  loadTelemetry();
})();