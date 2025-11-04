'use strict';
class ArchiveChatLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.searchTimeout = null;
        this.allArchivedChats = [];
        this.filteredArchivedChats = [];
        this.currentSearchTerm = '';
        this.currentUserId = "<%= currentUserId %>";

        this.elements = {
            archiveList: document.getElementById('archive-chat-list'),
            mainArchiveList: document.getElementById('main-archive-chat-list'),
            loadingIndicator: document.getElementById('archive-chat-loading'),
            loadMoreContainer: document.getElementById('archive-chat-load-more-container'),
            loadMoreBtn: document.getElementById('archive-chat-load-more-btn'),
            emptyState: document.getElementById('archive-chat-empty-state'),
            searchEmptyState: document.getElementById('archive-chat-search-empty-state'),
            errorState: document.getElementById('archive-chat-error-state'),
            retryBtn: document.getElementById('archive-chat-retry-btn'),
            searchInput: document.getElementById('archiveChatSearch'),
            searchForm: document.querySelector('#archive-chat .search-form'),
            searchIcon: document.querySelector('#archive-chat .search'),
            closeSearch: document.querySelector('#archive-chat .close-search')
        };

        this.init();
    }

    init() {
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
        this.elements.retryBtn.addEventListener('click', () => this.retry());

        this.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value.trim());
            }, 300);
        });

        this.loadArchivedChats(true);
        this.showLoading(true);
    }

    async loadArchivedChats(isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/archive?page=${this.currentPage}&limit=20`);
            const data = await response.json();

            if (data.success) {
                if (isInitial) {
                    this.allArchivedChats = data.archived;
                } else {
                    this.allArchivedChats = [...this.allArchivedChats, ...data.archived];
                }

                this.renderArchivedChats(this.allArchivedChats, isInitial);
                this.updatePagination(data.pagination);

                if (this.allArchivedChats.length > 0) {
                    this.showArchiveList();
                } else {
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

    renderArchivedChats(archivedChats, isInitial = false) {
        if (isInitial) {
            this.elements.archiveList.innerHTML = '';
        }

        if (archivedChats.length === 0) {
            if (this.currentSearchTerm) {
                this.showSearchEmptyState();
            } else {
                this.showEmptyState();
            }
            return;
        }

        archivedChats.forEach(archived => {
            const archiveItem = this.createArchiveItem(archived);
            this.elements.archiveList.appendChild(archiveItem);
        });
    }

    createArchiveItem(archived) {
        const isGroup = archived.target_type === 'group';
        const targetData = archived.target;

        if (!targetData) {
            return document.createElement('li');
        }

        const avatar = targetData.avatar;
        const name = targetData.name;
        const lastMessage = archived.last_message || 'No messages yet';
        const unreadCount = archived.unread_count || 0;

        const li = document.createElement('li');
        li.className = 'start-chat chat-item archived-chat-item';
        li.setAttribute(`data-${isGroup ? 'group-id' : 'user-id'}`, targetData.id);
        li.setAttribute('data-name', name.toLowerCase());
        li.setAttribute('data-last-message', lastMessage.toLowerCase());

        li.innerHTML = `
                <div class="chat-box">
                    <div class="d-flex align-items-center">
                        <div class="profile ${isGroup ? '' : (targetData.is_online ? 'online' : 'offline')}">
                            ${this.renderAvatar(avatar, name)}
                            ${unreadCount > 0 ? `<span class="unread-count">${unreadCount}</span>` : ''}
                        </div>
                        <div class="details flex-grow-1">
                            <div class="d-flex justify-content-between align-items-center">
                                <h5>${name}</h5>
                            </div>
                            <h6 class="last-message">${lastMessage}</h6>
                        </div>
                        <div>
                            <a class="icon-btn btn-outline-success btn-sm unarchive-btn" 
                            href="javascript:void(0)" 
                            data-target-id="${targetData.id}" 
                            data-target-type="${archived.target_type}"
                            title="Unarchive chat">
                                <i data-feather="inbox"></i>
                            </a>
                        </div>
                    </div>
                </div>
        `;

        li.onclick = () => {
            loadChat(targetData.id, li);
        };

        const unarchiveBtn = li.querySelector('.unarchive-btn');
        unarchiveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.unarchiveChat(targetData.id, archived.target_type, li);
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

    async unarchiveChat(targetId, targetType, listItem) {
        const profile = document.querySelector(`.contact-details[data-receiver-id="${targetId}"]`);

        const animateRemoval = (item) => {
            if (!item) return;
            item.style.transition = 'all 0.3s ease';
            item.offsetHeight;
            item.style.opacity = '0';
            item.style.transform = 'translateX(-100%)';

            setTimeout(() => {
                if (item.parentNode) {
                    item.parentNode.removeChild(item);

                    this.allArchivedChats = this.allArchivedChats.filter(
                        chat => !(chat.target.id === targetId && chat.target_type === targetType)
                    );

                    if (this.elements?.archiveList?.children.length === 0) {
                        if (this.currentSearchTerm) {
                            this.handleSearch(this.currentSearchTerm);
                        } else {
                            this.showEmptyState();
                        }
                    }
                }
            }, 300);
        };

        try {
            const unarchiveBtn = profile?.querySelector('.chat-action-btn[data-action="unarchive"]');

            if (unarchiveBtn) {
                unarchiveBtn.click();
                animateRemoval(listItem);
                return;
            }

            const response = await fetch('/unarchive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId, targetType })
            });

            const data = await response.json();

            if (data.success) {
                animateRemoval(listItem);
                cacheManager.clear(targetId.toString());
                if(window.chatLoader) window.chatLoader.refresh();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showEmptyState();
        }
    }

    async handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase();

        try {
            const response = await fetch(`/search-archive-chat?search=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Search request failed');

            const archived = await response.json();

            this.filteredArchivedChats = archived;

            this.renderArchivedChats(this.filteredArchivedChats, true);

            if (this.filteredArchivedChats.length > 0) {
                this.showArchiveList();
            } else {
                this.showEmptyState();
            }
        } catch (err) {
            this.showEmptyState();
        }
    }

    loadMore() {
        if (this.hasMore && !this.currentSearchTerm) {
            this.currentPage++;
            this.loadArchivedChats(false);
        }
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentSearchTerm = '';
        this.loadArchivedChats(true);
    }

    updatePagination(pagination) {
        this.hasMore = pagination.hasMore;
        this.currentPage = pagination.currentPage;

        if (this.hasMore && pagination.totalCount > 0 && !this.currentSearchTerm) {
            this.elements.loadMoreContainer.style.display = 'block';
        } else {
            this.elements.loadMoreContainer.style.display = 'none';
        }
    }

    showLoading(isInitial) {
        if (isInitial) {
            this.elements.loadingIndicator.style.display = 'block';
            this.elements.mainArchiveList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.searchEmptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.archive-chat-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.archive-chat-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.archive-chat-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.archive-chat-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showArchiveList() {
        this.elements.mainArchiveList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.searchEmptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.mainArchiveList.style.display = 'none';
        this.elements.searchEmptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showSearchEmptyState() {
        this.elements.searchEmptyState.style.display = 'flex';
        this.elements.mainArchiveList.style.display = 'none';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.mainArchiveList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.searchEmptyState.style.display = 'none';
        }
    }

    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentSearchTerm = '';
        this.loadArchivedChats(true);
    }

    addNewArchivedChat(archivedData) {
        this.allArchivedChats.unshift(archivedData);

        if (this.currentSearchTerm) {
            this.handleSearch(this.currentSearchTerm);
        } else {
            const archiveItem = this.createArchiveItem(archivedData);
            this.elements.archiveList.insertBefore(archiveItem, this.elements.archiveList.firstChild);

            if (this.elements.emptyState.style.display !== 'none') {
                this.showArchiveList();
            }
        }
    }
}