'use strict';
let originalTitle = document.title;
let blinkInterval = null;
let systemSetting = null;

document.addEventListener('DOMContentLoaded', async () => {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    setTimeout(() => {
        const hash = window.location.hash;
        if (hash && hash.startsWith("#")) {
            const recipientId = hash.substring(1);
            loadChat(recipientId);
        }
    }, 500);

    const res = await fetch('/user/fetch/system-setting');
    systemSetting = await res.json();
});

// ============= Chat Notification Script Start ============== //

function showBrowserNotification(title, body, icon = '/assets/images/logo/logo.png') {
    if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body,
            icon,
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

function playMessageSound() {
    const audio = document.getElementById('msgSound');
    if (audio) audio.play().catch(() => { });
}

function startTitleBlink(name) {
    if (blinkInterval) return;
    blinkInterval = setInterval(() => {
        document.title = document.title === originalTitle
            ? `New message from ${name}`
            : originalTitle;
    }, 1000);
}

function stopTitleBlink() {
    clearInterval(blinkInterval);
    blinkInterval = null;
    document.title = originalTitle;
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        stopTitleBlink();
    }
});

// ============= Chat Notification Script End ============== //

// ============= Chat Script with Position Persistence Start ============== //

const CHAT_CONFIG = {
    batchSizes: {
        initial: 25,
        subsequent: 25,
        older: 25,
        mediaHeavy: 8,
        textOnly: 25,
        groupChat: 12
    },
    maxMessagesInMemory: 150,
    cleanupThreshold: 200,
    performance: {
        maxResponseTime: 200,
        maxRenderTime: 100,
        slowConnectionThreshold: 1000
    },
    contentAnalysis: {
        mediaSelectors: ['img', 'video', 'audio', '.media-preview', '.file-attachment'],
        heavyContentThreshold: 5
    },
    colors: {
        primary: '#1c9dea',
        primaryHover: '#1a8cd8',
        text: '#616061',
        textLight: '#868686',
        background: 'transparent'
    },
    persistence: {
        saveInterval: 500,
        restoreDelay: 100,
        maxCacheSize: 50
    }
};

// Enhanced Global State Management with Chat Cache
let chatState = {
    currentOffset: 0,
    recipientIdGlobal: null,
    loadingOlderMessages: false,
    allMessagesLoaded: false,
    hasMoreMessages: false,
    totalLoadedMessages: 0,
    conversationType: 'default',
    performanceMetrics: {
        averageResponseTime: 0,
        slowRequestCount: 0,
        totalRequests: 0
    },
    connectionSpeed: 'normal',
    chatCache: new Map(),
    scrollTimeouts: new Map(),
    chatLoadingStates: new Map()
};

// Chat Cache Entry Structure
class ChatCacheEntry {
    constructor(recipientId) {
        this.recipientId = recipientId;
        this.htmlContent = null;
        this.scrollPosition = 0;
        this.scrollHeight = 0;
        this.lastUpdated = Date.now();
        this.messageCount = 0;
        this.currentOffset = 0;
        this.hasMoreMessages = false;
        this.allMessagesLoaded = false;
        this.conversationType = 'default';
        this.isPositionSaved = false;
        this.messageIds = new Set();
        this.oldestMessageTimestamp = null;
        this.newestMessageTimestamp = null;
    }

    updatePosition(scrollTop, scrollHeight) {
        this.scrollPosition = scrollTop;
        this.scrollHeight = scrollHeight;
        this.lastUpdated = Date.now();
        this.isPositionSaved = true;
    }

    updateContent(htmlContent, messageCount, offset, hasMore, allLoaded, convType) {
        this.htmlContent = htmlContent;
        this.messageCount = messageCount;
        this.currentOffset = offset;
        this.hasMoreMessages = hasMore;
        this.allMessagesLoaded = allLoaded;
        this.conversationType = convType;
        this.lastUpdated = Date.now();

        this.updateMessageTracking(htmlContent);
    }

    updateMessageTracking(htmlContent) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;

        const messages = tempDiv.querySelectorAll('[data-message-id]');
        this.messageIds.clear();

        let oldestTimestamp = null;
        let newestTimestamp = null;

        messages.forEach(msg => {
            const messageId = msg.getAttribute('data-message-id');
            const timestamp = msg.getAttribute('data-timestamp');

            if (messageId) this.messageIds.add(messageId);

            if (timestamp) {
                const ts = parseInt(timestamp);
                if (!oldestTimestamp || ts < oldestTimestamp) {
                    oldestTimestamp = ts;
                }
                if (!newestTimestamp || ts > newestTimestamp) {
                    newestTimestamp = ts;
                }
            }
        });

        this.oldestMessageTimestamp = oldestTimestamp;
        this.newestMessageTimestamp = newestTimestamp;
    }

    isExpired(maxAge = 5 * 60 * 1000) {
        return Date.now() - this.lastUpdated > maxAge;
    }
}

// Chat Cache Manager
class ChatCacheManager {
    constructor() {
        this.cache = chatState.chatCache;
        this.maxSize = CHAT_CONFIG.persistence.maxCacheSize;
    }

    get(recipientId) {
        const entry = this.cache.get(recipientId);
        if (entry && !entry.isExpired()) {
            return entry;
        }
        if (entry) {
            this.cache.delete(recipientId);
        }
        return null;
    }

    set(recipientId, entry) {
        if (this.cache.size >= this.maxSize) {
            this.cleanup();
        }
        this.cache.set(recipientId, entry);
    }

