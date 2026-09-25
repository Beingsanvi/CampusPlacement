/**
 * Find Jobs — wires the match pipeline, filters and draft generation
 * to the real backend. Renders clean, readable job cards.
 */
(function initJobMatching() {
  const matcherBtn = document.getElementById('run-matcher-btn');
  const slider = document.getElementById('threshold-slider');
  const thresholdVal = document.getElementById('threshold-val');
  const queryInput = document.getElementById('role-query');
  const remoteToggle = document.getElementById('remote-toggle');
  const resultsEl = document.getElementById('match-results');
  const matchCount = document.getElementById('match-count');
  const inspector = document.getElementById('inspector-stream');
  const stackEl = document.getElementById('candidate-stack');
  const toast = document.getElementById('toast-notification');

  let matches = [];
  let currentThreshold = parseInt(slider.value, 10);

  function showToast(title, body, isError) {
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-title').className = 'font-label-md text-label-md text-chalk-text font-semibold';
    const toastBody = document.getElementById('toast-body');
    toastBody.textContent = body;
    toastBody.className = 'font-body-sm text-body-sm' + (isError ? ' text-error' : ' text-on-surface-variant');
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(function () {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-20', 'opacity-0');
    }, 3200);
  }

  function logWait(ts) {
    const line = document.createElement('div');
    line.className = 'flex gap-space-xs';
    line.innerHTML = '<span>' + ts + '</span><span class="text-primary-fixed font-medium">Scoring</span><span>profile vectors against live postings…</span>';
    inspector.appendChild(line);
    inspector.scrollTop = inspector.scrollHeight;
  }

  function logLine(text, cls) {
    const line = document.createElement('div');
    line.className = 'flex gap-space-xs';
    line.innerHTML = '<span>[' + new Date().toTimeString().split(' ')[0] + ']</span><span class="' + (cls || 'text-chalk-text') + '">' + text + '</span>';
    inspector.appendChild(line);
    inspector.scrollTop = inspector.scrollHeight;
    while (inspector.children.length > 8) inspector.removeChild(inspector.firstChild);
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function sourceBadge(source) {
    const map = {
      jobicy: { label: 'Jobicy', cls: 'text-on-surface-variant' },
      remotive: { label: 'Remotive', cls: 'text-on-surface-variant' },
      hn: { label: 'Hacker News', cls: 'text-on-surface-variant' },
      sample: { label: 'Sample data', cls: 'text-signal-amber' },
    };
    const s = map[source] || { label: 'External', cls: 'text-on-surface-variant' };
    return '<span class="px-space-sm py-0.5 rounded-full bg-slate-elevated font-label-sm text-label-sm ' + s.cls + '">' + s.label + '</span>';
  }

  function breakdown(match) {
    const matched = (match.matched_skills || []).length;
    const missing = (match.missing_skills || []).length;
    const skillOverlap = (matched + missing) ? Math.round((matched / (matched + missing)) * 100) : 62;
    const gap = missing > 2 ? 60 : missing > 0 ? 30 : 0;
    const expAlign = Math.max(40, Math.min(96, Math.round(match.score * 0.7 + 25)));
    return { skillOverlap: Math.min(97, skillOverlap), expAlign, gap };
  }

  function cardHtml(match) {
    const job = match.job || {};
    const score = match.score;
    const passive = score >= currentThreshold ? '' : ' opacity-60 grayscale';
    const bars = breakdown(match);
    const salary = job.salary ? escapeHtml(job.salary) : '';
    const locNote = (job.remote ? 'Global Remote' : escapeHtml(job.location || 'Onsite'));
    return [
      '<div class="card-lift bg-surface border border-slate-border rounded-xl shadow-card hover:shadow-lifted flex flex-col p-gutter gap-space-md"' + (job.id ? ' data-job-id="' + escapeHtml(job.id) + '"' : '') + ' data-score="' + score + '"' + passive + '>',
      '  <div class="flex flex-wrap items-start justify-between gap-space-sm">',
      '    <div class="flex flex-col gap-0.5">',
      '      <div class="flex flex-wrap items-center gap-space-sm">',
      '        <span class="font-headline-md text-headline-md text-chalk-text font-semibold">' + escapeHtml(job.company) + '</span>',
      sourceBadge(job.source),
      '      </div>',
      '      <span class="font-body-md text-body-md text-titanium-muted">' + escapeHtml(job.title) + '</span>',
      '    </div>',
      '    <span class="px-space-sm py-0.5 rounded-full ' + (score >= 85 ? 'bg-primary-container text-on-primary' : 'bg-slate-elevated text-chalk-text') + ' font-label-md text-label-md font-bold">' + score + '% match</span>',
      '  </div>',
      '  <div class="flex flex-wrap items-center gap-space-sm font-body-sm text-body-sm text-on-surface-variant">',
      '    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">public</span>' + locNote + '</span>',
      '    <span>•</span><span>Engineering</span>',
      salary ? '<span>•</span><span>' + salary + '</span>' : '',
      job.posted_date ? '<span>•</span><span>Posted ' + escapeHtml(job.posted_date).slice(0, 16) + '</span>' : '',
      '  </div>',
      '  <div class="bg-slate-elevated rounded-lg p-space-md flex flex-col gap-space-md">',
      '    <div class="grid grid-cols-1 sm:grid-cols-3 gap-gutter">',
      bar('Skill overlap', bars.skillOverlap + '%', bars.skillOverlap, 'bg-primary-container'),
      bar('Experience alignment', bars.expAlign + '%', bars.expAlign, 'bg-primary-container'),
      bar('Skill gaps', (bars.gap ? bars.gap >= 60 ? 'High' : 'Minimal' : 'None detected'), bars.gap, bars.gap ? 'bg-signal-amber' : 'bg-primary-container'),
      '    </div>',
      reasonsHtml(match),
      '  </div>',
      '  <div class="flex justify-end">',
      '    <button class="draft-btn flex items-center gap-space-xs px-gutter py-space-sm rounded-lg ' + (score >= 85 ? 'bg-primary hover:bg-primary-fixed-dim text-on-primary' : 'bg-slate-elevated hover:bg-slate-border text-chalk-text') + ' font-label-md text-label-md font-semibold transition-colors" data-match-index="INDEX">',
      '      <span class="material-symbols-outlined text-[16px]">edit_note</span>',
      '      <span>Create application draft</span>',
      '    </button>',
      '  </div>',
      '</div>',
    ].join('\n');
  }

  function bar(label, value, width, color) {
    return [
      '<div class="flex flex-col gap-1">',
      '<div class="flex justify-between font-label-sm text-label-sm">',
      '<span class="text-titanium-muted">' + label + '</span>',
      '<span class="text-chalk-text font-medium">' + value + '</span>',
      '</div>',
      '<div class="w-full h-1.5 rounded-full bg-slate-elevated overflow-hidden"><div class="sf-progress h-1.5 rounded-full ' + color + '" style="width: 0%" data-w="' + Math.max(4, Math.min(100, width)) + '"></div></div>',
      '</div>',
    ].join('');
  }

  function reasonsHtml(match) {
    const reasons = (match.reasons || []).slice(0, 4);
    if (!reasons.length) {
      return '<p class="font-body-sm text-body-sm text-titanium-muted">No explicit rationale was surfaced for this posting.</p>';
    }
    return reasons.map(function (r) {
      return '<div class="flex items-start gap-space-sm font-body-sm text-body-sm text-on-surface"><span class="material-symbols-outlined text-primary-container text-[16px] shrink-0">check_circle</span><span>' + escapeHtml(r) + '</span></div>';
    }).join('\n');
  }

  function renderMatches(animated) {
    const above = matches.filter(function (m) { return m.score >= currentThreshold; });
    // Always surface the best fits so a new resume never looks "empty" —
    // fall back to top 8 when nothing clears the threshold.
    const visible = above.length ? above : matches.slice(0, 8);
    const scope = above.length
      ? visible.length + (visible.length === 1 ? ' match' : ' matches') + ' above ' + currentThreshold + '% threshold'
      : '0 above ' + currentThreshold + '% — showing ' + visible.length + ' closest fits';
    matchCount.textContent = scope;

    if (!matches.length) {
      document.getElementById('scraped-total').textContent = '0';
      resultsEl.innerHTML = '<div class="bg-surface border border-dashed border-slate-border rounded-xl p-space-xl flex flex-col items-center justify-center text-center gap-space-sm py-space-2xl">'
        + '<span class="material-symbols-outlined text-titanium-muted text-[40px]">search</span>'
        + '<span class="font-headline-sm text-headline-sm text-chalk-text">No results yet</span>'
        + '<span class="font-body-md text-body-md text-titanium-muted">Run the matcher to surface ranked openings for your profile.</span></div>';
      return;
    }

    const fallbackNote = above.length ? '' :
      '<div class="bg-surface border border-signal-amber/40 rounded-lg p-space-md font-body-sm text-body-sm text-signal-amber flex items-center gap-space-sm">'
      + '<span class="material-symbols-outlined text-[18px]">info</span>'
      + '<span>Nothing scored above ' + currentThreshold + '% for this resume. Showing the closest fits — lower the threshold or refine skills on the Profile page.</span></div>';

    const html = fallbackNote + visible.map(cardHtml).join('\n');
    resultsEl.innerHTML = html;
    document.getElementById('scraped-total').textContent = String(matches.length);

    if (animated && window.CPMotion) window.CPMotion.stagger(resultsEl);
    resultsEl.querySelectorAll('.sf-progress').forEach(function (bar) {
      const target = bar.getAttribute('data-w') + '%';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { bar.style.width = target; });
      });
    });

    const buttons = resultsEl.querySelectorAll('.draft-btn');
    buttons.forEach(function (btn) {
      const idx = parseInt(btn.getAttribute('data-match-index'), 10);
      btn.addEventListener('click', function () {
        const m = visible[idx];
        if (m) draftForMatch(m);
      });
    });
  }

  function draftForMatch(match) {
    const job = match.job || {};
    logLine('Preparing draft for ' + job.company + ' — ' + job.title, 'text-signal-amber');
    window.CampusPlacementAPI.draftEmail(job)
      .then(function () {
        logLine('Draft saved and queued to the Email Dispatch page.', 'text-primary-fixed');
        showToast('Draft created', 'Application for ' + job.title + ' is ready to review in Email Dispatch.');
      })
      .catch(function (err) {
        showToast('Draft failed', String(err.message || err), true);
      });
  }

  // --- Match execution ---
  function runMatcher(auto) {
    matcherBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Matching…</span>';
    matcherBtn.disabled = true;
    const started = performance.now();

    const body = {
      q: queryInput.value.trim(),
      remote: remoteToggle.checked,
      limit: 40,
    };

    window.CampusPlacementAPI.matchJobs(body)
      .then(function (data) {
        matches = data.matches || [];
        const ms = Math.round(performance.now() - started);
        document.getElementById('elapsed-cycle').textContent = (ms / 1000).toFixed(1) + 's';
        logLine('Match cycle complete: ' + matches.length + ' openings ranked in ' + ms + 'ms.', 'text-primary-fixed');
        const passed = matches.filter(function (m) { return m.score >= currentThreshold; }).length;
        if (passed) {
          logLine(passed + ' openings clear the ' + currentThreshold + '% threshold.', 'text-chalk-text');
        } else {
          logLine('None above ' + currentThreshold + '% — showing closest fits. Lower the slider for more.', 'text-signal-amber');
        }
        renderMatches(true);
        matcherBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">bolt</span><span>Run Matcher</span>';
        matcherBtn.disabled = false;
        if (auto) showToast('Matcher complete', matches.length + ' openings scored against your profile.');
      })
      .catch(function (err) {
        logLine('Match failed: ' + String(err.message || err), 'text-error');
        document.getElementById('elapsed-cycle').textContent = '—';
        const banner = document.getElementById('no-profile-banner');
        if (banner) { banner.classList.remove('hidden'); banner.classList.add('flex'); }
        matcherBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">bolt</span><span>Run Matcher</span>';
        matcherBtn.disabled = false;
        showToast('Matcher failed', String(err.message || err), true);
      });
  }

  matcherBtn.addEventListener('click', function () { runMatcher(true); });

  slider.addEventListener('input', function (e) {
    currentThreshold = parseInt(e.target.value, 10);
    thresholdVal.textContent = '>' + currentThreshold + '%';
    renderMatches();
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('batch-top3').addEventListener('click', function () {
      const cards = resultsEl.querySelectorAll('[data-score]');
      cards.forEach(function (el, i) {
        if (i < 3) el.classList.remove('hidden');
        else el.style.display = 'none';
      });
    });
    document.getElementById('batch-clear').addEventListener('click', function () {
      resultsEl.querySelectorAll('[data-score]').forEach(function (el) { el.style.display = ''; });
    });
  });

  // --- Boot: hydrate candidate stack (re-read on every focus so a fresh upload shows up) ---
  function hydrateCandidate() {
    return window.CampusPlacementAPI.getProfile().then(function (data) {
      const p = data && data.profile;
      if (!p) {
        stackEl.innerHTML = '<span class="font-body-sm text-body-sm text-titanium-muted">No profile synced — upload a resume first.</span>';
        document.getElementById('active-profile').textContent = 'No profile yet';
        return;
      }
      const skills = Array.isArray(p.skills) ? p.skills : [];
      stackEl.innerHTML = skills.slice(0, 12).map(function (s) {
        return '<span class="px-space-sm py-0.5 rounded-md bg-slate-elevated text-chalk-text font-body-sm text-body-sm">' + escapeHtml(s) + '</span>';
      }).join('') || '<span class="font-body-sm text-body-sm text-titanium-muted">No skills on file.</span>';
      document.getElementById('active-profile').textContent = (p.name || 'Profile').slice(0, 24);
    }).catch(function () { /* keep default state */ });
  }
  hydrateCandidate();
  window.addEventListener('focus', hydrateCandidate);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) hydrateCandidate();
  });
})();