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
                    statusElement.className = `agent-status ${isActive ? 'active' : 'inactive'}`;
                    statusElement.innerHTML = `
                        <span class="status-dot"></span>
                        ${isActive ? 'Active' : 'Inactive'}
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
            activityItem.className = 'activity-item';
            
            activityItem.innerHTML = `
                <div class="activity-icon completed">
                    <i class="fas fa-check"></i>
                </div>
                <div class="activity-details">
                    <p><strong>${activity.action}:</strong> ${activity.details}</p>
                    <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
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