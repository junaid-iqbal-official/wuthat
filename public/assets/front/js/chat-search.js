class ChatSearchManager {
    constructor() {
        this.searchForm = document.querySelector(`[data-receiver-id="${chatState.recipientIdGlobal}"] .form-inline.search-form`);
        this.searchInput = this.searchForm?.querySelector('input[type="search"]');
        this.searchIcon = document.querySelector('.search-right');
        this.closeIcon = document.querySelector('.message-search');
        this.searchTrigger = document.querySelector('.search.search-right');
        this.searchResults = null;
        this.currentSearchTerm = '';
        this.searchResultsData = [];
        this.selectedIndex = -1;
        this.isSearchActive = false;
        this.searchTimeout = null;
        this.highlightedElements = [];
        
        setTimeout(() => {
            this.init();
        }, 500);
    }

    init() {
        this.setupSearchElements();
        this.bindSearchEvents();
        this.createSearchResultsDropdown();
        
        this.searchIcon?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openSearch(); 
        });

        this.closeIcon?.addEventListener('click',(e)=>{
            e.preventDefault();
            this.closeSearch();
        })

        document.addEventListener('click', (e) => {
            const msgItem = e.target.closest(".replied");
            if (msgItem) {
                const msgId = msgItem.dataset.rplmsgId;
                this.scrollToMessage(msgId);
            }
        });
    }

    setupSearchElements() {
        setTimeout(() => {
            if (!this.searchForm || !this.searchInput || !this.searchTrigger) return;
            
            this.searchInput.placeholder = 'Search messages...';    
        }, 500);
    }

    createSearchResultsDropdown() {
        if (!this.searchForm) return;

        this.searchResults = document.createElement('div');
        this.searchResults.className = 'chat-search-results';
        this.searchResults.innerHTML = `
            <div class="search-results-header">
                <span class="results-count">0 messages found</span>
                <button class="close-search-results" type="button">
                    <i data-feather="x"></i>
                </button>
            </div>
            <div class="search-results-list"></div>
        `;

        this.searchForm.parentNode.insertBefore(this.searchResults, this.searchForm.nextSibling);

        this.searchResults.querySelector('.close-search-results').addEventListener('click', () => {
            this.clearSearch();
        });
    }

    bindSearchEvents() {
        if (!this.searchTrigger || !this.searchForm || !this.searchInput) return;
        
        this.searchTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleSearch();
        });

        const closeBtn = this.searchForm.querySelector('.icon-close.close-search');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeSearch();
            });
        }
        
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });
        
        this.searchInput.addEventListener('keydown', (e) => {
            this.handleSearchKeydown(e);
        });

        // Close search on outside click
        document.addEventListener('click', (e) => {
            if (!this.searchForm.contains(e.target) &&
                !this.searchResults.contains(e.target) &&
                !this.searchTrigger.contains(e.target)) {
                if (this.isSearchActive && this.currentSearchTerm === '') {
                    this.closeSearch();
                }
            }
        });

        // Prevent form submission
        this.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    toggleSearch() {
        if (this.searchForm.classList.contains('open')) {
            this.closeSearch();
        } else {
            this.openSearch();
        }
    }

    openSearch() {
        this.searchForm.classList.add('open');
        this.isSearchActive = true;
        this.searchInput.focus();
    }

    closeSearch() {
        this.searchForm.classList.remove('open');
        this.isSearchActive = false;
        this.searchInput.value = '';
        this.currentSearchTerm = '';
        this.hideSearchResults();
        this.clearHighlights();
        this.selectedIndex = -1;
    }

    clearSearch() {
        this.searchInput.value = '';
        this.currentSearchTerm = '';
        this.hideSearchResults();
        this.clearHighlights();
        this.selectedIndex = -1;
    }

    handleSearchInput(value) {
        const searchTerm = value.trim();

        if (searchTerm.length === 0) {
            this.hideSearchResults();
            this.clearHighlights();
            this.currentSearchTerm = '';
            return;
        }

        if (searchTerm.length < 2) {
            return;
        }

        this.currentSearchTerm = searchTerm;

        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        this.searchTimeout = setTimeout(() => {
            this.performSearch(searchTerm);
        }, 300);
    }

    handleSearchKeydown(e) {
        if (!this.searchResults.classList.contains('show')) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.navigateResults(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.navigateResults(-1);
                break;
            case 'Enter':
                e.preventDefault();
                this.selectCurrentResult();
                break;
            case 'Escape':
                e.preventDefault();
                this.closeSearch();
                break;
        }
    }

    async performSearch(searchTerm) {
        const currentRecipientId = chatState.recipientIdGlobal;
        if (!currentRecipientId) return;

        this.showSearchLoading();

        try {
            const response = await fetch(`/messages/${currentRecipientId}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: searchTerm,
                    limit: 50
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const data = await response.json();
            this.displaySearchResults(data.results || [], searchTerm);

        } catch (error) {
            this.showSearchError();
        }
    }

    showSearchLoading() {
        const resultsList = this.searchResults.querySelector('.search-results-list');
        resultsList.innerHTML = `
                <div class="search-loading">
                    <i data-feather="loader"></i>
                    Searching messages...
                </div>
            `;
        this.searchResults.classList.add('show');
    }

    showSearchError() {
        const resultsList = this.searchResults.querySelector('.search-results-list');
        resultsList.innerHTML = `
            <div class="search-no-results">
                Failed to search messages. Please try again.
            </div>
        `;
        this.updateResultsCount(0);
    }

    displaySearchResults(results, searchTerm) {
        this.searchResultsData = results;
        this.selectedIndex = -1;

        const resultsList = this.searchResults.querySelector('.search-results-list');
        const resultsCount = results.length;

        this.updateResultsCount(resultsCount);

        if (resultsCount === 0) {
            resultsList.innerHTML = `
                <div class="search-no-results">
                    No messages found for "${searchTerm}"
                </div>
            `;
        } else {
            resultsList.innerHTML = results.map((result, index) => {
                return this.createSearchResultItem(result, searchTerm, index);
            }).join('');

            this.bindResultClickEvents();
        }

        this.searchResults.classList.add('show');
    }

    createSearchResultItem(result, searchTerm, index) {
        const highlightedContent = this.highlightSearchTerm(result.content || '', searchTerm);
        const timeAgo = this.formatTimeAgo(result.created_at);
        return `
            <div class="search-result-item" data-message-id="${result.id}" data-index="${index}">
                <div class="search-result-content">
                    <div class="search-result-sender">${result.sender.name}</div>
                    <div class="search-result-message">${highlightedContent}</div>
                    <div class="search-result-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }

    highlightSearchTerm(text, searchTerm) {
        if (!text || !searchTerm) return text || '';

        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    bindResultClickEvents() {
        const items = this.searchResults.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectResult(index);
            });
        });
    }

    navigateResults(direction) {
        const maxIndex = this.searchResultsData.length - 1;

        if (direction === 1) {
            this.selectedIndex = this.selectedIndex >= maxIndex ? 0 : this.selectedIndex + 1;
        } else {
            this.selectedIndex = this.selectedIndex <= 0 ? maxIndex : this.selectedIndex - 1;
        }

        this.updateSelectedResult();
    }

    updateSelectedResult() {
        const items = this.searchResults.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectCurrentResult() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.searchResultsData.length) {
            this.selectResult(this.selectedIndex);
        }
    }

    selectResult(index) {
        if (index < 0 || index >= this.searchResultsData.length) return;

        const result = this.searchResultsData[index];
        this.scrollToMessage(result.id);
        this.hideSearchResults();
    }

    async scrollToMessage(messageId) {
        const chatting = document.querySelector('#chatting');
        if (!chatting) return;

        let messageElement = chatting.querySelector(`[data-msg-id="${messageId}"]`);
        if (messageElement) {
            this.highlightAndScrollToMessage(messageElement);
            return;
        }
        await this.loadMessageContext(messageId);
    }

    async loadMessageContext(messageId) {
        const currentRecipientId = chatState.recipientIdGlobal;
        if (!currentRecipientId) return;

        try {
            const response = await fetch(`/messages/${currentRecipientId}/context/${messageId}`);
            if (!response.ok) {
                throw new Error(`Failed to load message context: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.html) {
                const chatting = document.querySelector('#chatting');
                chatting.innerHTML = data.html;

                chatState.currentOffset = data.offset || 0;
                chatState.totalLoadedMessages = data.messageCount || 0;
                chatState.hasMoreMessages = data.hasMore || false;
                chatState.allMessagesLoaded = !data.hasMore;

                const messageElement = chatting.querySelector(`[data-msg-id="${messageId}"]`);
                if (messageElement) {
                    this.highlightAndScrollToMessage(messageElement);
                }

                const cachedEntry = cacheManager.get(currentRecipientId);
                if (cachedEntry) {
                    cachedEntry.updateContent(
                        data.html,
                        data.messageCount || 0,
                        data.offset || 0,
                        data.hasMore || false,
                        !data.hasMore,
                        chatState.conversationType
                    );
                }
            }
        } catch (error) {
            showNotification(error.message || 'Something Went Wrong.','danger');
        }
    }

    highlightAndScrollToMessage(messageElement) {
        if(document.querySelector('.save-edit-btn')) return;

        this.clearHighlights();

        const messageContent = messageElement;
        if (messageContent) {
            messageContent.classList.add('message-highlight');
            this.highlightedElements.push(messageContent);
        }

        messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        setTimeout(() => {
            this.clearHighlights();
        }, 800);
    }

    clearHighlights() {
        this.highlightedElements.forEach(element => {
            element.classList.remove('message-highlight');
        });
        this.highlightedElements = [];
    }

    hideSearchResults() {
        this.searchResults.classList.remove('show');
    }

    updateResultsCount(count) {
        const countElement = this.searchResults.querySelector('.results-count');
        if (count === 0) {
            countElement.textContent = 'No messages found';
        } else if (count === 1) {
            countElement.textContent = '1 message found';
        } else {
            countElement.textContent = `${count} messages found`;
        }
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    // Public method to handle new messages
    handleNewMessage(message) {
        if (this.isSearchActive && this.currentSearchTerm) {
            if (message.content &&
                message.content.toLowerCase().includes(this.currentSearchTerm.toLowerCase())) {
                setTimeout(() => {
                    this.performSearch(this.currentSearchTerm);
                }, 500);
            }
        }
    }
}