    savePosition(recipientId, scrollTop, scrollHeight) {
        let entry = this.cache.get(recipientId);
        if (!entry) {
            entry = new ChatCacheEntry(recipientId);
            this.cache.set(recipientId, entry);
        }
        entry.updatePosition(scrollTop, scrollHeight);
    }

    cleanup() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);

        const toRemove = Math.floor(this.maxSize * 0.3);
        for (let i = 0; i < toRemove && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
            chatState.chatLoadingStates.delete(entries[i][0]);
        }
    }

    clear(recipientId) {
        this.cache.delete(recipientId);
        chatState.chatLoadingStates.delete(recipientId);
    }

    getStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

// Initialize cache manager
window.cacheManager = new ChatCacheManager();

// Loading State Management
class LoadingStateManager {
    static setLoading(recipientId, isLoading) {
        chatState.chatLoadingStates.set(recipientId, isLoading);
    }

    static isLoading(recipientId) {
        return chatState.chatLoadingStates.get(recipientId) || false;
    }

    static clearLoading(recipientId) {
        chatState.chatLoadingStates.delete(recipientId);
    }

    static clearAllLoading() {
        chatState.chatLoadingStates.clear();
    }

    // More comprehensive reset for all chats except current
    static resetLoadingStateForAllChats() {
        const currentRecipientId = chatState.recipientIdGlobal;
        chatState.chatLoadingStates.forEach((isLoading, recipientId) => {
            if (recipientId !== currentRecipientId) {
                this.setLoading(recipientId, false);
            }
        });

        if (chatState.loadingOlderMessages) {
            chatState.loadingOlderMessages = false;
        }
    }

    // Reset specific chat's loading state completely
    static resetChatLoadingState(recipientId) {
        this.setLoading(recipientId, false);

        if (recipientId === chatState.recipientIdGlobal) {
            chatState.loadingOlderMessages = false;
        }
    }
}

// Position Persistence Functions
function saveCurrentChatPosition() {
    if (!chatState.recipientIdGlobal) return;

    const chatting = document.querySelector('#chatting');
    if (!chatting) return;

    const scrollTop = chatting.scrollTop;
    const scrollHeight = chatting.scrollHeight;

    window.cacheManager.savePosition(chatState.recipientIdGlobal, scrollTop, scrollHeight);
}

function setupScrollPositionTracking(container, recipientId) {
    const existingTimeout = chatState.scrollTimeouts.get(recipientId);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    const handleScroll = () => {
        const timeoutId = chatState.scrollTimeouts.get(recipientId);
        if (timeoutId) clearTimeout(timeoutId);

        const newTimeoutId = setTimeout(() => {
            saveCurrentChatPosition();
        }, CHAT_CONFIG.persistence.saveInterval);

        chatState.scrollTimeouts.set(recipientId, newTimeoutId);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            saveCurrentChatPosition();
        }
    });
}

function restoreScrollPosition(container, recipientId) {
    const cachedEntry = window.cacheManager.get(recipientId);
    if (!cachedEntry || !cachedEntry.isPositionSaved) {
        setTimeout(() => scrollToBottom(container), CHAT_CONFIG.persistence.restoreDelay);
        return;
    }

    const restorePosition = () => {
        container.scrollTop = cachedEntry.scrollPosition;
    };

    setTimeout(restorePosition, 50);
    setTimeout(restorePosition, 100);
    setTimeout(restorePosition, 200);

    requestAnimationFrame(() => {
        setTimeout(restorePosition, 100);
    });
}

async function checkIfBlocked(recipientId) {
    try {
      const response = await fetch(`/user/check-block/${recipientId}`);
      const data = await response.json();
  
      const messageInput = document.querySelector(".message-input");
      const chatContainer = document.querySelector(".reply-chat");
  
      document.querySelectorAll('.block-message').forEach(el => el.remove());
  
      if (data.isBlockedByRecipient) {
        messageInput?.classList.add("d-none");
  
        const notice = document.createElement("div");
        notice.classList.add('block-message');
        notice.innerHTML =
          "<i class='fa fa-ban'></i> You are blocked by this user. You cannot send messages.";
  
        chatContainer?.append(notice);
        return true; 
      }
  
      if (data.hasBlockedRecipient) {
        messageInput?.classList.add("d-none");
  
        const notice = document.createElement("div");
        notice.classList.add('block-message');
        notice.innerHTML = "<i class='fa fa-lock'></i> You've blocked this user. Unblock them to continue the conversation.";
  
        chatContainer?.append(notice);
        return true;
      }
  
      messageInput?.classList.remove("d-none");
      return false;
    } catch (err) {
      showNotification(err.message || 'Something Went Wrong.','danger');
    }
}
  
async function checkIfFriend(recipientId) {
    try {
        const response = await fetch(`/user/check-friend/${recipientId}`);
        const data = await response.json();

        const messageInput = document.querySelector(".message-input");
        const chatContainer = document.querySelector(".reply-chat");

        document.querySelectorAll('.friend-alert').forEach(el => el.remove());

        const statusConfig = {
        not_friends: {
            icon: "fa-user-times",
            text: "You are not friends. Send a friend request to start chatting."
        },
        pending: {
            icon: "fa-hourglass-half",
            text: "Friend request pending. Wait until it's accepted."
        },
        rejected: {
            icon: "fa-times-circle",
            text: "Friend request was rejected."
        },
        blocked: {
            icon: "fa-ban",
            text: "Friendship blocked. You cannot chat with this user."
        }
        };

        if (data.status === "accepted") {
            messageInput?.classList.remove("d-none");
        } else if (statusConfig[data.status]) {
            messageInput?.classList.add("d-none");

            const { icon, text } = statusConfig[data.status];
            const notice = document.createElement("div");
            notice.classList.add("friend-alert");
            notice.innerHTML = `<i class='fa ${icon}'></i> ${text}`;

            chatContainer?.append(notice);
        }
    } catch (err) {
        showNotification(err.message || 'Something Went Wrong.','danger');
    }
}  
  
