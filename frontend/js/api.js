/**
 * API Service for Campus Placement AI
 * Handles communication with the Azure Function backend
 */

const API_BASE_URL = (window.CAMPUS_API_BASE_URL || 'https://campus-placement-api-eah8hkg9embeh5e4.koreacentral-01.azurewebsites.net/api');

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!response.ok) {
        let msg = `HTTP ${response.status}`;
        try {
            const data = await response.json();
            if (data.error) msg = data.error;
        } catch (e) { /* ignore */ }
        throw new Error(msg);
    }
    return response.json();
}

/**
 * Send a chat message to the AI agent
 * @param {string} message - The user's message
 */
async function sendChatMessage(message) {
    return request('/chat', { method: 'POST', body: JSON.stringify({ message }) });
}

async function getSystemStatus() {
    return request('/status');
}

async function getRecentActivity() {
    return request('/activity');
}

async function healthCheck() {
    return request('/health');
}

async function uploadDocument(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

// --- Profile ---

async function getProfile() {
    return request('/profile');
}

async function saveProfile(profile) {
    return request('/profile', { method: 'POST', body: JSON.stringify(profile) });
}

async function uploadResume(file, enrich = true) {
    const formData = new FormData();
    formData.append('resume', file);
    const response = await fetch(`${API_BASE_URL}/profile/upload?enrich=${enrich}`, { method: 'POST', body: formData });
    if (!response.ok) {
        let msg = `HTTP ${response.status}`;
        try { const d = await response.json(); if (d.error) msg = d.error; } catch (e) {}
        throw new Error(msg);
    }
    return response.json();
}

// --- Jobs ---

async function searchJobs(params = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.location) qs.set('location', params.location);
    if (params.remote) qs.set('remote', params.remote);
    if (params.refresh) qs.set('refresh', 'true');
    if (params.limit) qs.set('limit', params.limit);
    const url = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/jobs${url}`);
}

async function matchJobs(body = {}) {
    return request('/jobs/match', { method: 'POST', body: JSON.stringify(body) });
}

// --- Email (draft -> approve -> send) ---

async function draftEmail(job, contactEmail = '') {
    return request('/email/draft', { method: 'POST', body: JSON.stringify({ job, contact_email: contactEmail }) });
}

async function listDrafts(status = '') {
    const qs = status ? `?status=${status}` : '';
    return request(`/email/drafts${qs}`);
}

async function approveEmail(draftId, contactEmail = '') {
    return request('/email/approve', { method: 'POST', body: JSON.stringify({ draft_id: draftId, contact_email: contactEmail }) });
}

async function sendEmail(draftId) {
    return request('/email/send', { method: 'POST', body: JSON.stringify({ draft_id: draftId }) });
}

// Export API functions
window.CampusPlacementAPI = {
    sendChatMessage,
    getSystemStatus,
    getRecentActivity,
    healthCheck,
    uploadDocument,
    getProfile,
    saveProfile,
    uploadResume,
    searchJobs,
    matchJobs,
    draftEmail,
    listDrafts,
    approveEmail,
    sendEmail
};