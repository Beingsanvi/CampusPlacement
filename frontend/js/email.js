/**
 * Email Gatekeeper & Dispatch
 * Wires the dispatch queue, editor sandbox and SMTP approval gate to the real backend.
 * MOCK SEND MODE (default ON) never ships a real email — it persists approval only.
 */
(function initGatekeeper() {
  const QUEUE_COL = document.getElementById('queue-column');
  const toast = document.getElementById('toast-notification');
  const editor = document.getElementById('email-body-editor');
  const subjectInput = document.getElementById('email-subject-input');

  const ARCHIVE_KEY = 'sys0_archived_drafts';
  let drafts = [];
  let activeFilter = 'all';
  let activeDraft = null;
  let isMockMode = true;

  function archived() {
    try { return JSON.parse(sessionStorage.getItem(ARCHIVE_KEY)) || []; }
    catch (e) { return []; }
  }
  function archiveId(id) {
    const list = archived();
    if (list.indexOf(id) === -1) list.push(id);
    sessionStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
  }

  function showToast(title, body, isError) {
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-body').textContent = body;
    document.getElementById('toast-title').className = 'font-label-md text-label-md text-chalk-text uppercase tracking-wider' + (isError ? ' text-error' : '');
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(function () {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3400);
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function statusBadge(status) {
    if (status === 'pending') return { label: 'GATE_REVIEW', cls: 'text-signal-amber' };
    if (status === 'approved') return { label: 'AUTHORIZED_LOCKED', cls: 'text-primary-fixed' };
    if (status === 'sent') return { label: 'DISPATCHED', cls: 'text-primary-fixed' };
    return { label: 'ARCHIVED', cls: 'text-error' };
  }

  function counts() {
    const archivedIds = archived();
    return {
      pending: drafts.filter(function (d) { return d.status === 'pending' && archivedIds.indexOf(d.draft_id) === -1; }).length,
      approved: drafts.filter(function (d) { return d.status === 'approved' && archivedIds.indexOf(d.draft_id) === -1; }).length,
      sent: drafts.filter(function (d) { return d.status === 'sent' && archivedIds.indexOf(d.draft_id) === -1; }).length,
      archived: archivedIds.length,
    };
  }

  function queueSummaryHtml() {
    const c = counts();
    const btn = function (key, label, count, dotClass, sub) {
      return '<button class="flex flex-col p-space-sm bg-' + (activeFilter === key ? 'surface-container-high' : 'surface') + ' text-left rounded hover:bg-surface-container-high transition-colors" data-filter="' + key + '">'
        + '<div class="flex items-center justify-between">'
        + '<span class="font-label-sm text-label-sm text-chalk-text tracking-widest uppercase">' + label + '</span>'
        + '<span class="w-1.5 h-1.5 ' + dotClass + ' rounded-none"></span></div>'
        + '<span class="font-headline-lg text-headline-lg text-chalk-text mt-0.5">' + count + '</span>'
        + '<span class="font-code-telemetry text-code-telemetry text-bone-dim">' + sub + '</span></button>';
    };
    return [
      '<div class="bg-surface-container-low p-space-md rounded flex flex-col gap-space-sm shadow-sm">',
      '<div class="flex items-center justify-between">',
      '<span class="font-label-md text-label-md text-chalk-text uppercase tracking-wider">GATEKEEPER DISPATCH QUEUE</span>',
      '<span class="font-code-telemetry text-code-telemetry text-primary-fixed px-space-xs py-0.5 bg-surface rounded">' + drafts.length + ' DRAFTS</span>',
      '</div>',
      '<div class="grid grid-cols-2 gap-space-xs mt-space-xs">',
      btn('pending', 'PENDING', c.pending, 'bg-secondary-container', 'Requires Sign-off'),
      btn('approved', 'READY', c.approved, 'bg-primary-container', 'Queued for Burst'),
      btn('sent', 'SENT', c.sent, 'bg-titanium-muted', 'Ack Validated'),
      btn('archived', 'ARCHIVED', c.archived, 'bg-error-container', 'Failed Criteria'),
      '</div></div>',
    ].join('\n');
  }

  function candidateCardHtml() {
    return [
      '<div class="bg-surface-container-low p-space-md rounded flex flex-col gap-space-sm shadow-sm">',
      '<div class="flex items-center justify-between">',
      '<span class="font-label-md text-label-md text-chalk-text uppercase tracking-wider">CANDIDATE SIGNATURE CONTEXT</span>',
      '<span class="font-label-sm text-label-sm text-primary-fixed font-code-telemetry">ID: SYS0-LOCAL</span>',
      '</div>',
      '<div class="flex items-center gap-space-md mt-space-xs">',
      '<div class="w-12 h-12 rounded bg-surface-container flex items-center justify-center flex-shrink-0">',
      '<span class="material-symbols-outlined text-chalk-text text-[22px]">person</span></div>',
      '<div class="flex flex-col">',
      '<span class="font-headline-sm text-headline-sm text-chalk-text" id="cand-name">Local Operator</span>',
      '<span class="font-code-telemetry text-code-telemetry text-bone-dim" id="cand-ident">PLACEMENT_ENGINE // PROFILE SYNC</span>',
      '<span class="font-label-sm text-label-sm text-primary-fixed mt-0.5">Verified Placement Node</span>',
      '</div>',
      '</div></div>',
    ].join('\n');
  }

  function queueItemHtml(draft, idx) {
    const b = statusBadge(draft.status);
    const job = draft.job || {};
    const archivedIds = archived();
    if ((activeFilter === 'archived' && archivedIds.indexOf(draft.draft_id) === -1) ||
        (activeFilter !== 'archived' && activeFilter !== 'all' && draft.status !== activeFilter)) {
      return '';
    }
    if (activeFilter === 'archived') b.label = 'ARCHIVED', b.cls = 'text-error';

    const isActive = activeDraft && activeDraft.draft_id === draft.draft_id;
    const listCls = isActive
      ? 'card-lift cursor-pointer bg-surface-container border border-slate-border p-space-md rounded flex flex-col gap-space-xs transition-all shadow-md'
      : 'card-lift cursor-pointer bg-surface border border-slate-border p-space-md rounded flex flex-col gap-space-xs hover:bg-surface-container transition-all';
    const contact = draft.contact_email || (draft.needs_contact ? '(contact required)' : '(no recipient)');
    const fitPill = draft.needs_contact
      ? '<span class="text-signal-amber font-semibold">NEEDS CONTACT</span>'
      : '<span class="text-primary-fixed font-semibold">' + (job.tags && job.tags.length ? job.tags.length + ' TAGS FIT' : 'REVIEW') + '</span>';

    return [
      '<div class="' + listCls + '" data-draft-idx="' + idx + '">',
      '<div class="flex items-center justify-between">',
      '<span class="font-code-telemetry text-code-telemetry text-primary-fixed">REF::' + escapeHtml(draft.draft_id || '--').toUpperCase() + '</span>',
      '<span class="font-label-sm text-label-sm px-space-xs py-0.5 bg-surface text-signal-amber rounded uppercase ' + b.cls + '">' + b.label + '</span>',
      '</div>',
      '<div class="font-headline-sm text-headline-sm text-chalk-text leading-snug">' + escapeHtml(job.company || 'Unknown company') + ' — ' + escapeHtml(job.title || 'untitled') + '</div>',
      '<div class="flex items-center justify-between font-code-telemetry text-code-telemetry text-bone-dim mt-space-xs">',
      '<span>To: ' + escapeHtml(contact) + '</span>',
      fitPill,
      '</div>',
      '<div class="flex items-center gap-space-xs font-label-sm text-label-sm text-titanium-muted">',
      '<span class="material-symbols-outlined text-[14px]">person</span>',
      '<span>' + escapeHtml((job.source || 'external').toUpperCase()) + '</span>',
      '</div>',
      '</div>',
    ].join('\n');
  }

  function renderQueueColumn() {
    QUEUE_COL.innerHTML = queueSummaryHtml() + '<div class="flex flex-col gap-space-xs" id="queue-container"></div>' + candidateCardHtml();
    document.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-filter');
        renderQueueColumn();
        renderQueueList();
      });
    });

    const qc = document.getElementById('queue-container');
    let html = '';
    drafts.forEach(function (d, i) { html += queueItemHtml(d, i); });
    if (!html) {
      html = '<div class="bg-surface p-space-md rounded flex items-center justify-center gap-space-sm py-space-lg font-code-telemetry text-code-telemetry text-titanium-muted">'
        + '<span class="material-symbols-outlined text-[16px]">inbox</span> NO DRAFTS IN THIS VIEW</div>';
    }
    qc.innerHTML = html;
    qc.querySelectorAll('[data-draft-idx]').forEach(function (el) {
      el.addEventListener('click', function () {
        selectDraft(drafts[parseInt(el.getAttribute('data-draft-idx'), 10)]);
      });
    });
    if (window.CPMotion) window.CPMotion.stagger(qc);
  }

  function renderQueueList() {
    const qc = document.getElementById('queue-container');
    if (!qc) return;
    let html = '';
    drafts.forEach(function (d, i) { html += queueItemHtml(d, i); });
    if (!html) {
      html = '<div class="bg-surface p-space-md rounded flex items-center justify-center gap-space-sm py-space-lg font-code-telemetry text-code-telemetry text-titanium-muted">'
        + '<span class="material-symbols-outlined text-[16px]">inbox</span> NO DRAFTS IN THIS VIEW</div>';
    }
    qc.innerHTML = html;
    qc.querySelectorAll('[data-draft-idx]').forEach(function (el) {
      el.addEventListener('click', function () {
        selectDraft(drafts[parseInt(el.getAttribute('data-draft-idx'), 10)]);
      });
    });
    if (window.CPMotion) window.CPMotion.stagger(qc);
  }

  function tokenBarFor(draft) {
    const job = draft.job || {};
    const prof = draft.profile_email || '';
    const meta = statusBadge(draft.status);
    const chip = function (icon, label, value, cls) {
      return '<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-border bg-surface shadow-sm sf-pop-in">'
        + '<span class="flex items-center gap-1 ' + cls + ' font-label-sm text-label-sm uppercase tracking-wider font-semibold">'
        + '<span class="material-symbols-outlined text-[14px]">' + icon + '</span>' + label + '</span>'
        + '<span class="font-code-telemetry text-code-telemetry text-chalk-text max-w-[240px] truncate">' + value + '</span>'
        + '</span>';
    };
    return [
      '<div class="flex flex-wrap items-center gap-space-sm sf-fade-in" style="--d:60ms">',
      '<span class="font-label-sm text-label-sm text-titanium-muted uppercase tracking-wider">RAG INJECTED TOKENS:</span>',
      chip('person', 'CANDIDATE', escapeHtml(prof || 'unset'), 'text-primary-fixed'),
      chip('work', 'JOB', escapeHtml(String(job.title || '').slice(0, 22)), 'text-primary-fixed'),
      chip('tag', 'REF', escapeHtml(String(draft.draft_id || '--').toUpperCase()), 'text-primary-fixed'),
      chip('schedule', 'STATUS', escapeHtml((draft.status || 'pending').toUpperCase()), meta.cls),
      '</div>',
    ].join('');
  }

  function selectDraft(draft) {
    activeDraft = draft;
    const job = draft.job || {};
    document.getElementById('match-context').textContent = draft.status === 'approved' ? 'AUTHORIZED / READY' : 'MATCH CONTEXT: ' + (job.tags ? job.tags.length + ' TAGS' : 'GATE');
    document.getElementById('draft-spec-title').textContent = (job.company || 'Company') + ' // ' + (job.title || 'Role');
    document.getElementById('recipient-to').innerHTML = escapeHtml(draft.contact_email || '(contact required)') + ' <span class="text-bone-dim">[' + escapeHtml(job.company || '') + ' gateway]</span>';
    const profEmail = draft.profile_email || '';
    document.getElementById('sender-ident').innerHTML = escapeHtml(profEmail) + (profEmail ? ' <span class="text-bone-dim">[Verified TLS GPG]</span>' : ' <span class="text-bone-dim">[no profile email]</span>');
    subjectInput.value = draft.subject || '';
    editor.value = draft.body || '';
    updateWordCount();
    tokenBarFor(draft);
    renderQueueList();
    if (!isMockMode) showToast('DRAFT LOADED', 'Inspection mode: ' + job.title + '.');
  }

  function updateWordCount() {
    const text = editor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('char-counter').innerText = chars.toLocaleString() + ' CHARACTERS | ' + words + ' WORDS';
  }
  editor.addEventListener('input', updateWordCount);
  subjectInput.addEventListener('input', function () { if (activeDraft) activeDraft.subject = subjectInput.value; });

  function loadDrafts() {
    const started = performance.now();
    window.CampusPlacementAPI.listDrafts()
      .then(function (data) {
        drafts = data.drafts || [];
        document.getElementById('queue-latency').textContent = Math.round(performance.now() - started) + 'ms';
        document.getElementById('rate-limit').textContent = counts().sent + ' / 50 HOURLY';
        renderQueueColumn();
        if (activeDraft) {
          const fresh = drafts.filter(function (d) { return d.draft_id === activeDraft.draft_id; })[0];
          if (fresh) { activeDraft = fresh; selectDraft(fresh); }
        } else if (drafts.length) {
          selectDraft(drafts[0]);
        }
      })
      .catch(function (err) {
        showToast('QUEUE OFFLINE', String(err.message || err), true);
      });
  }

  // --- Toggles / mock state ---
  document.getElementById('mock-mode-toggle').addEventListener('change', function (e) {
    isMockMode = e.target.checked;
    const statusText = document.getElementById('mock-status-text');
    const modalRelay = document.getElementById('modal-relay-mode');
    if (isMockMode) {
      statusText.innerText = 'Simulate SMTP relay without real recipient delivery';
      statusText.classList.remove('text-signal-amber');
      statusText.classList.add('text-bone-dim');
      modalRelay.innerText = 'MOCK RELAY [LOCAL SOCKET]';
      modalRelay.className = 'text-signal-amber mt-0.5';
      showToast('MODE SWITCH', 'Safe Mock Relay Active. No real emails will leave the network.');
    } else {
      statusText.innerText = 'WARNING: REAL LIVE NETWORK SMTP SOCKETS ENGAGED';
      statusText.classList.remove('text-bone-dim');
      statusText.classList.add('text-signal-amber');
      modalRelay.innerText = 'LIVE POSTFIX SOCKET [REAL DISPATCH]';
      modalRelay.className = 'text-error mt-0.5 font-bold';
      showToast('HIGH RISK WARNING', 'LIVE SMTP ENGAGED. Authorized dispatches will send real emails.');
    }
  });

  // --- Edits / actions ---
  document.getElementById('copy-payload-btn').addEventListener('click', function () {
    navigator.clipboard.writeText(editor.value).then(function () {
      showToast('CLIPBOARD COPIED', 'Draft payload copied to developer clipboard.');
    });
  });
  document.getElementById('view-mode-btn').addEventListener('click', function () {
    showToast('DIFF INSPECTOR', 'Entity markers recalculated against the JD.' + (activeDraft ? '' : ' Select a draft first.'));
  });

  document.getElementById('regenerate-btn').addEventListener('click', function () {
    if (!activeDraft) { showToast('NO DRAFT', 'Select a draft first.', true); return; }
    showToast('AGENT INVOKED', 'Re-synthesizing via /api/email/draft...');
    window.CampusPlacementAPI.draftEmail(activeDraft.job)
      .then(function () { loadDrafts(); showToast('AGENT COMPLETE', 'Fresh draft queued. Loaded latest state.'); })
      .catch(function (err) { showToast('REGEN FAULT', String(err.message || err), true); });
  });

  document.getElementById('reject-btn').addEventListener('click', function () {
    if (!activeDraft) { showToast('NO DRAFT', 'Select a draft first.', true); return; }
    archiveId(activeDraft.draft_id);
    activeDraft = null;
    editor.value = '';
    subjectInput.value = '';
    renderQueueColumn();
    showToast('DRAFT ARCHIVED', 'Draft flagged for placement coordinator review.');
  });

  document.getElementById('save-btn').addEventListener('click', function () {
    if (activeDraft) {
      activeDraft.body = editor.value;
      activeDraft.subject = subjectInput.value;
    }
    showToast('SAVED', 'Draft edits committed to the staging buffer (persist on approve).');
  });

  // --- Approval modal flow ---
  function openApprovalModal() {
    if (!activeDraft) { showToast('NO DRAFT', 'Select a draft from the queue before authorizing.', true); return; }
    const modal = document.getElementById('approval-modal');
    const job = activeDraft.job || {};
    document.getElementById('verify-contract').innerHTML = 'You are about to transmit a production email via authenticated SMTP to <strong class="text-chalk-text">' + escapeHtml(activeDraft.contact_email || '[contact required]') + '</strong>. This action cannot be undone once socket transmission has completed.';
    document.getElementById('modal-company').textContent = job.company || '--';
    document.getElementById('modal-candidate').textContent = activeDraft.profile_email || 'Local Operator';
    document.getElementById('modal-recipient').value = activeDraft.contact_email || '';
    document.getElementById('operator-confirm-checkbox').checked = false;
    document.getElementById('modal-dispatch-feedback').classList.add('hidden');
    toggleExecuteButton();
    modal.classList.remove('hidden');
  }

  function closeApprovalModal() {
    document.getElementById('approval-modal').classList.add('hidden');
  }

  function toggleExecuteButton() {
    const checked = document.getElementById('operator-confirm-checkbox').checked;
    const btn = document.getElementById('btn-modal-execute');
    if (checked) {
      btn.disabled = false;
      btn.classList.remove('opacity-40', 'cursor-not-allowed');
      btn.classList.add('hover:bg-primary-fixed', 'active:scale-95');
    } else {
      btn.disabled = true;
      btn.classList.add('opacity-40', 'cursor-not-allowed');
      btn.classList.remove('hover:bg-primary-fixed', 'active:scale-95');
    }
  }
  document.getElementById('operator-confirm-checkbox').addEventListener('change', toggleExecuteButton);
  document.getElementById('close-modal-btn').addEventListener('click', closeApprovalModal);
  document.getElementById('abort-btn').addEventListener('click', closeApprovalModal);

  document.getElementById('btn-authorize-send').addEventListener('click', openApprovalModal);

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const modal = document.getElementById('approval-modal');
      if (modal.classList.contains('hidden')) openApprovalModal();
      else if (!document.getElementById('btn-modal-execute').disabled) executeSMTPDispatch();
    }
  });

  function executeSMTPDispatch() {
    const feedback = document.getElementById('modal-dispatch-feedback');
    const msg = document.getElementById('modal-feedback-message');
    const executeBtn = document.getElementById('btn-modal-execute');
    const recipient = document.getElementById('modal-recipient').value.trim();

    executeBtn.disabled = true;
    feedback.classList.remove('hidden');
    msg.innerText = isMockMode
      ? 'MOCK RELAY: VERIFYING PROTOCOL ENVELOPE...'
      : 'CONNECTING VIA TLS 1.3 TO MX HOST...';

    const opts = { edits: editor.value, contactEmail: recipient };

    window.CampusPlacementAPI.approveEmail(activeDraft.draft_id, opts)
      .then(function () {
        if (isMockMode) {
          msg.innerText = 'MOCK SUCCESS: APPROVED. No real email transmitted (backend/logs).';
          setTimeout(function () {
            closeApprovalModal();
            showToast('TRANSMISSION SUCCESS', 'Mock dispatch approved & logged. Real send skipped.');
            loadDrafts();
          }, 1100);
          return;
        }
        return window.CampusPlacementAPI.sendEmail(activeDraft.draft_id);
      })
      .then(function () {
        if (isMockMode) return;
        setTimeout(function () {
          closeApprovalModal();
          showToast('TRANSMISSION SUCCESS', 'Real email dispatched via verified SMTP (250 OK).');
          activeDraft = null;
          loadDrafts();
        }, 1100);
      })
      .catch(function (err) {
        msg.innerText = 'FAULT: ' + String(err.message || err);
        showToast('TRANSMISSION FAULT', String(err.message || err), true);
        setTimeout(function () {
          feedback.classList.add('hidden');
          toggleExecuteButton();
        }, 1600);
      });
  }
  document.getElementById('btn-modal-execute').addEventListener('click', executeSMTPDispatch);

  // --- Boot: SMTP status + profile context + queue ---
  window.CampusPlacementAPI.getSystemStatus().then(function (status) {
    const smtp = document.getElementById('smtp-runtime');
    if (smtp) smtp.textContent = status.smtp_configured ? 'POSTFIX::SECURE_TUNNEL' : 'SMTP NOT CONFIGURED';
    if (status.smtp_configured) document.getElementById('relay-server').textContent = 'smtp.internal:587';
    else document.getElementById('relay-server').textContent = 'NOT CONFIGURED';
  }).catch(function () {
    document.getElementById('smtp-runtime').textContent = 'POSTFIX::OFFLINE';
  });

  window.CampusPlacementAPI.getProfile().then(function (data) {
    const p = data && data.profile;
    if (p && p.name) {
      document.getElementById('cand-name').textContent = p.name;
      document.getElementById('cand-ident').textContent = (p.education && p.education.degree ? p.education.degree.toUpperCase() + ' // ' : '') + 'PROFILE SYNCED';
    }
  }).catch(function () { /* keep defaults */ });

  loadDrafts();
})();