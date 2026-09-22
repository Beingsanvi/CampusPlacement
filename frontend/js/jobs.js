/**
 * Jobs & Applications page logic for Campus Placement AI
 */

(function () {
    const API = window.CampusPlacementAPI;

    document.addEventListener('DOMContentLoaded', async () => {
        await loadProfile();
        await loadDrafts();

        document.getElementById('resumeFile').addEventListener('change', uploadResume);
        document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
        document.getElementById('matchBtn').addEventListener('click', runMatch);
        document.getElementById('modalClose').addEventListener('click', () => modal.hidden = true);
        document.getElementById('approveBtn').addEventListener('click', approveCurrentDraft);
        document.getElementById('regenerateBtn').addEventListener('click', regenerateDraft);
        document.getElementById('jobSearch').addEventListener('keypress', e => { if (e.key === 'Enter') runMatch(); });
    });

    const modal = () => document.getElementById('draftModal');
    const setStatus = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // --- Profile ---

    async function loadProfile() {
        try {
            const { profile } = await API.getProfile();
            if (!profile) return;
            document.getElementById('pName').value = profile.name || '';
            document.getElementById('pEmail').value = profile.email || '';
            document.getElementById('pRole').value = profile.role_preference || '';
            document.getElementById('pLocation').value = profile.location || '';
            document.getElementById('pJobType').value = profile.job_type || '';
            document.getElementById('pCgpa').value = profile.education?.cgpa || '';
            document.getElementById('pDegree').value = profile.education?.degree || '';
            document.getElementById('pSkills').value = (profile.skills || []).join(', ');
            document.getElementById('pProjects').value = (profile.projects || []).join(', ');
            setStatus('profileStatus', 'Profile loaded');
        } catch (e) {
            setStatus('profileStatus', 'No saved profile found — upload a resume or fill the form.');
        }
    }

    async function uploadResume(e) {
        const file = e.target.files[0];
        if (!file) return;
        setStatus('resumeStatus', 'Uploading & parsing...');
        try {
            const { profile } = await API.uploadResume(file, true);
            setStatus('resumeStatus', `Parsed from ${file.name}`);
            await loadProfile();
        } catch (err) {
            setStatus('resumeStatus', `Upload failed: ${err.message}`);
        }
    }

    async function saveProfile() {
        const profile = {
            name: document.getElementById('pName').value.trim(),
            email: document.getElementById('pEmail').value.trim(),
            location: document.getElementById('pLocation').value.trim(),
            role_preference: document.getElementById('pRole').value.trim(),
            job_type: document.getElementById('pJobType').value,
            education: {
                degree: document.getElementById('pDegree').value.trim(),
                cgpa: document.getElementById('pCgpa').value,
            },
            skills: document.getElementById('pSkills').value.split(',').map(s => s.trim()).filter(Boolean),
            projects: document.getElementById('pProjects').value.split(',').map(s => s.trim()).filter(Boolean),
            years_experience: 0,
        };
        setStatus('profileStatus', 'Saving...');
        try {
            await API.saveProfile(profile);
            setStatus('profileStatus', 'Profile saved ✓');
        } catch (err) {
            setStatus('profileStatus', `Save failed: ${err.message}`);
        }
    }

    // --- Jobs & matching ---

    async function runMatch() {
        const q = document.getElementById('jobSearch').value.trim();
        const location = document.getElementById('jobLocation').value.trim();
        const remote = document.getElementById('jobRemote').checked;

        setStatus('jobsStatus', 'Scraping live job boards & matching your profile...');
        const box = document.getElementById('matchResults');
        box.innerHTML = '<p class="hint">Searching Jobicy, Remotive, Hacker News "Who is hiring?"...</p>';
        try {
            const { matches } = await API.matchJobs({ q, location, remote, limit: 12 });
            setStatus('jobsStatus', `${matches.length} matches found`);
            renderMatches(matches, box);
        } catch (err) {
            setStatus('jobsStatus', `Error: ${err.message}`);
            box.innerHTML = '';
        }
    }

    function renderMatches(matches, box) {
        if (!matches.length) {
            box.innerHTML = '<p class="hint">No matches. Widen your filters or add more skills.</p>';
            return;
        }
        box.innerHTML = matches.map(m => {
            const j = m.job;
            const bar = Math.max(4, m.score);
            return `
            <div class="job-row ${m.is_match ? 'is-match' : ''}">
              <div class="job-score">
                <div class="score-num">${m.score}</div>
                <div class="score-bar"><div class="score-fill" style="width:${bar}%"></div></div>
              </div>
              <div class="job-info">
                <div class="job-title">${escapeHtml(j.title)}</div>
                <div class="job-company">${escapeHtml(j.company)} · ${escapeHtml(j.location)} ${j.remote ? '<span class="tag remote">Remote</span>' : ''}</div>
                ${j.salary ? `<div class="job-salary">${escapeHtml(j.salary)}</div>` : ''}
                <div class="job-reasons">${(m.reasons || []).map(r => `<span class="reason">${escapeHtml(r)}</span>`).join('')}</div>
                ${m.missing_skills && m.missing_skills.length ? `<div class="job-missing">Missing: ${m.missing_skills.map(escapeHtml).join(', ')}</div>` : ''}
                ${j.url ? `<a class="job-link" href="${escapeHtml(j.url)}" target="_blank" rel="noopener">View posting →</a>` : ''}
              </div>
              <div class="job-actions">
                <button class="btn btn-primary btn-sm" data-job='${escapeAttr(JSON.stringify(j))}'>Draft email</button>
              </div>
            </div>`;
        }).join('');
        box.querySelectorAll('button[data-job]').forEach(btn => {
            btn.addEventListener('click', () => openDraftModal(JSON.parse(btn.getAttribute('data-job'))));
        });
    }

    // --- Email drafts ---

    async function openDraftModal(job) {
        document.getElementById('draftModalTitle').textContent = `Draft for ${job.title} @ ${job.company}`;
        document.getElementById('contactEmail').value = '';
        document.getElementById('draftSubject').value = 'Generating...';
        document.getElementById('draftBody').value = '';
        setStatus('draftStatus', 'Drafting personalized email with AI...');
        modal().hidden = false;
        window._currentJob = job;
        try {
            const { draft } = await API.draftEmail(job);
            window._currentDraft = draft;
            document.getElementById('contactEmail').value = draft.contact_email || '';
            document.getElementById('draftSubject').value = draft.subject || '';
            document.getElementById('draftBody').value = draft.body || '';
            setStatus('draftStatus', draft.needs_contact ? '⚠ No recipient found in posting — add a contact email.' : `Draft ready (${draft.draft_id}) — review, then Approve.`);
            await loadDrafts();
        } catch (err) {
            setStatus('draftStatus', `Draft failed: ${err.message}`);
        }
    }

    async function approveCurrentDraft() {
        const draft = window._currentDraft;
        if (!draft) return;
        try {
            await API.approveEmail(draft.draft_id, document.getElementById('contactEmail').value);
            setStatus('draftStatus', 'Approved ✓ — it will be sent when you hit Send. (SMTP send is ready in the API; configure SMTP in .env to go live.)');
            await loadDrafts();
            modal().hidden = true;
        } catch (err) {
            setStatus('draftStatus', `Approve failed: ${err.message}`);
        }
    }

    async function regenerateDraft() {
        const job = window._currentJob;
        if (!job) return;
        setStatus('draftStatus', 'Regenerating...');
        try {
            const { draft } = await API.draftEmail(job);
            window._currentDraft = draft;
            document.getElementById('draftSubject').value = draft.subject || '';
            document.getElementById('draftBody').value = draft.body || '';
            setStatus('draftStatus', 'Regenerated.');
        } catch (err) {
            setStatus('draftStatus', `Failed: ${err.message}`);
        }
    }

    async function loadDrafts() {
        try {
            const { drafts } = await API.listDrafts();
            renderDraftList(drafts.filter(d => d.status !== 'sent'), 'pendingDrafts', false);
            renderDraftList(drafts.filter(d => d.status === 'sent'), 'sentDrafts', true);
        } catch (e) { /* backend not deployed yet */ }
    }

    function renderDraftList(drafts, elId, isSent) {
        const box = document.getElementById(elId);
        if (!drafts.length) { box.innerHTML = '<p class="hint">None yet.</p>'; return; }
        box.innerHTML = drafts.map(d => `
            <div class="draft-row">
              <div class="draft-meta">
                <strong>${escapeHtml(d.job?.title || 'Job')}</strong> @ ${escapeHtml(d.job?.company || '?')}
                <span class="draft-status ${d.status}">${d.status}</span>
              </div>
              <div class="draft-subject">${escapeHtml(d.subject)}</div>
              <div class="draft-actions">
                ${isSent
                    ? `<span class="hint">Sent to ${escapeHtml(d.contact_email || '—')}</span>`
                    : `<button class="btn btn-sm btn-secondary" data-id="${d.draft_id}">Review</button>
                       <button class="btn btn-sm btn-primary" data-send="${d.draft_id}">Send now</button>`}
              </div>
            </div>`).join('');

        box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', async () => {
            const d = (await API.listDrafts()).drafts.find(x => x.draft_id === b.getAttribute('data-id'));
            if (!d) return;
            document.getElementById('draftModalTitle').textContent = `Draft for ${d.job?.title} @ ${d.job?.company}`;
            window._currentDraft = d;
            document.getElementById('contactEmail').value = d.contact_email || '';
            document.getElementById('draftSubject').value = d.subject || '';
            document.getElementById('draftBody').value = d.body || '';
            setStatus('draftStatus', d.status === 'approved' ? 'Approved: you can send it now.' : `Status: ${d.status}`);
            modal().hidden = false;
        }));
        box.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', async () => {
            const id = b.getAttribute('data-send');
            if (!confirm('Send this approved application email now?')) return;
            try {
                const r = await API.sendEmail(id);
                alert(`Email sent to ${r.result.to}`);
                await loadDrafts();
            } catch (err) {
                alert(`Send failed: ${err.message}`);
            }
        }));
    }

    // --- helpers ---

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeAttr(s) {
        return escapeHtml(String(s).replace(/'/g, '&#39;'));
    }
})();