function loadChat(recipientId, el) {
    window.location.hash = `#${recipientId}`;
    recipientId = recipientId.toString();
    
    setTimeout(() => {
        window.chatSearchManager = new ChatSearchManager();
        activeChat();
    }, 500);

    // Save current chat position before switching
    if (chatState.recipientIdGlobal && chatState.recipientIdGlobal !== recipientId) {
        saveCurrentChatPosition();
    }

    // Comprehensive loading state reset
    LoadingStateManager.resetLoadingStateForAllChats();

    // Specifically reset the new chat's loading state
    LoadingStateManager.resetChatLoadingState(recipientId);

    const cachedEntry = window.cacheManager.get(recipientId);
    const chatting = document.querySelector('#chatting');

    const previousRecipientId = chatState.recipientIdGlobal;
    chatState.recipientIdGlobal = recipientId;

    document.querySelectorAll('.contact-chat-item, .chat-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');

    const blankElement = document.getElementById('blank');
    const chattingElement = document.getElementById('chatting');
    const messageInput = document.querySelector('.reply-chat');

    if (blankElement) blankElement.classList.remove('active');
    if (chattingElement) chattingElement.classList.add('active');
    if (messageInput) messageInput.classList.remove('d-none');

    if (cachedEntry && cachedEntry.htmlContent) {
        chatting.innerHTML = cachedEntry.htmlContent;

        chatState.currentOffset = cachedEntry.currentOffset;
        chatState.totalLoadedMessages = cachedEntry.messageCount;
        chatState.hasMoreMessages = cachedEntry.hasMoreMessages;
        chatState.allMessagesLoaded = cachedEntry.allMessagesLoaded;
        chatState.conversationType = cachedEntry.conversationType;
        chatState.loadingOlderMessages = false;

        const existingLinks = chatting.querySelectorAll('.older-messages-link');
        existingLinks.forEach(link => resetOlderMessagesLink(link));

        if (cachedEntry.allMessagesLoaded || !cachedEntry.hasMoreMessages) {
            existingLinks.forEach(link => {
                link.remove();
            });
        } else {
            addOlderMessagesLink(chatting);
        }

        setupScrollPositionTracking(chatting, recipientId);

        restoreScrollPosition(chatting, recipientId);

        initializeChatOption();

        checkIfBlocked(recipientId).then(isBlocked => {
            if (!isBlocked) {
              checkIfFriend(recipientId);
            }
        });

        return;
    }

    chatState.currentOffset = 0;
    chatState.loadingOlderMessages = false;
    chatState.allMessagesLoaded = false;
    chatState.hasMoreMessages = false;
    chatState.totalLoadedMessages = 0;
    chatState.conversationType = 'default';

    const requestData = performanceMonitor.startRequest();
    const initialBatchSize = CHAT_CONFIG.batchSizes.initial;

    fetch(`/messages/${recipientId}?offset=${chatState.currentOffset}&limit=${initialBatchSize}`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    })
    .then(html => {
        if (chatState.recipientIdGlobal !== recipientId) return;

        chatting.innerHTML = html;

        chatState.conversationType = analyzeConversationType(chatting);

        const messageCount = countActualMessages(chatting);
        chatState.totalLoadedMessages = messageCount;
        chatState.hasMoreMessages = messageCount >= initialBatchSize;

        if (messageCount >= initialBatchSize) {
            chatState.hasMoreMessages = true;
        } else {
            chatState.hasMoreMessages = false;
            chatState.allMessagesLoaded = true;
        }

        const cacheEntry = new ChatCacheEntry(recipientId);
        cacheEntry.updateContent(
            html,
            messageCount,
            chatState.currentOffset,
            chatState.hasMoreMessages,
            chatState.allMessagesLoaded,
            chatState.conversationType
        );
        window.cacheManager.set(recipientId, cacheEntry);

        performanceMonitor.endRequest(requestData, messageCount);

        if (chatState.hasMoreMessages && !chatState.allMessagesLoaded) {
            addOlderMessagesLink(chatting);
        }

        setupScrollPositionTracking(chatting, recipientId);
        scrollToBottom(chatting);

        initializeChatOption();

        checkIfBlocked(recipientId).then(isBlocked => {
            if (!isBlocked) {
              checkIfFriend(recipientId);
            }
        });
    })
    .catch(err => {
        if(err.message === 'HTTP 404'){
            fetch("/404")
            .then(res => res.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                document.body.innerHTML = doc.body.innerHTML;
            })
            .catch(err => {
                console.error("Failed to load 404 page:", err);
                document.body.innerHTML = "<h1>404 Chat Not Found</h1>";
            });
            return;
        }
        
        showNotification(err.message || 'Something Went Wrong.','danger');
        performanceMonitor.endRequest(requestData, 0);
    });
}

