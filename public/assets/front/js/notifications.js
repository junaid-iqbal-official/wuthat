'use strict';
class NotificationLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;

        this.elements = {
            notificationsList: document.getElementById('notifications-list'),
            mainNotificationsList: document.getElementById('main-notifications-list'),
            loadingIndicator: document.getElementById('notifications-loading'),
            loadMoreContainer: document.getElementById('notifications-load-more-container'),
            loadMoreBtn: document.getElementById('notifications-load-more-btn'),
            emptyState: document.getElementById('notifications-empty-state'),
            errorState: document.getElementById('notifications-error-state'),
            retryBtn: document.getElementById('notifications-retry-btn'),
            markAllReadBtn: document.querySelector('.mark-all-read')
        };

        this.init();
    }

    init() {
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
        this.elements.retryBtn.addEventListener('click', () => this.retry());
        this.elements.markAllReadBtn.addEventListener('click', () => this.markAllAsRead());

        this.setupDeleteNotificationModal();
        this.loadNotifications(1, true);
        this.showLoading(true);

        if (window.socket) {
            window.socket.on('new_notification', (notification) => {
                this.addNewNotification(notification);
            });
        }
    }

    setupDeleteNotificationModal() {
        const confirmDeleteBtn = document.getElementById('confirm-delete');
        const modalEl = document.getElementById('delete-notification');
    
        confirmDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
    
            const loader = window.notificationLoader;
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
    
            if (!loader || !loader._pendingDelete) {
                modalInstance?.hide();
                return;
            }
    
            const { notificationId, buttonElement } = loader._pendingDelete;
    
            confirmDeleteBtn.disabled = true;
            const originalHtml = confirmDeleteBtn.innerHTML;
            confirmDeleteBtn.innerHTML = `
                Delete
                <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            `;
    
            try {
                const response = await fetch(`/notification/${notificationId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
    
                if (data.success) {
                    const notificationItem = buttonElement.closest('.notification-item');
                    notificationItem.style.transition = 'all 0.3s ease';
                    notificationItem.style.opacity = '0';
                    notificationItem.style.transform = 'translateX(-100%)';
    
                    setTimeout(() => {
                        notificationItem.remove();
                        if (loader.elements.notificationsList.children.length === 0) {
                            loader.showEmptyState();
                        }
                    }, 300);
    
                    modalInstance.hide();
                } else {
                    throw new Error(data.message || 'Failed to delete');
                }
            } catch (error) {
                showNotification(err.message || "Something Went Wrong", "danger");
            } finally {
                confirmDeleteBtn.innerHTML = originalHtml;
                confirmDeleteBtn.disabled = false;
                delete loader._pendingDelete;
            }
        });
    }

    async loadNotifications(page = 1, isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/notification?page=${page}&limit=20`);
            const data = await response.json();

            if (data.success) {
                this.renderNotifications(data.notifications, isInitial);
                this.updatePagination(data.pagination);
                
                if (data.notifications.length > 0) {
                    this.showNotificationsList();
                } else if (isInitial) {
                    this.showEmptyState();
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

    renderNotifications(notifications, isInitial = false) {
        if (isInitial) {
            this.elements.notificationsList.innerHTML = '';
        }

        notifications.forEach(notification => {
            const notificationItem = this.createNotificationItem(notification);
            this.elements.notificationsList.appendChild(notificationItem);
        });
    }

    createNotificationItem(notification) {
        const li = document.createElement('li');
        li.className = `notification-item ${!notification.is_read ? 'unread' : ''}`;
        li.setAttribute('data-notification-id', notification.id);

        const fromUser = notification.from_user;
        const timeAgo = this.formatTimeAgo(notification.created_at);

        li.innerHTML = `
                <div class="chat-box notification ${!notification.is_read ? 'unread-notification' : ''}">
                    <div class="profile">
                        ${this.renderAvatar(fromUser?.avatar, fromUser?.name || 'System')}
                    </div>
                    <div class="details">
                        <span class="notification-from">${fromUser?.name || 'System'}</span>
                        <h5 class="notification-title">${notification.title}</h5>
                        <p class="notification-message ${notification.type === 'friend_rejected' ? 'text-danger' : ''}">${notification.message}</p>
                        ${this.renderNotificationActions(notification)}
                    </div>
                    <div class="date-status">
                        <h6>${timeAgo}</h6>
                        ${!notification.is_read ? '<span class="unread-dot"></span>' : ''}
                        <div class="notification-actions">
                            <button class="btn btn-outline-danger delete-btn ml-1" 
                                    onclick="notificationLoader.deleteNotification(${notification.id}, this)"
                                    title="Delete">
                                <i data-feather="trash-2"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

        li.addEventListener('click', () => {
            if (!notification.is_read) {
                this.markAsRead(notification.id, li);
            }
        });

        return li;
    }

    renderAvatar(avatar, name) {
        if (avatar) {
            return `<img class="bg-img" src="${avatar}" alt="${name}" />`;
        } else {
            const initial = name.charAt(0).toUpperCase();
            return `<div class="avatar-circle"><span class="initial">${initial}</span></div>`;
        }
    }

    renderNotificationActions(notification) {
        if (notification.type === 'friend_request') {
            return `
                    <div class="notification-action-buttons mt-2">
                        <button class="btn btn-success mr-2 accept-friend-btn" 
                                onclick="notificationLoader.respondToFriendRequest(${notification.data.friend_id}, 'accept', this)">
                            Accept
                        </button>
                        <button class="btn btn-outline-danger reject-friend-btn" 
                                onclick="notificationLoader.respondToFriendRequest(${notification.data.friend_id}, 'reject', this)">
                            Reject
                        </button>
                    </div>
                `;
        }
        return '';
    }

    async respondToFriendRequest(friendId, action, buttonElement) {
        if (buttonElement.disabled) return;

        const actionButtons = buttonElement.parentElement;
        const acceptBtn = actionButtons.querySelector('.accept-friend-btn');
        const rejectBtn = actionButtons.querySelector('.reject-friend-btn');

        acceptBtn.disabled = true;
        rejectBtn.disabled = true;

        try {
            const notificationItem = buttonElement.closest('.notification-item');
            const notificationId = notificationItem.getAttribute('data-notification-id');

            const response = await fetch('/friend/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requestId: friendId,
                    action: action
                })
            });

            const data = await response.json();

            if (data.success) {
                const statusText = action === 'accept' ? 'Friend request accepted' : 'Friend request rejected';
                actionButtons.innerHTML = `<span class="text-${action === 'accept' ? 'success' : 'danger'}">${statusText}</span>`;

                this.markAsRead(notificationId, notificationItem, false);

                if (action === 'accept' && window.chatLoader) {
                    window.chatLoader.refresh();
                }
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || "Something Went Wrong", "danger");

            acceptBtn.disabled = false;
            rejectBtn.disabled = false;
        }
    }

    async markAsRead(notificationId, element, showMessage = true) {
        try {
            const response = await fetch(`/notification/${notificationId}/read`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                const notificationItem = element.closest ? element.closest('.notification-item') : element;
                notificationItem.classList.remove('unread');

                const chatBox = notificationItem.querySelector('.chat-box');
                chatBox.classList.remove('unread-notification');

                const unreadDot = notificationItem.querySelector('.unread-dot');
                if (unreadDot) unreadDot.remove();

                const markReadBtn = notificationItem.querySelector('.mark-read-btn');
                if (markReadBtn) markReadBtn.style.display = 'none';


            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(error.message || "Something Went Wrong", "danger");
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/notification/mark-all-read', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                const unreadItems = this.elements.notificationsList.querySelectorAll('.notification-item.unread');
                unreadItems.forEach(item => {
                    item.classList.remove('unread');
                    const chatBox = item.querySelector('.chat-box');
                    chatBox.classList.remove('unread-notification');

                    const unreadDot = item.querySelector('.unread-dot');
                    if (unreadDot) unreadDot.remove();

                    const markReadBtn = item.querySelector('.mark-read-btn');
                    if (markReadBtn) markReadBtn.style.display = 'none';
                });

            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            showNotification(err.message || "Something Went Wrong", "danger");
        }
    }

    async deleteNotification(notificationId, buttonElement) {
        this._pendingDelete = { notificationId, buttonElement };

        const modalEl = document.getElementById('delete-notification');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    addNewNotification(notificationData) {
        const notificationItem = this.createNotificationItem(notificationData);
        this.elements.notificationsList.insertBefore(notificationItem, this.elements.notificationsList.firstChild);

        if (this.elements.emptyState.style.display !== 'none') {
            this.showNotificationsList();
        }

        notificationItem.style.opacity = '0';
        notificationItem.style.transform = 'translateX(100%)';

        setTimeout(() => {
            notificationItem.style.transition = 'all 0.3s ease';
            notificationItem.style.opacity = '1';
            notificationItem.style.transform = 'translateX(0)';
        }, 100);
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

        return date.toLocaleDateString();
    }

    loadMore() {
        this.currentPage++;
        this.loadNotifications(this.currentPage, false);
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadNotifications(1, true);
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
            this.elements.loadingIndicator.style.display = 'block';
            this.elements.notificationsList.style.display = 'none';
            this.elements.mainNotificationsList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.notifications-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.notifications-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.notifications-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.notifications-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showNotificationsList() {
        this.elements.notificationsList.style.display = 'block';
        this.elements.mainNotificationsList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.notificationsList.style.display = 'none';
        this.elements.mainNotificationsList.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.notificationsList.style.display = 'none';
            this.elements.mainNotificationsList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
        }
    }

    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadNotifications(1, true);
    }
}