'use strict';
class FriendsLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.searchTimeout = null;
        this.allSuggestions = [];
        this.filteredSuggestions = [];
        this.currentSearchTerm = '';

        this.elements = {
            friendsList: document.getElementById('friends-suggestion-list'),
            mainFriendsList: document.getElementById('main-friends-list'),
            loadingIndicator: document.getElementById('friends-loading'),
            loadMoreContainer: document.getElementById('friends-load-more-container'),
            loadMoreBtn: document.getElementById('friends-load-more-btn'),
            emptyState: document.getElementById('friends-empty-state'),
            errorState: document.getElementById('friends-error-state'),
            retryBtn: document.getElementById('friends-retry-btn'),
            searchInput: document.getElementById('contactSearch')
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

        this.loadFriendSuggestions(true);
        this.showLoading(true);
    }

    async loadFriendSuggestions(isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch('/friend/suggestions');
            const data = await response.json();

            if (data.success) {
                this.allSuggestions = data.suggestions;
                this.renderFriendSuggestions(data.suggestions, isInitial);

                if (data.suggestions.length > 0) {
                    this.showFriendsList();
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

    renderFriendSuggestions(suggestions, isInitial = false) {
        if (isInitial) {
            this.elements.friendsList.innerHTML = '';
        }

        if (suggestions.length === 0 && isInitial) {
            this.showEmptyState();
            return;
        }

        suggestions.forEach(user => {
            const friendItem = this.createFriendSuggestionItem(user);
            this.elements.friendsList.appendChild(friendItem);
        });
    }

    createFriendSuggestionItem(user) {
        const li = document.createElement('li');
        li.className = 'chat-item friend-suggestion-item';
        li.setAttribute('data-user-id', user.id);
        li.setAttribute('data-name', user.name.toLowerCase());
        li.setAttribute('data-bio', user.bio.toLowerCase());

        li.innerHTML = `
            <div class="chat-box comman-flex">
                <div>
                    <div class="profile bg-size ${user.is_online ? 'online' : 'offline'}">
                        ${this.renderAvatar(user.avatar, user.name)}
                    </div>
                    <div class="details">
                        <h5>${user.name}</h5>
                        <h6>${user.bio}</h6>
                    </div>
                </div>
                <div class="custom-chat-item">
                    <button type="button" 
                        class="btn custom-chat-btn send-request-btn" 
                        data-user-id="${user.id}"
                        onclick="friendsLoader.sendFriendRequest(${user.id}, this)">
                        <span class="btn-text">Send Request</span>
                        <span class="btn-spinner spinner-border spinner-border-sm d-none ml-1"></span>
                    </button>
                </div>
            </div>
        `;

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

    async sendFriendRequest(userId, buttonElement) {
        if (buttonElement.disabled) return;

        const btnText = buttonElement.querySelector('.btn-text');
        const btnSpinner = buttonElement.querySelector('.btn-spinner');

        buttonElement.disabled = true;
        btnText.textContent = 'Sending...';
        btnSpinner.classList.remove('d-none');

        try {
            const response = await fetch('/friend/send-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ friendId: userId })
            });

            const data = await response.json();

            if (data.success) {
                btnText.textContent = 'Request Sent';
                buttonElement.className = 'btn btn-success custom-chat-btn';
                buttonElement.disabled = true;

                setTimeout(() => {
                    const listItem = buttonElement.closest('.chat-item');
                    if (listItem) {
                        listItem.style.transition = 'all 0.3s ease';
                        listItem.style.opacity = '0';
                        listItem.style.transform = 'translateX(-100%)';

                        setTimeout(() => {
                            if (listItem.parentNode) {
                                listItem.parentNode.removeChild(listItem);

                                if (this.elements.friendsList.children.length === 0) {
                                    this.showEmptyState();
                                }
                            }
                        }, 300);
                    }
                }, 1500);

            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            btnText.textContent = 'Send Request';
            buttonElement.className = 'btn custom-chat-btn send-request-btn';
            buttonElement.disabled = false;
        } finally {
            btnSpinner.classList.add('d-none');
        }
    }

    async handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase();

        try {
            const response = await fetch(`/friend/search-friend?search=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Search request failed');

            const suggestions = await response.json();
            this.filteredSuggestions = suggestions;

            this.renderFriendSuggestions(this.filteredSuggestions, true);

            if (this.filteredSuggestions.length > 0) {
                this.showFriendsList();
            } else {
                this.showEmptyState();
            }
        } catch (err) {
            this.showEmptyState();
        }
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadFriendSuggestions(true);
    }

    showLoading(isInitial) {
        if (isInitial) {
            this.elements.loadingIndicator.style.display = 'block';
            this.elements.friendsList.style.display = 'none';
            this.elements.mainFriendsList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
    }

    showFriendsList() {
        this.elements.friendsList.style.display = 'block';
        this.elements.mainFriendsList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.friendsList.style.display = 'none';
        this.elements.mainFriendsList.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.friendsList.style.display = 'none';
            this.elements.mainFriendsList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
        }
    }

    refresh() {
        this.loadFriendSuggestions(true);
    }
}