function loadOlderMessagesManually(container) {
    if (chatState.loadingOlderMessages || chatState.allMessagesLoaded) return;

    if (!chatState.recipientIdGlobal) return;

    if (LoadingStateManager.isLoading(chatState.recipientIdGlobal)) return;

    LoadingStateManager.setLoading(chatState.recipientIdGlobal, true);

    saveCurrentChatPosition();

    if (chatState.totalLoadedMessages > CHAT_CONFIG.cleanupThreshold) {
        cleanupOldMessages();
    }

    chatState.loadingOlderMessages = true;
    const optimalBatchSize = performanceMonitor.getOptimalBatchSize();
    const nextOffset = chatState.currentOffset + optimalBatchSize;

    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;
    const oldClientHeight = container.clientHeight;
    const oldScrollBottom = oldScrollHeight - oldScrollTop - oldClientHeight;

    const requestData = performanceMonitor.startRequest();
    const currentRecipientId = chatState.recipientIdGlobal;

    fetch(`/messages/${currentRecipientId}?offset=${nextOffset}&limit=${optimalBatchSize}&scroll=1`)
    .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    })
    .then(html => {
        if (chatState.recipientIdGlobal !== currentRecipientId) {
            chatState.loadingOlderMessages = false;
            LoadingStateManager.setLoading(currentRecipientId, false);
            performanceMonitor.endRequest(requestData, 0);
            return;
        }

        if (!html || html.trim() === '') {
            chatState.allMessagesLoaded = true;
            chatState.hasMoreMessages = false;
            chatState.loadingOlderMessages = false;
            LoadingStateManager.setLoading(currentRecipientId, false);

            const link = container.querySelector('.older-messages-link');
            if (link) {
                link.remove();
            }

            const cachedEntry = window.cacheManager.get(currentRecipientId);
            if (cachedEntry) {
                cachedEntry.allMessagesLoaded = true;
                cachedEntry.hasMoreMessages = false;
                cachedEntry.updateContent(
                    container.innerHTML,
                    chatState.totalLoadedMessages,
                    chatState.currentOffset,
                    false,
                    true,
                    chatState.conversationType
                );
            }

            performanceMonitor.endRequest(requestData, 0);
            return;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html.trim();

        const newMessageCount = countActualMessages(tempDiv);

        const newConversationType = analyzeConversationType(tempDiv);
        if (newConversationType !== 'default') {
            chatState.conversationType = newConversationType;
        }

        if (newMessageCount < optimalBatchSize) {
            chatState.allMessagesLoaded = true;
            chatState.hasMoreMessages = false;
        }

        const chatUl = container.querySelector('.chatappend');
        if (!chatUl) {
            chatState.loadingOlderMessages = false;
            LoadingStateManager.setLoading(currentRecipientId, false);
            performanceMonitor.endRequest(requestData, 0);
            return;
        }

        const newMessageGroups = Array.from(tempDiv.children);

        if (newMessageGroups.length === 0) {
            chatState.allMessagesLoaded = true;
            chatState.hasMoreMessages = false;

            const link = container.querySelector('.older-messages-link');
            if (link) {
                link.remove();
            }
        } else {
            const link = chatUl.querySelector('.older-messages-link');

            if (link) {
                const fragment = document.createDocumentFragment();

                newMessageGroups.sort((a, b) => {
                    const timestampA = a.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');
                    const timestampB = b.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');

                    if (timestampA && timestampB) {
                        return parseInt(timestampA) - parseInt(timestampB);
                    }
                    return 0;
                });

                newMessageGroups.forEach(group => {
                    fragment.appendChild(group);
                });

                if (link.nextSibling) {
                    chatUl.insertBefore(fragment, link.nextSibling);
                } else {
                    chatUl.appendChild(fragment);
                }
            } else {
                const fragment = document.createDocumentFragment();

                newMessageGroups.sort((a, b) => {
                    const timestampA = a.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');
                    const timestampB = b.querySelector('[data-timestamp]')?.getAttribute('data-timestamp');

                    if (timestampA && timestampB) {
                        return parseInt(timestampA) - parseInt(timestampB);
                    }
                    return 0;
                });

                newMessageGroups.forEach(group => {
                    fragment.appendChild(group);
                });

                chatUl.insertBefore(fragment, chatUl.firstChild);
            }

            chatState.currentOffset = nextOffset;
            chatState.totalLoadedMessages += newMessageCount;

        }

        const cachedEntry = window.cacheManager.get(currentRecipientId);
        if (cachedEntry) {
            cachedEntry.updateContent(
                container.innerHTML,
                chatState.totalLoadedMessages,
                chatState.currentOffset,
                chatState.hasMoreMessages,
                chatState.allMessagesLoaded,
                chatState.conversationType
            );
        }

        performanceMonitor.endRequest(requestData, newMessageCount);

        const link = container.querySelector('.older-messages-link');
        if (chatState.allMessagesLoaded || !chatState.hasMoreMessages) {
            if (link) {
                link.remove();
            }
        } else if (link) {
            resetOlderMessagesLink(link);
        } else if (chatState.hasMoreMessages) {
            addOlderMessagesLink(container);
        }

        chatState.loadingOlderMessages = false;
        LoadingStateManager.setLoading(currentRecipientId, false);
    })
    .catch(err => {
        showNotification(err.message || 'Something Went Wrong.','danger');
        performanceMonitor.endRequest(requestData, 0);

        const link = container.querySelector('.older-messages-link');
        if (link) {
            setOlderMessagesLinkError(link);
        }

        chatState.loadingOlderMessages = false;
        LoadingStateManager.setLoading(currentRecipientId, false);
    });
}

