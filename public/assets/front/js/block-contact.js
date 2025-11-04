'use strict';
class BlockedContactsLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.searchTimeout = null;
        this.allBlockedContacts = [];
        this.filteredBlockedContacts = [];
        this.currentSearchTerm = '';
        this.currentUserId = "<%= currentUserId %>";

        this.elements = {
            blockList: document.getElementById('block-list'),
            mainBlockList: document.getElementById('main-block-list'),
            loadingIndicator: document.getElementById('block-loading'),
            loadMoreContainer: document.getElementById('block-load-more-container'),
            loadMoreBtn: document.getElementById('block-load-more-btn'),
            emptyState: document.getElementById('block-empty-state'),
            searchEmptyState: document.getElementById('block-search-empty-state'),
            errorState: document.getElementById('block-error-state'),
            retryBtn: document.getElementById('block-retry-btn'),
            searchInput: document.getElementById('blockContactSearch'),
            searchForm: document.querySelector('#block-contact .search-form'),
            searchIcon: document.querySelector('#block-contact .search'),
            closeSearch: document.querySelector('#block-contact .close-search')
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

        this.loadBlockedContacts(true);
        this.showLoading(true);
    }

    async loadBlockedContacts(isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/block?page=${this.currentPage}&limit=20`);
            const data = await response.json();

            if (data.success) {
                if (isInitial) {
                    this.allBlockedContacts = data.blocked;
                } else {
                    this.allBlockedContacts = [...this.allBlockedContacts, ...data.blocked];
                }

                this.renderBlockedContacts(this.allBlockedContacts, isInitial);
                this.updatePagination(data.pagination);

                if (this.allBlockedContacts.length > 0) {
                    this.showBlockList();
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

    renderBlockedContacts(blockedContacts, isInitial = false) {
        if (isInitial) {
            this.elements.blockList.innerHTML = '';
        }

        if (blockedContacts.length === 0) {
            if (this.currentSearchTerm) {
                this.showSearchEmptyState();
            } else {
                this.showEmptyState();
            }
            return;
        }

        blockedContacts.forEach(blocked => {
            const blockItem = this.createBlockedItem(blocked);
            this.elements.blockList.appendChild(blockItem);
        });
    }

    createBlockedItem(blocked) {
        const blockedUser = blocked.blocked_user;

        const li = document.createElement('li');
        li.className = 'blocked-contact chat-item';
        li.setAttribute('data-user-id', blockedUser.id);
        li.setAttribute('data-name', blockedUser.name.toLowerCase());
        li.setAttribute('data-email', blockedUser.email?.toLowerCase() || '');
        li.setAttribute('data-bio', blockedUser.bio?.toLowerCase() || '');

        li.innerHTML = `
            <div class="chat-box">
                <div class="d-flex align-items-center">
                    <div class="profile offline">
                        ${this.renderAvatar(blockedUser.avatar, blockedUser.name)}
                    </div>
                    <div class="details flex-grow-1">
                        <h5>${blockedUser.name}</h5>
                        <h6>${blockedUser.bio || 'Blocked User'}</h6>
                    </div>
                    <div>
                        <a class="icon-btn btn-outline-success btn-sm unblock-btn" 
                            href="javascript:void(0)" 
                            data-user-id="${blockedUser.id}"
                            title="Unblock user">
                            <i data-feather="unlock"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;

        const unblockBtn = li.querySelector('.unblock-btn');
        unblockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.unblockUser(blockedUser.id, li);
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

    async unblockUser(userId, listItem) {

        const profile = document.querySelector(`.contact-details[data-receiver-id="${userId}"]`);

        const animateRemoval = (item) => {
            if (!item) return;
            item.style.transition = 'all 0.3s ease';
            item.offsetHeight;
            item.style.opacity = '0';
            item.style.transform = 'translateX(-100%)';

            setTimeout(() => {
                if (item.parentNode) {
                    item.parentNode.removeChild(item);

                    this.allBlockedContacts = this.allBlockedContacts.filter(
                        contact => contact.blocked_user.id !== userId
                    );

                    if (this.elements.blockList.children.length === 0) {
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
            const unblockBtn = profile?.querySelector('.chat-action-btn[data-action="unblock"]');

            if (unblockBtn) {
                unblockBtn.click();
                return;
            }

            const response = await fetch('/unblock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await response.json();

            if (data.success) {
                animateRemoval(listItem);
                cacheManager.clear(userId.toString());
                if(window.contactLoader) window.contactLoader.refresh();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showError(isInitial);
        }
    }


    async handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase();

        try {
            const response = await fetch(`/search-block-contact?search=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Search request failed');

            const blocked = await response.json();

            this.filteredBlockedContacts = blocked;

            this.renderBlockedContacts(this.filteredBlockedContacts, true);

            if (this.filteredBlockedContacts.length > 0) {
                this.showBlockList();
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
            this.loadBlockedContacts(false);
        }
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentSearchTerm = '';
        this.loadBlockedContacts(true);
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
            this.elements.mainBlockList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.searchEmptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.block-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.block-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.block-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.block-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showBlockList() {
        this.elements.mainBlockList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.searchEmptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.mainBlockList.style.display = 'none';
        this.elements.searchEmptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showSearchEmptyState() {
        this.elements.searchEmptyState.style.display = 'flex';
        this.elements.mainBlockList.style.display = 'none';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.mainBlockList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.searchEmptyState.style.display = 'none';
        }
    }

    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentSearchTerm = '';
        this.loadBlockedContacts(true);
    }

    addNewBlockedContact(blockedData) {
        this.allBlockedContacts.unshift(blockedData);

        if (this.currentSearchTerm) {
            this.handleSearch(this.currentSearchTerm);
        } else {
            const blockItem = this.createBlockedItem(blockedData);
            this.elements.blockList.insertBefore(blockItem, this.elements.blockList.firstChild);

            if (this.elements.emptyState.style.display !== 'none') {
                this.showBlockList();
            }
        }
    }
}