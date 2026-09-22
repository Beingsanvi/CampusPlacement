/**
 * Main Application Logic for Campus Placement AI
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const activityTimeline = document.getElementById('activityTimeline');
    const quickBtns = document.querySelectorAll('.quick-btn');

    // Initialize
    init();

    function init() {
        // Event Listeners
        sendBtn.addEventListener('click', handleSendMessage);
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });

        // Quick action buttons
        quickBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const query = this.getAttribute('data-query');
                userInput.value = query;
                handleSendMessage();
            });
        });

        // Load initial status
        updateActivity('System ready', 'completed');
    }

    /**
     * Handle sending a message
     */
    async function handleSendMessage() {
        const message = userInput.value.trim();
        
        if (!message) {
            return;
        }

        // Add user message to chat
        addMessageToChat(message, 'user');
        userInput.value = '';

        // Update activity
        updateActivity('Processing query...', 'processing');

        try {
            // Show typing indicator
            const typingIndicator = addTypingIndicator();

            // Send to API
            const response = await window.CampusPlacementAPI.sendChatMessage(message);

            // Remove typing indicator
            typingIndicator.remove();

            // Add bot response to chat
            addMessageToChat(response.answer, 'bot');

            // Update activity based on response
            updateActivity(`Query answered (${response.query_type})`, 'completed');

        } catch (error) {
            console.error('Error:', error);
            
            // Remove typing indicator if exists
            const typingIndicator = document.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }

            // Add error message
            addMessageToChat(
                'Sorry, I encountered an error while processing your request. Please try again later.',
                'bot',
                true
            );

            updateActivity('Error processing query', 'error');
        }
    }

    /**
     * Add a message to the chat
     */
    function addMessageToChat(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'}`;

        const avatarIcon = sender === 'user' ? 'fa-user' : 'fa-robot';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${avatarIcon}"></i>
            </div>
            <div class="message-content ${isError ? 'error' : ''}">
                ${formatMessage(content)}
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Format message content (convert markdown-like syntax)
     */
    function formatMessage(content) {
        // Convert **bold** to <strong>
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert newlines to <br>
        content = content.replace(/\n/g, '<br>');
        
        // Convert bullet points
        content = content.replace(/^- (.*)/gm, '<li>$1</li>');
        content = content.replace(/<li>.*<\/li>/s, '<ul>$&</ul>');
        
        return content;
    }

    /**
     * Add typing indicator
     */
    function addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        return typingDiv;
    }

    /**
     * Update activity timeline
     */
    function updateActivity(text, status) {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        let iconClass = '';
        let icon = '';
        
        switch (status) {
            case 'processing':
                iconClass = 'processing';
                icon = 'fa-spinner fa-spin';
                break;
            case 'completed':
                iconClass = 'completed';
                icon = 'fa-check';
                break;
            case 'error':
                iconClass = 'error';
                icon = 'fa-times';
                break;
            default:
                iconClass = 'waiting';
                icon = 'fa-hourglass-start';
        }
        
        activityItem.innerHTML = `
            <div class="activity-icon ${iconClass}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="activity-text">${text}</div>
        `;
        
        // Clear existing items and add new one
        activityTimeline.innerHTML = '';
        activityTimeline.appendChild(activityItem);
    }

    /**
     * Show error state on input
     */
    function showErrorState() {
        userInput.style.borderColor = '#d13438';
        setTimeout(() => {
            userInput.style.borderColor = '';
        }, 2000);
    }
});