function resetOlderMessagesLink(link) {
    const linkText = link.querySelector('a');
    const iconContainer = linkText?.querySelector('.loading-icon');
    const textSpan = linkText?.querySelector('.link-text');

    if (iconContainer) iconContainer.style.display = 'none';
    if (linkText) {
        linkText.style.color = CHAT_CONFIG.colors.primary;
        linkText.style.cursor = 'pointer';
        linkText.style.backgroundColor = 'transparent';
    }
    if (textSpan) {
        const newBatchSize = performanceMonitor.getOptimalBatchSize();
        textSpan.textContent = `Load ${newBatchSize} earlier messages`;
    }
}

function setOlderMessagesLinkError(link) {
    const linkText = link.querySelector('a');
    const iconContainer = linkText?.querySelector('.loading-icon');
    const textSpan = linkText?.querySelector('.link-text');

    if (iconContainer) iconContainer.style.display = 'none';
    if (linkText) {
        linkText.style.color = '#d93025';
        linkText.style.cursor = 'pointer';
        linkText.style.backgroundColor = 'transparent';
    }
    if (textSpan) {
        textSpan.textContent = 'Failed to load. Click to retry';
    }
}

function initializeChatOption() {
    const chatFriendToggle = document.querySelector('.chat-friend-toggle');
    const chatFriendContent = document.querySelector('.chat-frind-content');

    chatFriendToggle?.addEventListener('click', function (e) {
        if (chatFriendContent.style.display === 'block') {
            chatFriendContent.style.display = 'none';
        } else {
            chatFriendContent.style.display = 'block';
        }

        e.stopPropagation();
    });

    // Close the menu when clicking anywhere else on the document
    document.addEventListener('click', function (e) {
        const isClickInModal = e.target.closest('.modal');
        if (!isClickInModal && chatFriendContent) {
            chatFriendContent.style.display = 'none';
        }
    });

    chatFriendContent?.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    document.querySelectorAll('.chat-action-btn').forEach(btn => {
        btn.addEventListener('click', handleChatAction);
    });
}

let currentActionData = null;

// Function to show confirmation modal
async function showChatActionConfirmation(message) {
    return new Promise((resolve) => {
        const modal = new bootstrap.Modal(document.getElementById('chatActionConfirmModal'));
        const modalBody = document.getElementById('chatActionConfirmModalBody');
        const proceedBtn = document.getElementById('chatActionConfirmModalProceed');

        modalBody.textContent = message;

        proceedBtn.replaceWith(proceedBtn.cloneNode(true));
        const newProceedBtn = document.getElementById('chatActionConfirmModalProceed');

        newProceedBtn.onclick = async () => {
            const originalBtnHTML = newProceedBtn.innerHTML;
        
            newProceedBtn.disabled = true;
            newProceedBtn.innerHTML = `${originalBtnHTML}
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            `;
        
            await new Promise((r) => setTimeout(r, 50));
        
            try {
                modal.hide();
                resolve(true);
            } catch (error) {
                showNotification(error.message || 'Something Went Wrong.','danger');
                resolve(false);
            } finally {
                newProceedBtn.disabled = false;
                newProceedBtn.innerHTML = originalBtnHTML;
            }
        };        

        const modalElement = document.getElementById('chatActionConfirmModal');
        const handleHide = () => {
            modalElement.removeEventListener('hidden.bs.modal', handleHide);
            resolve(false);
        };

        modalElement.addEventListener('hidden.bs.modal', handleHide);
        modal.show();
    });
}

// Handle chat action button clicks
async function handleChatAction(event) {
    event.preventDefault();

    const btn = event.currentTarget;
    const action = btn.dataset.action;
    const targetId = btn.dataset.targetId;
    const targetType = btn.dataset.targetType;

    try {
        let endpoint = '';
        let payload = { targetId: parseInt(targetId), targetType };
        let confirmMessage = '';

        switch (action) {
            case 'favorite':
            case 'unfavorite':
                endpoint = '/favorite';
                break;
            case 'archive':
            case 'unarchive':
                endpoint = '/archive';
                break;
            case 'delete':
                endpoint = '/delete';
                confirmMessage = 'Are you sure you want to delete this chat? This action cannot be undone.';
                break;
            case 'block':
            case 'unblock':
                endpoint = '/block';
                confirmMessage = action === 'block'
                    ? 'Are you sure you want to block this user?'
                    : 'Are you sure you want to unblock this user? They will be able to contact you again.';
                break;
            case 'unfriend':
                endpoint = '/unfriend';
                confirmMessage = 'Are you sure you dont want to be friends? This action cannot be undone.';
                break;
        }

        if (confirmMessage) {
            const userConfirmed = await showChatActionConfirmation(confirmMessage);
            if (!userConfirmed) {
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
                return;
            }
        }

        if(action === 'archive' && systemSetting.allow_archive_chat !== 'true'){
            showNotification('You are not allowed to archive Chat','danger');
            return;
        }

        if(action === 'block' && systemSetting.allow_user_block !== 'true'){
            showNotification('You are not allowed to block the user','danger');
            return;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            
            updateChatActionUI(btn, action, data);

            if (action === 'favorite' || action === 'unfavorite') {
                if (window.favoriteLoader) {
                    window.favoriteLoader.refresh();
                }
            }

            if (action === 'archive' || action === 'unarchive') {
                if (window.archiveChatLoader) {
                    window.archiveChatLoader.refresh();
                }
                if (window.chatLoader) {
                    window.chatLoader.refresh();
                }
            }
            
            if (action === 'block' || action === 'unblock') {
                if (window.blockedContactsLoader) {
                    window.blockedContactsLoader.refresh();
                }
                if (window.chatLoader) {
                    window.chatLoader.refresh();
                }
                if(window.contactLoader){
                    window.contactLoader.refresh();
                }
                window.cacheManager.clear(targetId.toString());

                if (action === 'block') {
                    document.querySelector('#blank').classList.add('active');
                    document.querySelector('#chatting').classList.remove('active');
                    document.querySelector('.reply-chat').classList.add('d-none');
                    window.history.replaceState(null, "", "/messenger");
                }
            }

            if (action === 'delete') {
                if (window.chatLoader) window.chatLoader.refresh();
                document.querySelector('#blank').classList.add('active');
                document.querySelector('#chatting').classList.remove('active');
                document.querySelector('.reply-chat').classList.add('d-none');
                window.history.replaceState(null, "", "/messenger");
                window.cacheManager.clear(targetId.toString());
            }

            if (action === 'unfriend') {
                window.chatLoader.refresh();
                window.contactLoader.refresh();
                window.friendsLoader.refresh();
                window.favoriteLoader.refresh();
                window.archiveChatLoader.refresh();
                document.querySelector('#blank').classList.add('active');
                document.querySelector('#chatting').classList.remove('active');
                document.querySelector('.reply-chat').classList.add('d-none');
                window.history.replaceState(null, "", "/messenger");
            }
        } else {
            const error = await response.json();
            showNotification(error.message || 'Something Went Wrong.','danger');
        }
    } catch (error) {
        showNotification(error.message || 'Something Went Wrong.','danger');
    } finally {
        handleMessageUi(targetId);
    }
}

