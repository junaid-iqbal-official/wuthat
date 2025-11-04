'use strict';
class FavoriteLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.searchTimeout = null;
        this.allFavorites = [];
        this.filteredFavorites = [];
        this.currentSearchTerm = '';
        this.currentUserId = "<%= currentUserId %>";

        this.elements = {
            favList: document.getElementById('fav-list'),
            mainFavList: document.getElementById('main-fav-list'),
            loadingIndicator: document.getElementById('fav-loading'),
            loadMoreContainer: document.getElementById('fav-load-more-container'),
            loadMoreBtn: document.getElementById('fav-load-more-btn'),
            emptyState: document.getElementById('fav-empty-state'),
            searchEmptyState: document.getElementById('fav-search-empty-state'),
            errorState: document.getElementById('fav-error-state'),
            retryBtn: document.getElementById('fav-retry-btn'),
            searchInput: document.getElementById('favoriteSearch'),
            searchForm: document.querySelector('#favourite .search-form'),
            searchIcon: document.querySelector('#favourite .search'),
            closeSearch: document.querySelector('#favourite .close-search')
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

        this.loadFavorites(true);
        this.showLoading(true);
    }

    async loadFavorites(isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/favorites?page=${this.currentPage}&limit=20`);
            const data = await response.json();

            if (data.success) {
                if (isInitial) {
                    this.allFavorites = data.favorites;
                } else {
                    this.allFavorites = [...this.allFavorites, ...data.favorites];
                }

                this.renderFavorites(this.allFavorites, isInitial);
                this.updatePagination(data.pagination);

                if (this.allFavorites.length > 0) {
                    this.showFavList();
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

    renderFavorites(favorites, isInitial = false) {
        if (isInitial) {
            this.elements.favList.innerHTML = '';
        }

        if (favorites.length === 0) {
            if (this.currentSearchTerm) {
                this.showSearchEmptyState();
            } else {
                this.showEmptyState();
            }
            return;
        }

        favorites.forEach(favorite => {
            const favItem = this.createFavoriteItem(favorite);
            this.elements.favList.appendChild(favItem);
        });
    }

    createFavoriteItem(favorite) {
        const isGroup = favorite.target_type === 'group';
        const targetData = isGroup ? favorite.group : favorite.user;

        const avatar = targetData.avatar;
        const name = targetData.name;
        const email = isGroup ? '' : targetData.email;
        const bio = isGroup ? '' : targetData.bio;
        const isOnline = isGroup ? false : targetData.is_online;

        const li = document.createElement('li');
        li.className = 'start-chat chat-item favorite-item';
        li.setAttribute(`data-${isGroup ? 'group-id' : 'user-id'}`, targetData.id);
        li.setAttribute('data-name', name.toLowerCase());
        li.setAttribute('data-bio', bio?.toLowerCase() || '');
        li.setAttribute('data-email', email?.toLowerCase() || '');

        li.onclick = () => {
            if (isGroup) {
                loadGroupChat(targetData.id, li);
            } else {
                loadChat(targetData.id, li);
            }
        };

        li.innerHTML = `
                <div class="chat-box">
                    <div class="d-flex align-items-center">
                        <div class="profile ${isOnline ? 'online' : 'offline'}">
                            ${this.renderAvatar(avatar, name)}
                        </div>
                        <div class="details">
                            <h5>${name}</h5>
                            <h6>${bio || (isGroup ? 'Group Chat' : 'User')}</h6>
                        </div>
                        <div class="flex-grow-1">
                            <a class="icon-btn btn-outline-danger btn-sm pull-right unfav-btn" 
                               href="javascript:void(0)" 
                               data-target-id="${targetData.id}" 
                               data-target-type="${favorite.target_type}"
                               title="Remove from favorites">
                                <i data-feather="heart" class="fill-heart"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;

        const unfavBtn = li.querySelector('.unfav-btn');
        unfavBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(targetData.id, favorite.target_type, true, li);
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

    async toggleFavorite(targetId, targetType, isUnfav, listItem = null) {
        const profile = document.querySelector(`.contact-details[data-receiver-id="${targetId}"]`);
        const unFavBtn = profile?.querySelector('.chat-action-btn[data-action="unfavorite"]');

        const animateRemoval = (item) => {
            if (!item) return;
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '0';
            item.style.transform = 'translateX(-100%)';

            setTimeout(() => {
                if (item.parentNode) {
                    item.parentNode.removeChild(item);

                    this.allFavorites = this.allFavorites.filter(
                        fav => !(fav.target_id === targetId && fav.target_type === targetType)
                    );

                    if (this.elements.favList.children.length === 0) {
                        if (this.currentSearchTerm) {
                            this.handleSearch(this.currentSearchTerm);
                        } else {
                            this.showEmptyState();
                        }
                    }
                }
            }, 300);
        };

        if (unFavBtn) {
            unFavBtn.click();
            if (isUnfav && listItem) {
                animateRemoval(listItem);
            }
        } else {
            try {
                const response = await fetch('/favorite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetId, targetType })
                });

                const data = await response.json();

                if (data.success) {
                    if (isUnfav && listItem) {
                        animateRemoval(listItem);
                    }

                    cacheManager.clear(targetId.toString());

                    if (window.chatLoader) {
                        this.updateChatListStarIcon(targetId, targetType, data.isFavorite);
                    }
                }
            } catch (error) {
                return;
            }
        }
    }


    updateChatListStarIcon(targetId, targetType, isFavorite) {
        const selector = targetType === 'group'
            ? `[data-group-id="${targetId}"]`
            : `[data-user-id="${targetId}"]`;

        const chatItem = document.querySelector(selector);
        if (chatItem) {
            const starIcon = chatItem.querySelector('.favourite');
            if (starIcon) {
                starIcon.className = isFavorite
                    ? 'icon-btn btn-outline-danger btn-sm pull-right favourite favorited'
                    : 'icon-btn btn-outline-primary btn-sm pull-right favourite';
            }
        }
    }

    async handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase();

        try {
            const response = await fetch(`/search-favorite?search=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Search request failed');

            const favorites = await response.json();

            this.filteredFavorites = favorites;

            this.renderFavorites(this.filteredFavorites, true);

            if (this.filteredFavorites.length > 0) {
                this.showFavList();
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
            this.loadFavorites(false);
        }
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentSearchTerm = '';
        this.loadFavorites(true);
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
            this.elements.mainFavList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.searchEmptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.fav-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.fav-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.fav-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.fav-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showFavList() {
        this.elements.mainFavList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.searchEmptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.mainFavList.style.display = 'none';
        this.elements.searchEmptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showSearchEmptyState() {
        this.elements.searchEmptyState.style.display = 'flex';
        this.elements.mainFavList.style.display = 'none';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.mainFavList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.searchEmptyState.style.display = 'none';
        }
    }

    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentSearchTerm = '';
        this.loadFavorites(true);
    }

    addNewFavorite(favoriteData) {
        this.allFavorites.unshift(favoriteData);

        if (this.currentSearchTerm) {
            this.handleSearch(this.currentSearchTerm);
        } else {
            const favItem = this.createFavoriteItem(favoriteData);
            this.elements.favList.insertBefore(favItem, this.elements.favList.firstChild);

            if (this.elements.emptyState.style.display !== 'none') {
                this.showFavList();
            }
        }
    }
}