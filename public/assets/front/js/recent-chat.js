class ChatLoader {

    constructor(currentUserId) {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.currentUserId = currentUserId;

        this.elements = {
            chatList: document.getElementById('recent-chat-chat-list'),
            loadingIndicator: document.getElementById('recent-chat-chat-loading'),
            loadMoreContainer: document.getElementById('recent-chat-load-more-container'),
            loadMoreBtn: document.getElementById('recent-chat-load-more-btn'),
            emptyState: document.getElementById('recent-chat-empty-state'),
            errorState: document.getElementById('recent-chat-error-state'),
            retryBtn: document.getElementById('recent-chat-retry-btn')
        };

        this.init();
    }

    init() {
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
        this.elements.retryBtn.addEventListener('click', () => this.retry());

        this.loadChats(1, true);
        this.showLoading(true);
    }

    async loadChats(page = 1, isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/messenger/recent-chats?page=${page}&limit=20`);
            const data = await response.json();
            
            if (data.success) {
                this.renderChats(data.chats, isInitial);
                this.updatePagination(data.pagination);
                if (data.chats.length) {
                    this.showChatList();
                }
                const hash = window.location.hash;
                if (hash && hash.startsWith("#")) {
                    const recipientId = hash.substring(1);
                    document.querySelector(`.chat-item[data-user-id="${recipientId}"]`)?.classList.add("active");
                }
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showError(isInitial);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    renderChats(chats, isInitial = false) {
        if (isInitial) {
            this.elements.chatList.innerHTML = '';
        }

        if (chats.length === 0 && isInitial) {
            this.showEmptyState();

            return;
        }

        chats.forEach(message => {
            const chatItem = this.createChatItem(message);
            this.elements.chatList.appendChild(chatItem);
        });
    }

    createChatItem(message) {
        const isGroup = !!message.group_id;
        const isSentByMe = message.sender_id === +this.currentUserId;

        const avatar = isGroup
            ? (message.group.avatar)
            : (isSentByMe ? message.recipient.avatar : message.sender.avatar);

        const avatarAlpha = isSentByMe ? message.recipient.name : message.sender.name;

        const name = isGroup
            ? message.group.name
            : (isSentByMe ? message.recipient.name : message.sender.name);

        const email = isGroup
            ? ''
            : (isSentByMe ? message.recipient.email : message.sender.email);

        const targetId = isGroup
            ? message.group.id
            : (isSentByMe ? message.recipient.id : message.sender.id);

        const isOnline = isGroup
            ? false
            : (isSentByMe ? message.recipient.is_online : message.sender.is_online);

        let lastMsg = isGroup
            ? `${message?.sender?.name}: ${message?.content?.slice(0, 50)}`
            : message?.content ? message?.content?.slice(0, 50) : '';

        const isMuted = message.isMuted;

        let timestamp = new Date(message.created_at)
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
            .replace(/\./g, '')
            .toUpperCase();

        if (message.message_type === 'call') {
            const duration = message.metadata?.duration || 0;
            const callType = message.metadata?.call_type == 'audio' ? 'Audio' : 'Video' || 'Video';
            const isMissed = (duration === 0 && message.metadata?.action === 'ended' && message.recipient_id === +this.currentUserId);

            if (isMissed) {
                lastMsg = `Missed ${callType} Call`;
            } else if (message.recipient_id === +this.currentUserId) {
                lastMsg = `Incoming ${callType} Call`;
            } else {
                lastMsg = `Outgoing ${callType} Call`;
            }
        }

        const li = document.createElement('li');
        li.className = 'start-chat chat-item mobile-chat' + (message.isPinned ? ' pined' : '');
        li.setAttribute('data-message-id', message.id);
        li.setAttribute(`data-${isGroup ? 'group-id' : 'user-id'}`, targetId);
        li.setAttribute('data-name', name.toLowerCase());
        li.setAttribute('data-email', email?.toLowerCase() || '');

        li.onclick = () => {
            if (isGroup) {
                loadGroupChat(targetId, li);
            } else {
                loadChat(targetId, li);
            }
        };

        let messageClass = 'sent';
        if (message?.statuses && message.statuses.length && lastMsg != 'This message was cleared') {
            let messageStatus = message.statuses.find(mStatus => mStatus.user_id == message.recipient_id);
            if (messageStatus?.status == 'sent') {
                messageClass = 'sent';
            } else if (messageStatus?.status == 'delivered') {
                messageClass = 'deliver';
            } else if (messageStatus?.status == 'seen') {
                messageClass = 'deliver seen';
            }
        }

        if (message.metadata?.deleted_for?.includes(Number(this.currentUserId))) {
            lastMsg = 'This message is deleted';
        }

        li.innerHTML = `
            <div class="chat-box">
                <div class="profile bg-size">
                    <div class="profile ${isOnline ? 'online' : 'offline'}">
                        ${this.renderAvatar(avatar, avatarAlpha)}
                    </div>
                </div>
                <div class="details">
                    <h5 class="full-name">
                        ${name}
                        ${isMuted
                ? '<i data-feather="volume-x" class="mute-icon"></i>'
                : '<i data-feather="volume-x" class="mute-icon d-none"></i>'}
                    </h5>
                    <h6 class="typing-indicator d-none">Typing...</h6>
                    <h6 class="last-message ${lastMsg ? '' : 'd-none'}" id="last-message">${lastMsg}</h6>
                </div>
                <div class="date-status">
                    <i 
                        class="ti-pin2 ${message.isPinned ? 'pinned-icon' : 'pin-action'} 
                        ${!isSentByMe && message.unreadCount > 0 ? 'd-none' : ''}" 
                        title="${message.isPinned ? 'Pinned' : 'Pin chat'}">
                    </i>
                    <h6 class="timestamp">${timestamp}</h6>
                    <p class="message-status ${messageClass} ${!isSentByMe || (!isSentByMe && message.unreadCount > 0) ? 'd-none' : ''}  ${lastMsg != 'This message was cleared' && lastMsg != 'This message is deleted' ? '' : 'd-none'}">
                        <i class="ti-check"></i>
                    </p>
                    <div class="badge badge-primary sm ${!isSentByMe && message.unreadCount > 0 ? '' : 'd-none'}">
                        ${message.unreadCount > 99 ? '99+' : message.unreadCount}
                    </div>
                </div>
            </div>
        `;

        const pinIcon = li.querySelector('.pinned-icon, .pin-action');
        if (pinIcon) {
            pinIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = isGroup ? 'group' : 'user';
                const targetIdForApi = isGroup
                    ? message.group.id
                    : (isSentByMe ? message.recipient.id : message.sender.id);

                fetch(`/chat/${message.isPinned ? 'unpin' : 'pin'}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, targetId: targetIdForApi })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        this.refresh();
                    }
                });
            });
        }

        return li;
    }

    renderAvatar(avatar, name) {
        if (avatar) {
            return `<img src="${avatar}" alt="${name}" class="img-fluid">`;
        } else {
            const initial = name.charAt(0).toUpperCase();
            return `<div class="avatar-circle"><span class="initial">${initial}</span></div>`;
        }
    }

    loadMore() {
        this.currentPage++;
        this.loadChats(this.currentPage, false);
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadChats(1, true);
    }

    updatePagination(pagination) {
        this.hasMore = pagination.hasMore;
        this.currentPage = pagination.currentPage;

        if (this.hasMore && pagination.totalCount > 0) {
            this.elements.loadMoreContainer.style.display = 'block';
        } else {
            this.elements.loadMoreContainer.style.display = 'none';
        }
    }

    showLoading(isInitial) {
        if (isInitial) {
            this.elements.loadingIndicator.style.display = 'flex';
            this.elements.chatList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showChatList() {
        this.elements.chatList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.chatList.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.chatList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
        }
    }

    // Method to refresh chats
    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadChats(1, true);
    }

    addNewChat(message) {
        const chatItem = this.createChatItem(message);
        this.elements.chatList.insertBefore(chatItem, this.elements.chatList.firstChild);

        if (this.elements.emptyState.style.display !== 'none') {
            this.showChatList();
        }
    }

    updateUnreadCount(targetId, isGroup, count) {
        const selector = isGroup ? `[data-group-id="${targetId}"]` : `[data-user-id="${targetId}"]`;
        const chatItem = this.elements.chatList.querySelector(selector);

        if (chatItem) {
            const badge = chatItem.querySelector('.badge');
            if (count > 0) {
                badge.classList.remove('d-none');
                badge.textContent = count > 99 ? '99+' : count;
            } else {
                badge.classList.add('d-none');
            }
        }
    }
}