// Update UI based on action result
function updateChatActionUI(btn, action, responseData) {
    const iconSpan = btn.querySelector('.icon-btn');
    const textElement = btn.querySelector('h5');

    switch (action) {
        case 'favorite':
            btn.dataset.action = 'unfavorite';
            iconSpan.className = 'icon-btn btn-outline-danger button-effect btn-sm favorite-icon';

            iconSpan.innerHTML = '<i data-feather="heart"></i>';
            textElement.textContent = 'Unfavourite';

            if (typeof feather !== 'undefined') {
                feather.replace();
                const heartSvg = iconSpan.querySelector('svg');
                if (heartSvg) {
                    heartSvg.style.fill = '#ff0000';
                    heartSvg.style.color = '#ff0000';
                }
            }
            break;

        case 'unfavorite':
            btn.dataset.action = 'favorite';
            iconSpan.className = 'icon-btn btn-outline-primary button-effect btn-sm favorite-icon';

            iconSpan.innerHTML = '<i data-feather="heart"></i>';
            textElement.textContent = 'Favourite';

            if (typeof feather !== 'undefined') {
                feather.replace();
                const heartSvg = iconSpan.querySelector('svg');
                if (heartSvg) {
                    heartSvg.style.fill = 'none';
                    heartSvg.style.color = '';
                }
            }
            break;

        case 'archive':
            btn.dataset.action = 'unarchive';
            iconSpan.className = 'icon-btn btn-outline-warning button-effect btn-sm archive-icon';

            iconSpan.innerHTML = '<i data-feather="archive"></i>';
            textElement.textContent = 'Unarchive';
            break;

        case 'unarchive':
            btn.dataset.action = 'archive';
            iconSpan.className = 'icon-btn btn-outline-success button-effect btn-sm archive-icon';

            iconSpan.innerHTML = '<i data-feather="plus-circle"></i>';
            textElement.textContent = 'Archive';
            break;

        case 'block':
            btn.dataset.action = 'unblock';
            iconSpan.className = 'icon-btn btn-outline-success button-effect btn-sm block-icon';

            iconSpan.innerHTML = '<i data-feather="check-circle"></i>';
            textElement.textContent = 'Unblock';
            break;

        case 'unblock':
            btn.dataset.action = 'block';
            iconSpan.className = 'icon-btn btn-outline-light button-effect btn-sm block-icon';

            iconSpan.innerHTML = '<i data-feather="slash"></i>';
            textElement.textContent = 'Block';
            break;
    }

}

// Initialize chat options based on current state
function initializeChatActionStates(userState) {
    const chatActionBtns = document.querySelectorAll('.chat-action-btn');

    chatActionBtns.forEach(btn => {
        const action = btn.dataset.action;
        const iconSpan = btn.querySelector('.icon-btn');
        const textElement = btn.querySelector('h5');
        const icon = iconSpan.querySelector('i');

        switch (action) {
            case 'favorite':
                if (userState.isFavorite) {
                    btn.dataset.action = 'unfavorite';
                    iconSpan.className = 'icon-btn btn-outline-warning button-effect btn-sm favorite-icon';
                    icon.style.fill = '#ffc107';
                    textElement.textContent = 'Unfavourite';
                }
                break;

            case 'archive':
                if (userState.isArchived) {
                    btn.dataset.action = 'unarchive';
                    iconSpan.className = 'icon-btn btn-outline-warning button-effect btn-sm archive-icon';
                    icon.setAttribute('data-feather', 'archive');
                    textElement.textContent = 'Unarchive';
                }
                break;

            case 'block':
                if (userState.isBlocked) {
                    btn.dataset.action = 'unblock';
                    iconSpan.className = 'icon-btn btn-outline-success button-effect btn-sm block-icon';
                    icon.setAttribute('data-feather', 'check-circle');
                    textElement.textContent = 'Unblock';
                }
                break;
        }
    });

}

