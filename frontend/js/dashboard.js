/**
 * Dashboard Logic for Campus Placement AI
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initDashboard();

    async function initDashboard() {
        try {
            // Load system status
            await loadSystemStatus();
            
            // Load recent activity
            await loadRecentActivity();
            
            // Update last sync time
            updateLastSyncTime();
            
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    }

    /**
     * Load system status from API
     */
    async function loadSystemStatus() {
        try {
            const status = await window.CampusPlacementAPI.getSystemStatus();
            
            // Update agent status
            updateAgentStatus('Main Placement Agent', status.main_agent === 'active');
            updateAgentStatus('FAQ Agent', status.faq_agent === 'active');
            updateAgentStatus('Preparation Agent', status.preparation_agent === 'active');
            
        } catch (error) {
            console.error('Error loading system status:', error);
            // Use default values if API is not available
            updateAgentStatus('Main Placement Agent', true);
            updateAgentStatus('FAQ Agent', true);
            updateAgentStatus('Preparation Agent', true);
        }
    }

    /**
     * Update agent status display
     */
    function updateAgentStatus(agentName, isActive) {
        const agentCards = document.querySelectorAll('.agent-card');
        
        agentCards.forEach(card => {
            const nameElement = card.querySelector('h3');
            if (nameElement && nameElement.textContent.includes(agentName)) {
                const statusElement = card.querySelector('.agent-status');
                if (statusElement) {
                    statusElement.className = 'agent-status flex items-center gap-space-xs';
                    statusElement.innerHTML = `
                        <span class="w-1.5 h-1.5 ${isActive ? 'bg-primary-container' : 'bg-error'} rounded-full"></span>
                        <span class="font-label-sm text-label-sm ${isActive ? 'text-primary-fixed' : 'text-error'} uppercase font-semibold">${isActive ? 'Active' : 'Inactive'}</span>
                    `;
                }
            }
        });
    }

    /**
     * Load recent activity
     */
    async function loadRecentActivity() {
        try {
            const activity = await window.CampusPlacementAPI.getRecentActivity();
            
            // Update stats
            if (activity.total_queries) {
                document.getElementById('docsProcessed').textContent = '4';
            }
            
            // Update activity list
            updateActivityList(activity.recent_activities || []);
            
        } catch (error) {
            console.error('Error loading recent activity:', error);
            // Use default activity data
            updateActivityList([
                {
                    action: 'Document processed',
                    details: 'placement_policy.pdf indexed',
                    timestamp: new Date().toISOString()
                }
            ]);
        }
    }

    /**
     * Update activity list display
     */
    function updateActivityList(activities) {
        const activityList = document.getElementById('recentActivity');
        if (!activityList) return;
        
        activityList.innerHTML = '';
        
        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item flex items-start gap-space-md bg-slate-elevated rounded-lg p-space-md';

            activityItem.innerHTML = `
                <div class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-primary-container text-[16px]">task_alt</span>
                </div>
                <div class="flex flex-col">
                    <p class="font-body-md text-body-md text-chalk-text"><strong>${escapeHtml(activity.action)}:</strong> ${escapeHtml(activity.details)}</p>
                    <span class="activity-time font-body-sm text-body-sm text-titanium-muted">${formatTimeAgo(activity.timestamp)}</span>
                </div>
            `;

            activityList.appendChild(activityItem);
        });
    }

    /**
     * Update last sync time
     */
    function updateLastSyncTime() {
        const lastSyncElement = document.getElementById('lastSync');
        if (lastSyncElement) {
            lastSyncElement.textContent = 'Just now';
        }
    }

    /**
     * Escape untrusted strings before injecting into the DOM.
     */
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Format timestamp to time ago string
     */
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minutes ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hours ago`;
        } else {
            return `${diffDays} days ago`;
        }
    }

    /**
     * Refresh dashboard data
     */
    async function refreshDashboard() {
        try {
            await loadSystemStatus();
            await loadRecentActivity();
            updateLastSyncTime();
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
        }
    }

    // Add refresh button functionality if it exists
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshDashboard);
    }
});