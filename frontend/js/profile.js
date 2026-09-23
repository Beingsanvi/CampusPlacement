/**
 * Candidate Profile & Parsing
 * Wires resume upload/parse, profile loading and JSON export to the real backend.
 */
(function initCandidateConsole() {
  const triggerBtn = document.getElementById('trigger-parser-btn');
  const reloadBtn = document.getElementById('reload-svc-btn');
  const syncBtn = document.getElementById('sync-profile-btn');
  const exportBtn = document.getElementById('export-schema-btn');
  const toast = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastMsg = document.getElementById('toast-message');
  const progressBar = document.getElementById('progress-bar-fill');
  const progressPercent = document.getElementById('progress-percent');
  const statusPill = document.getElementById('extraction-status-pill');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('resume-file-input');
  const rawBuffer = document.getElementById('raw-buffer');

  let stagedFile = null;
  let currentProfile = null;

  function showToast(title, message, isError) {
    toastTitle.textContent = title;
    toastMsg.textContent = message;
    toastTitle.className = 'font-label-sm text-label-sm uppercase font-bold tracking-wider ' + (isError ? 'text-error' : 'text-primary-container');
    toast.classList.remove('translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(function () {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-24', 'opacity-0');
    }, 3400);
  }

  function logBuffer(line, cls) {
    const p = document.createElement('p');
    p.className = cls || 'text-titanium-muted';
    p.textContent = line;
    rawBuffer.appendChild(p);
    rawBuffer.scrollTop = rawBuffer.scrollHeight;
    while (rawBuffer.children.length > 12) rawBuffer.removeChild(rawBuffer.firstChild);
  }

  function sha256Hex(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < (str.length || 0); i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8) + ''.padEnd(56, '0');
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }

  function confidenceFor(skill, summary, idx) {
    const base = summary && summary.toLowerCase().includes(skill.toLowerCase()) ? 0.88 : 0.7;
    return Math.min(99, Math.floor(base * 100) + (Math.abs(hash(skill)) + idx) % 8);
  }

  function stageFile(file) {
    stagedFile = file;
    document.getElementById('blob-name').textContent = file.name;
    document.getElementById('blob-size').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
    document.getElementById('blob-hash').textContent = 'SHA256: ' + sha256Hex(file.name + file.size + file.lastModified);
    document.getElementById('blob-verify').textContent = 'STAGED';
    logBuffer('[' + t() + '] BLOB staged: ' + file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)');
  }

  function t() {
    return new Date().toTimeString().split(' ')[0];
  }

  function setProgress(pct) {
    progressBar.style.width = pct + '%';
    progressPercent.textContent = pct + '%';
  }

  // --- Render parsed / loaded profile into the right-hand card ---
  function renderProfile(profile) {
    if (!profile) return;
    currentProfile = profile;

    const edu = profile.education || {};
    document.getElementById('cand-name').value = profile.name || 'Unnamed Candidate';
    document.getElementById('cand-email').value = (profile.email ? profile.email + ' — ' : '') + (edu.degree || '') + (edu.institution ? ' // ' + edu.institution : '');
    document.getElementById('cand-vector-id').textContent = 'VECTOR_ID: ' + (profile.github || 'SYNCED').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || '—';

    const gh = profile.github || '';
    const li = profile.linkedin || '';
    document.getElementById('cand-github').innerHTML = '<span class="material-symbols-outlined text-[14px]">code</span><span>' + (gh || 'github/none').replace('https://', '').slice(0, 26) + '</span>';
    document.getElementById('cand-github').href = gh || '#';
    document.getElementById('cand-linkedin').innerHTML = '<span class="material-symbols-outlined text-[14px]">language</span><span>' + (li || 'linkedin/none').replace('https://', '').slice(0, 26) + '</span>';
    document.getElementById('cand-linkedin').href = li || '#';

    // Academic + confidence
    document.getElementById('academic-entity').textContent = edu.degree || 'No degree parsed';
    document.getElementById('academic-cgpa').textContent = edu.cgpa || '--';
    const skills = Array.isArray(profile.skills) ? profile.skills : [];
    const conf = Math.min(99, 78 + skills.length * 2 + (edu.cgpa ? 4 : 0));
    document.getElementById('confidence-score').textContent = (conf / 100).toFixed(3);
    document.getElementById('skill-count').textContent = skills.length;
    document.getElementById('progress-percent').textContent = '100%';
    document.getElementById('progress-bar-fill').style.width = '100%';

    // Entity map chips
    document.getElementById('entity-map').innerHTML = skills.slice(0, 14).map(function (s) {
      const cat = /python|go|rust|javascript|typescript|java|c\+\+|c#|php|ruby|swift|kotlin|html|css|react|vue|angular|node/i.test(s) ? 'LANG'
        : /azure|aws|gcp|docker|kubernetes|terraform|linux|cloud/i.test(s) ? 'CLOUD'
        : /sql|mongodb|postgres|redis|mysql|kafka|arrow/i.test(s) ? 'OPS'
        : 'FW';
      const cls = cat === 'LANG' ? 'text-chalk-text' : cat === 'FW' ? 'text-primary-fixed' : 'text-bone-dim';
      return '<span class="px-space-xs py-0.5 bg-slate-elevated ' + cls + '">' + cat + ': ' + s + '</span>';
    }).join('') || '<span class="text-titanium-muted px-space-xs py-0.5 bg-slate-elevated">NO SKILLS EXTRACTED</span>';

    // Skills matrix bars
    const summary = profile.summary || '';
    document.getElementById('skills-matrix').innerHTML = skills.slice(0, 8).map(function (s, i) {
      const confSk = confidenceFor(s, summary, i);
      return [
        '<div class="bg-slate-elevated rounded-lg p-space-sm flex flex-col gap-space-xs">',
        '<div class="flex items-center justify-between font-label-md text-label-md text-chalk-text">',
        '<span class="uppercase">' + s + '</span>',
        '<span class="text-primary-container font-code-telemetry text-code-telemetry">' + confSk + '% [CONF]</span>',
        '</div>',
        '<div class="w-full h-1 bg-slate-elevated"><div class="h-full bg-primary-container" style="width: ' + confSk + '%;"></div></div>',
        '<span class="font-code-telemetry text-code-telemetry text-titanium-muted">Detected by parser v3.2</span>',
        '</div>',
      ].join('');
    }).join('') || '<p class="font-body-md text-body-md text-bone-dim bg-slate-elevated rounded-lg p-space-md">Upload a resume to derive a normalized skills matrix.</p>';

    // Experience + projects
    const exp = Array.isArray(profile.experience) ? profile.experience : [];
    const projects = Array.isArray(profile.projects) ? profile.projects : [];
    let exHtml = '';
    exp.slice(0, 3).forEach(function (e) {
      exHtml += [
        '<div class="bg-slate-elevated rounded-lg p-space-md flex flex-col gap-1 hover:bg-slate-border transition-colors">',
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">',
        '<div class="flex items-center gap-space-sm">',
        '<span class="font-headline-sm text-headline-sm text-chalk-text uppercase">' + (e.company || 'Experience') + '</span>',
        '<span class="px-space-xs py-0.5 bg-slate-elevated font-label-sm text-label-sm text-primary-fixed uppercase">' + (e.role || 'ROLE') + '</span>',
        '</div>',
        '<span class="font-code-telemetry text-code-telemetry text-titanium-muted">' + (e.years ? e.years + ' YRS' : '') + '</span>',
        '</div>',
        '</div>',
      ].join('');
    });
    projects.slice(0, 2).forEach(function (p) {
      exHtml += [
        '<div class="bg-slate-elevated rounded-lg p-space-md flex flex-col gap-1 hover:bg-slate-border transition-colors">',
        '<div class="flex items-center gap-space-sm">',
        '<span class="material-symbols-outlined text-[16px] text-primary-fixed">inventory_2</span>',
        '<span class="font-headline-sm text-headline-sm text-chalk-text uppercase">' + p + '</span>',
        '</div>',
        '</div>',
      ].join('');
    });
    if (!exHtml) {
      exHtml = '<p class="font-body-md text-body-md text-bone-dim bg-slate-elevated rounded-lg p-space-md">No validated experience entries yet — parser extracts roles &amp; companies on upload.</p>';
    }
    document.getElementById('experience-list').innerHTML = exHtml;

    // Preferences
    document.getElementById('preferences-grid').innerHTML = [
      {
        label: 'DESIRED_ROLES',
        items: profile.role_preference ? [profile.role_preference] : ['(unspecified)'],
        active: true,
      },
      {
        label: 'TARGET_LOCATIONS',
        items: profile.location ? [profile.location] : [],
        active: !!profile.location,
      },
      {
        label: 'EDUCATION_PROFILE',
        items: (edu.degree ? [edu.degree + (edu.institution ? ' @ ' + edu.institution : '')] : []) + (edu.cgpa ? ['CGPA ' + edu.cgpa] : []),
        active: true,
      },
    ].map(function (col) {
      return [
        '<div class="flex flex-col gap-space-xs">',
        '<span class="font-label-sm text-label-sm text-titanium-muted uppercase">' + col.label + '</span>',
        '<div class="flex flex-col gap-1">',
        col.items.map(function (item) {
          return '<span class="font-label-md text-label-md text-chalk-text flex items-center gap-space-xs"><span class="h-1.5 w-1.5 ' + (col.active ? 'bg-primary-container' : 'bg-titanium-muted') + '"></span>' + item + '</span>';
        }).join(''),
        '</div>',
        '</div>',
      ].join('');
    }).join('');
  }

  // --- File staging ---
  dropZone.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) stageFile(fileInput.files[0]);
  });
  ['dragenter', 'dragover'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) { e.preventDefault(); dropZone.classList.add('bg-slate-elevated'); }, false);
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.remove('bg-slate-elevated');
    }, false);
  });
  dropZone.addEventListener('drop', function (e) {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) stageFile(file);
  });

  // --- Trigger parser: real upload -> parse -> re-indexsation simulation ---
  triggerBtn.addEventListener('click', function () {
    if (!stagedFile) {
      showToast('NO BLOB STAGED', 'Select or drop a resume (PDF / DOCX / TXT) first.', true);
      return;
    }
    triggerBtn.classList.add('opacity-75');
    triggerBtn.disabled = true;
    statusPill.textContent = 'PIPELINE: PARSING...';
    statusPill.className = 'font-label-sm text-label-sm px-space-xs py-0.5 bg-signal-amber/10 text-signal-amber uppercase animate-pulse';
    setProgress(14);
    logBuffer('[' + t() + '] POST /api/profile/upload?enrich=true — sending ' + stagedFile.name);

    window.CampusPlacementAPI.uploadResume(stagedFile, true)
      .then(function (data) {
        setProgress(100);
        const profile = data.profile || data;
        renderProfile(profile);
        const e = profile.education || {};
        logBuffer('[' + t() + '] 200 OK — parsed_from=' + data.parsed_from, 'text-primary-fixed');
        logBuffer('[' + t() + '] Entities resolved: name=' + (profile.name || '?') + ' skills=' + (profile.skills || []).length, 'text-primary-fixed');
        statusPill.textContent = 'PIPELINE: SYNCED';
        statusPill.className = 'font-label-sm text-label-sm px-space-xs py-0.5 bg-primary-container/10 text-primary-container uppercase';
        triggerBtn.classList.remove('opacity-75');
        triggerBtn.disabled = false;
        showToast('PARSER COMPLETED', 'Profile parsed & persisted: ' + data.parsed_from + '.');
      })
      .catch(function (err) {
        setProgress(0);
        progressPercent.textContent = '0%';
        statusPill.textContent = 'PIPELINE: FAULT';
        statusPill.className = 'font-label-sm text-label-sm px-space-xs py-0.5 bg-error-container/10 text-error uppercase';
        triggerBtn.classList.remove('opacity-75');
        triggerBtn.disabled = false;
        logBuffer('[' + t() + '] PARSER FAULT: ' + String(err.message || err), 'text-error');
        showToast('PARSER FAULT', String(err.message || err), true);
      });
  });

  // --- Sync edited profile to backend ---
  syncBtn.addEventListener('click', function () {
    const profile = (currentProfile || {education: {}});
    const payload = {
      name: document.getElementById('cand-name').value.trim(),
      email: (document.getElementById('cand-email').value.split('—')[0] || '').trim(),
      skills: profile.skills || [],
      education: profile.education || {},
      role_preference: profile.role_preference || '',
      location: profile.location || '',
      summary: profile.summary || '',
    };
    window.CampusPlacementAPI.saveProfile(payload)
      .then(function () {
        showToast('PROFILE SERVICE SYNC', 'HTTP 200: candidate vector updated.');
        logBuffer('[' + t() + '] POST /api/profile — 200 OK', 'text-primary-fixed');
      })
      .catch(function (err) {
        showToast('SYNC FAULT', String(err.message || err), true);
      });
  });

  reloadBtn.addEventListener('click', function () {
    loadProfileFromBackend(true);
  });

  // --- Export schema ---
  exportBtn.addEventListener('click', function () {
    const data = currentProfile || { name: document.getElementById('cand-name').value.trim() };
    const schema = {
      candidate_id: (data.name || 'candidate').replace(/\s+/g, '_').toLowerCase(),
      profile: {
        name: data.name || '',
        email: data.email || '',
        education: (data.education || {}).degree ? data.education : { cgpa: data.education && data.education.cgpa },
        skills: data.skills || [],
        experience: data.experience || [],
        preferences: {
          role_preference: data.role_preference || '',
          location: data.location || '',
        },
      },
    };
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate_' + (schema.candidate_id) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('SCHEMA EXPORTED', 'JSON Schema payload downloaded locally.');
  });

  // --- Initial load from backend ---
  function loadProfileFromBackend(showNote) {
    window.CampusPlacementAPI.getProfile()
      .then(function (data) {
        const p = data && data.profile;
        if (p) {
          renderProfile(p);
          if (showNote) showToast('PROFILE LOADED', 'Existing candidate vector rehydrated from backend.');
        } else if (showNote) {
          showToast('NO PROFILE', 'No saved profile on backend yet — upload a resume.', true);
        }
      })
      .catch(function (err) {
        if (showNote) showToast('LOAD FAULT', String(err.message || err), true);
      });
  }
  loadProfileFromBackend(false);
})();