// Performance Monitoring Class
class ChatPerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: [],
            renderTimes: [],
            memoryUsage: []
        };
    }

    startRequest() {
        return {
            startTime: performance.now(),
            startMemory: this.getMemoryUsage()
        };
    }

    endRequest(requestData, messagesLoaded = 0) {
        const endTime = performance.now();
        const responseTime = endTime - requestData.startTime;

        this.metrics.requests.push({
            responseTime,
            messagesLoaded,
            timestamp: Date.now(),
            memoryDelta: this.getMemoryUsage() - requestData.startMemory
        });

        chatState.performanceMetrics.totalRequests++;
        chatState.performanceMetrics.averageResponseTime =
            (chatState.performanceMetrics.averageResponseTime * (chatState.performanceMetrics.totalRequests - 1) + responseTime)
            / chatState.performanceMetrics.totalRequests;

        if (responseTime > CHAT_CONFIG.performance.slowConnectionThreshold) {
            chatState.performanceMetrics.slowRequestCount++;
            this.updateConnectionSpeed();
        }
        return responseTime;
    }

    getMemoryUsage() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize;
        }
        return 0;
    }

    updateConnectionSpeed() {
        const slowRatio = chatState.performanceMetrics.slowRequestCount / chatState.performanceMetrics.totalRequests;

        if (slowRatio > 0.3) {
            chatState.connectionSpeed = 'slow';
        } else if (chatState.performanceMetrics.averageResponseTime < 100) {
            chatState.connectionSpeed = 'fast';
        } else {
            chatState.connectionSpeed = 'normal';
        }
    }

    getOptimalBatchSize() {
        const baseSize = CHAT_CONFIG.batchSizes.subsequent;

        let speedMultiplier = 1;
        switch (chatState.connectionSpeed) {
            case 'fast': speedMultiplier = 1.2; break;
            case 'slow': speedMultiplier = 0.7; break;
            default: speedMultiplier = 1;
        }

        let typeSize;
        switch (chatState.conversationType) {
            case 'media-heavy': typeSize = CHAT_CONFIG.batchSizes.mediaHeavy; break;
            case 'text-only': typeSize = CHAT_CONFIG.batchSizes.textOnly; break;
            case 'group-chat': typeSize = CHAT_CONFIG.batchSizes.groupChat; break;
            default: typeSize = baseSize;
        }

        let loadAdjustment = 1;
        if (chatState.totalLoadedMessages > 100) {
            loadAdjustment = 0.8;
            typeSize = CHAT_CONFIG.batchSizes.older;
        }

        return Math.max(5, Math.floor(typeSize * speedMultiplier * loadAdjustment));
    }
}

// Initialize performance monitor
const performanceMonitor = new ChatPerformanceMonitor();

// Content Analysis Functions
function analyzeConversationType(container) {
    const messages = container.querySelectorAll('.msg-setting-main');
    let mediaCount = 0;
    let totalMessages = messages.length;

    messages.forEach(msg => {
        const mediaElements = msg.querySelectorAll(CHAT_CONFIG.contentAnalysis.mediaSelectors.join(','));
        mediaCount += mediaElements.length;
    });

    const mediaRatio = mediaCount / Math.max(totalMessages, 1);

    if (mediaRatio > CHAT_CONFIG.contentAnalysis.heavyContentThreshold) {
        return 'media-heavy';
    } else if (mediaCount === 0) {
        return 'text-only';
    } else {
        const uniqueSenders = new Set();
        messages.forEach(msg => {
            const sender = msg.closest('li.sent, li.replies');
            if (sender) uniqueSenders.add(sender.className);
        });

        return uniqueSenders.size > 2 ? 'group-chat' : 'default';
    }
}

function countActualMessages(container) {
    return container.querySelectorAll('.msg-setting-main').length;
}

// Memory Management
function cleanupOldMessages() {
    const chatting = document.querySelector('#chatting');
    const chatUl = chatting?.querySelector('.chatappend');

    if (!chatUl || chatState.totalLoadedMessages <= CHAT_CONFIG.maxMessagesInMemory) {
        return;
    }

    const messageGroups = Array.from(chatUl.querySelectorAll('li.sent, li.replies'));
    const messagesToRemove = Math.floor(messageGroups.length * 0.3);

    for (let i = 0; i < messagesToRemove && messageGroups[i]; i++) {
        if (!messageGroups[i].classList.contains('older-messages-link')) {
            const messagesInGroup = messageGroups[i].querySelectorAll('.msg-setting-main').length;
            chatState.totalLoadedMessages -= messagesInGroup;
            messageGroups[i].remove();
        }
    }

    if (!chatUl.querySelector('.older-messages-link') && chatState.hasMoreMessages) {
        addOlderMessagesLink(chatting);
    }
}

