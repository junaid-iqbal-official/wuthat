'use strict';
class CallLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;

        this.elements = {
            callList: document.getElementById('call-list'),
            loadingIndicator: document.getElementById('call-loading'),
            loadMoreContainer: document.getElementById('call-load-more-container'),
            loadMoreBtn: document.getElementById('call-load-more-btn'),
            emptyState: document.getElementById('call-empty-state'),
            errorState: document.getElementById('call-error-state'),
            retryBtn: document.getElementById('call-retry-btn')
        };

        this.init();
    }

    init() {
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
        this.elements.retryBtn.addEventListener('click', () => this.retry());

        this.loadCalls(1, true);
        this.showLoading(true);
    }

    async loadCalls(page = 1, isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/call/history?page=${page}&limit=20`);
            const data = await response.json();

            if (data.success && data.data) {
                this.renderCalls(data.data, isInitial);
                this.updatePagination(data.pagination);

                if (Object.keys(data.data).length > 0) {
                    this.showCallList();
                }
            } else {
                throw new Error(data.message || 'Failed to load calls');
            }
        } catch (error) {
            this.showError(isInitial);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    renderCalls(callGroups, isInitial = false) {
        if (isInitial) {
            this.elements.callList.innerHTML = '';
        }

        if (Object.keys(callGroups).length === 0 && isInitial) {
            this.showEmptyState();
            return;
        }

        for (const [dateGroup, calls] of Object.entries(callGroups)) {
            let dateGroupElement = this.elements.callList.querySelector(`.date-group[data-group="${dateGroup}"]`);

            if (!dateGroupElement) {
                dateGroupElement = document.createElement('div');
                dateGroupElement.className = 'date-group';
                dateGroupElement.dataset.group = dateGroup;

                const dateHeader = document.createElement('div');
                dateHeader.className = 'date-header';
                dateHeader.innerHTML = `
                        <h6 class="date-title">${dateGroup}</h6>
                        <small class="text-muted">${calls[0].exactDate}</small>
                    `;

                const callList = document.createElement('ul');
                callList.className = 'call-log-main';

                dateGroupElement.appendChild(dateHeader);
                dateGroupElement.appendChild(callList);
                this.elements.callList.appendChild(dateGroupElement);
            }

            const callList = dateGroupElement.querySelector('ul.call-log-main');

            calls.forEach(call => {
                const callElement = this.createCallElement(call);
                callList.appendChild(callElement);
            });
        }
    }

    createCallElement(call) {
        const isOnline = call.user?.is_online || false;
        const userName = call.user?.name || 'Unknown';
        const callTime = call.exactTime || '--:--';
        const duration = call.duration ? this.formatDuration(call.duration) : '';

        let icon, statusClass;
        if (call.isMissed) {
            icon = '<i class="missed" data-feather="corner-left-down"></i>';
            statusClass = 'btn-outline-danger';
        } else if (call.isIncoming) {
            icon = '<i data-feather="arrow-down-right"></i>';
            statusClass = 'btn-outline-success';
        } else {
            icon = '<i data-feather="arrow-up-right"></i>';
            statusClass = 'btn-outline-success';
        }

        const callIcon = call.callType === 'video' ? 'video' : 'phone';

        const li = document.createElement('li');
        if (call.isMissed) li.classList.add('missed-call');

        const avatarHtml = call.user?.avatar ?
            `<img src="${call.user.avatar}" alt="${userName}" class="avatar">` :
            `<div class="avatar-circle">
                    <span class="initial">${userName.charAt(0).toUpperCase()} </span>
                </div>`;

        li.innerHTML = `
                <div class="call-box">
                    <div class="profile ${isOnline ? 'online' : 'offline'}">
                        ${avatarHtml}
                    </div>
                    <div class="details">
                        <h5>${userName}</h5>
                        <h6>${icon} ${callTime} ${duration ? `· ${duration}` : ''}</h6>
                    </div>
                    <div class="call-status">
                        <div class="icon-btn ${statusClass} button-effect btn-sm">
                            <i data-feather="${callIcon}"></i>
                        </div>
                    </div>
                </div>
            `;

        li.addEventListener('click', () => {
            this.initiateCall(call);
        });

        return li;
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    async initiateCall(call) {
        const receiverInitials = window.callManager.getInitials(call.user?.name);
        window.callManager.prepareCallModal(call.user?.id, call.user?.name, receiverInitials, call.callMode, null, call.callType);

        setTimeout(async () => {
            if (window.callManager && window.callManager.pendingCall) {
                const { receiverId, groupId, callType } = window.callManager.pendingCall;
                await window.callManager.ensureLocalStream(callType === 'video');
                window.callManager.initiateCall(receiverId, groupId, callType);
            }
        }, 500);

    }

    loadMore() {
        this.currentPage++;
        this.loadCalls(this.currentPage, false);
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadCalls(1, true);
    }

    updatePagination(pagination) {
        this.hasMore = pagination?.hasMore || false;
        this.currentPage = pagination?.page || 1;

        if (this.hasMore && pagination?.total > 0) {
            this.elements.loadMoreContainer.style.display = 'block';
        } else {
            this.elements.loadMoreContainer.style.display = 'none';
        }
    }

    showLoading(isInitial) {
        if (isInitial) {
            this.elements.loadingIndicator.style.display = 'block';
            this.elements.callList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.call-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.call-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.call-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.call-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showCallList() {
        this.elements.callList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.callList.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.callList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
        }
    }

    // Method to refresh calls
    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadCalls(1, true);
    }

    addNewCall(call) {
        const dateGroup = new Date(call.created_at).toLocaleDateString();
        let dateGroupElement = this.elements.callList.querySelector(`.date-group[data-group="${dateGroup}"]`);

        if (!dateGroupElement) {
            dateGroupElement = document.createElement('div');
            dateGroupElement.className = 'date-group';
            dateGroupElement.dataset.group = dateGroup;

            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.innerHTML = `
            <h6 class="date-title">${dateGroup}</h6>
            <small class="text-muted">${new Date(call.created_at).toLocaleDateString()}</small>
        `;

            const callList = document.createElement('ul');
            callList.className = 'call-log-main';

            dateGroupElement.appendChild(dateHeader);
            dateGroupElement.appendChild(callList);

            if (this.elements.callList.firstChild) {
                this.elements.callList.insertBefore(dateGroupElement, this.elements.callList.firstChild);
            } else {
                this.elements.callList.appendChild(dateGroupElement);
            }
        }

        const callList = dateGroupElement.querySelector('ul.call-log-main');
        const callElement = this.createCallElement(call);

        if (callList.firstChild) {
            callList.insertBefore(callElement, callList.firstChild);
        } else {
            callList.appendChild(callElement);
        }

        if (this.elements.emptyState.style.display !== 'none') {
            this.showCallList();
        }
    }
}