function addOlderMessagesLink(container) {
    const existingLink = container.querySelector('.older-messages-link');
    if (existingLink) existingLink.remove();

    if (chatState.allMessagesLoaded || !chatState.hasMoreMessages) return;

    const chatUl = container.querySelector('.chatappend');
    if (!chatUl) return;

    if (!document.querySelector('#chat-spinner-styles')) {
        const style = document.createElement('style');
        style.id = 'chat-spinner-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .feather-loading {
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(style);
    }

    const linkContainer = document.createElement('li');
    linkContainer.className = 'older-messages-link';
    linkContainer.style.cssText = `
        text-align: center;
        background: ${CHAT_CONFIG.colors.background};
        border: none;
        position: relative;
        list-style: none;
        margin-top: 20px;
    `;

    const nextBatchSize = performanceMonitor.getOptimalBatchSize();

    const linkText = document.createElement('a');
    linkText.href = '#';
    linkText.style.cssText = `
        color: ${CHAT_CONFIG.colors.primary};
        text-decoration: none;
        font-size: 13px;
        font-weight: 400;
        cursor: pointer;
        transition: color 0.15s ease;
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        position: relative;
    `;

    const iconContainer = document.createElement('span');
    iconContainer.className = 'loading-icon';
    iconContainer.style.cssText = `
        display: none;
        margin-right: 6px;
        vertical-align: middle;
    `;

    iconContainer.innerHTML = `<i data-feather="loader" style="width: 14px; height: 14px; color: ${CHAT_CONFIG.colors.primary};" class="feather-loading"></i>`;

    const textSpan = document.createElement('span');
    textSpan.className = 'link-text';
    textSpan.textContent = `Load ${nextBatchSize} earlier messages`;

    linkText.appendChild(iconContainer);
    linkText.appendChild(textSpan);

    linkText.addEventListener('mouseenter', () => {
        if (!chatState.loadingOlderMessages && !LoadingStateManager.isLoading(chatState.recipientIdGlobal)) {
            linkText.style.color = CHAT_CONFIG.colors.primaryHover;
            linkText.style.backgroundColor = 'rgba(var(--primary-color), 0.08)';
        }
    });

    linkText.addEventListener('mouseleave', () => {
        if (!chatState.loadingOlderMessages && !LoadingStateManager.isLoading(chatState.recipientIdGlobal)) {
            linkText.style.color = CHAT_CONFIG.colors.primary;
            linkText.style.backgroundColor = 'transparent';
        }
    });

    linkText.addEventListener('click', (e) => {
        e.preventDefault();

        if (chatState.loadingOlderMessages ||
            chatState.allMessagesLoaded ||
            LoadingStateManager.isLoading(chatState.recipientIdGlobal)) {
            return;
        }

        iconContainer.style.display = 'inline-block';
        textSpan.textContent = 'Loading...';
        linkText.style.color = CHAT_CONFIG.colors.textLight;
        linkText.style.cursor = 'default';
        linkText.style.backgroundColor = 'transparent';

        loadOlderMessagesManually(container);
    });

    linkContainer.appendChild(linkText);
    chatUl.insertBefore(linkContainer, chatUl.firstChild);

}

window.addEventListener('beforeunload', () => {
    saveCurrentChatPosition();
    LoadingStateManager.clearAllLoading();
});

// Enhanced debug functions
window.getChatPerformanceStats = function () {
    return {
        state: chatState,
        config: CHAT_CONFIG,
        cache: window.cacheManager.getStats(),
        loadingStates: Object.fromEntries(chatState.chatLoadingStates),
        recommendations: {
            currentBatchSize: performanceMonitor.getOptimalBatchSize(),
            memoryUsage: performanceMonitor.getMemoryUsage(),
            shouldCleanup: chatState.totalLoadedMessages > CHAT_CONFIG.cleanupThreshold
        }
    };
};

window.getChatCache = function () {
    return {
        size: window.cacheManager.cache.size,
        entries: Array.from(window.cacheManager.cache.entries()).map(([id, entry]) => ({
            recipientId: id,
            messageCount: entry.messageCount,
            scrollPosition: entry.scrollPosition,
            lastUpdated: new Date(entry.lastUpdated).toLocaleString(),
            hasPosition: entry.isPositionSaved,
            hasMoreMessages: entry.hasMoreMessages,
            allMessagesLoaded: entry.allMessagesLoaded,
            conversationType: entry.conversationType
        }))
    };
};

window.clearChatCache = function (recipientId = null) {
    if (recipientId) {
        window.cacheManager.clear(recipientId);
    } else {
        window.cacheManager.cache.clear();
        LoadingStateManager.clearAllLoading();
    }
};

// Function to handle new message reception
function handleMessageUi(recipientId, message) {
    recipientId = recipientId.toString();
    
    if (recipientId === chatState.recipientIdGlobal) {
        const chatting = document.querySelector('#chatting');
        const chatUl = chatting?.querySelector('.chatappend');
        
        if (chatUl) {
            const cachedEntry = window.cacheManager.get(recipientId);
            if (cachedEntry) {
                cachedEntry.updateContent(
                    chatting.innerHTML,
                    chatState.totalLoadedMessages + 1,
                    chatState.currentOffset,
                    chatState.hasMoreMessages,
                    chatState.allMessagesLoaded,
                    chatState.conversationType
                );
            }
        }
    } else {
        window.cacheManager.clear(recipientId);
    }
}

window.resetChatLoadingStates = function () {
    LoadingStateManager.clearAllLoading();
    chatState.loadingOlderMessages = false;

    document.querySelectorAll('.older-messages-link').forEach(link => {
        resetOlderMessagesLink(link);
    });
};

// Function to check if a specific chat is loading
window.isChatLoading = function (recipientId) {
    return LoadingStateManager.isLoading(recipientId);
};

window.forceResetChatLoading = function (recipientId) {
    LoadingStateManager.resetChatLoadingState(recipientId);

    if (recipientId === chatState.recipientIdGlobal) {
        const container = document.querySelector('#chatting');
        const links = container?.querySelectorAll('.older-messages-link');
        links?.forEach(link => resetOlderMessagesLink(link));
    }
};

// ============= Chat Script with Position Persistence End ============== //