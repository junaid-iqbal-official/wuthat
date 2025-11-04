'use strict';

class AppCore {
    constructor() {
        this.socket = null;
        this.currentUserId = parseInt(document.querySelector('meta[name="current-user-id"]')?.content);
        this.systemSetting = null;
        this.DOM_CACHE = {};
        this.activeTab = 'chat';

        // Make available globally
        window.getElement = this.getElement.bind(this);
        window.debounce = this.debounce.bind(this);
        window.showNotification = this.showNotification.bind(this);
        window.makeApiCall = this.makeApiCall.bind(this);
        window.scrollToBottom = this.scrollToBottom.bind(this);
        window.activeChat = this.activeChat.bind(this); 
        window.updateUserOnlineStatus = this.updateUserOnlineStatus.bind(this);
        window.resetButton = this.resetButton.bind(this);
        window.setButtonLoading = this.setButtonLoading.bind(this);
    }

    setSocket(socket) {
        this.socket = socket;
    }

    // Helper functions
    getElement(selector, useCache = true) {
        if (useCache && this.DOM_CACHE[selector]) return this.DOM_CACHE[selector];
        
        const element = document.querySelector(selector);
        if (useCache && element) this.DOM_CACHE[selector] = element;
        return element;
    }

    showNotification(message, type = 'success') {
        document.querySelectorAll('.alert-notification').forEach(alert => alert.remove());
        
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-notification alert-dismissible fade show position-fixed`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }

    scrollToBottom() {
        const messagesContainer = document.querySelector("#chatting");
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // === Connection Monitoring ===
    monitorConnection() {
        if (!navigator.onLine) document.body.classList.add('offline');

        window.addEventListener('online', () => {
            document.body.classList.remove('offline');
            
            if (typeof this.socket !== 'undefined' && !this.socket.connected) {
                this.socket.connect();
            } 
        });

        window.addEventListener('offline', () => {
            document.body.classList.add('offline');
        });
    }

    // Function to retry connection
    retryConnection() {
        const retryButton = document.getElementById('retry-button');
        if (!retryButton) return;
        
        const originalBtnText = retryButton.textContent;
        retryButton.innerHTML = `${originalBtnText}<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
        retryButton.disabled = true;
        
        if (!retryButton.querySelector('.loading-spinner')) {
            const spinner = document.createElement('span');
            spinner.className = 'loading-spinner';
            retryButton.prepend(spinner);
        }
        
        if (navigator.onLine) {
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            setTimeout(() => {
                this.showNotification('You are still offline. Please check your internet connection and try again.','danger');
                retryButton.innerHTML = originalBtnText;
                retryButton.disabled = false;
            }, 500);
        }
    }

    // === Update Online/Offline UI ===
    updateUserOnlineStatus(userId, isOnline, lastSeen = null) {
        const profileEls = document.querySelectorAll(`.chat-item[data-user-id="${userId}"] .profile`);
        const profileHederEls = document.querySelector(`.contact-details[data-receiver-id="${userId}"] .profile`);
        profileEls.forEach((profile) => {
            profile.classList.remove("online", "offline");
            profile.classList.add(isOnline ? "online" : "offline");
        });

        profileHederEls?.classList.remove("online", "offline");
        profileHederEls?.classList.add(isOnline ? "online" : "offline");

        // Update right chat header (if this is the open chat)
        const header = document.querySelector(".contact-details");
        const receiverId = header?.getAttribute("data-receiver-id");

        if (receiverId && parseInt(receiverId) === userId) {
            const statusContainer = header.querySelector(".online-status");
            if (!statusContainer) return;
            statusContainer.innerHTML = "";

            if (isOnline) {
                const badge = document.createElement("div");
                badge.className = "badge badge-success";
                badge.textContent = "Online";
                statusContainer.appendChild(badge);
            } else if (lastSeen) {
                const span = document.createElement("span");
                span.className = "last-seen";
                span.dataset.timestamp = new Date(lastSeen).toISOString();
                span.textContent = `Last seen ${this.timeSince(lastSeen)}`;
                statusContainer.appendChild(span);
            } else {
                const badge = document.createElement("div");
                badge.className = "badge badge-danger";
                badge.textContent = "Offline";
                statusContainer.appendChild(badge);
            }
        }
    }

    // Update all .last-seen spans every 30 seconds
    startLastSeenUpdater() {
        setInterval(() => {
            document.querySelectorAll(".last-seen").forEach((el) => {
                const ts = el.getAttribute("data-timestamp");
                if (ts) {
                    const timeAgo = this.timeSince(new Date(ts));
                    el.textContent = `Last seen ${timeAgo}`;
                }
            });
        }, 30000);
    }

    timeSince(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60,
        };

        for (let [unit, value] of Object.entries(intervals)) {
            const count = Math.floor(seconds / value);
            if (count >= 1) return `${count} ${unit}${count > 1 ? "s" : ""} ago`;
        }
        return "Just now";
    }

    activeChat() {
        const hash = window.location.hash;
        if (hash && hash.startsWith("#")) {
            const recipientId = hash.substring(1);
            document.querySelector(`.chat-item[data-user-id="${recipientId}"]`)?.classList.add("active");

            const item = document.querySelector(`[data-user-id="${recipientId}"]`);
            if (item?.querySelector(".badge")  && item?.querySelector(".badge").text != 0) {
                item.querySelector(".badge")?.classList.add("d-none");
                item.querySelector(".ti-pin2")?.classList.remove("d-none");
            }

            const messageIds = [...document.querySelectorAll(".chatappend .sent:not(.typing-m) .msg-setting-main")].map((el) => el.dataset.msgId);
            socket.emit("messageSeen", { messageIds: messageIds, senderId: recipientId });
        }
    }

    // === Image Viewer Modal ===
    setupImageViewer() {
        document.addEventListener("click", (e) => {
            const target = e.target;
            const clickedImg = target.closest(".gallery-img-group img, .single-image img");
            const overlay = target.closest(".more-images-overlay");

            if (clickedImg || overlay) {
                e.preventDefault();
                this.handleImageClick(clickedImg, overlay);
                return;
            }
        });
    }

    handleImageClick(clickedImg, overlay) {
        const allImages = this.collectAllImages();
        if (!allImages.length) return;

        let clickedUrl = null;

        if (clickedImg) {
            clickedUrl = clickedImg.getAttribute("src");
        } else if (overlay) {
            const group = overlay.closest(".gallery-img-group");
            const groupImages = JSON.parse(group?.dataset?.imageGroup || "[]");
            clickedUrl = groupImages[3]?.url || null;
        }

        const clickedIndex = allImages.findIndex((img) => img.url === clickedUrl);
        if (clickedIndex >= 0) {
            this.showImageViewerModal(allImages, clickedIndex);
        }
    }

    collectAllImages() {
        const allImages = [];
        const seenUrls = new Set();

        document.querySelectorAll('li.msg-setting-main').forEach((msgItem) => {
            const groupEl = msgItem.querySelector('.gallery-img-group');
            const singleImg = msgItem.querySelector('.single-image img');

            if (groupEl && groupEl.dataset.imageGroup) {
                const groupImages = JSON.parse(groupEl?.dataset?.imageGroup || '[]') || [];
                groupImages.forEach(img => {
                    if (!seenUrls.has(img.url)) {
                        seenUrls.add(img.url);
                        allImages.push(img);
                    }
                });
            }

            if (singleImg) {
                const url = singleImg.getAttribute("src");
                const content = singleImg.getAttribute("alt") || "image";
                const id = msgItem.dataset.msgId;

                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    allImages.push({ id, url, content });
                }
            }
        });

        return allImages;
    }

    showImageViewerModal(images = [], startIndex = 0) {
        const modal = document.getElementById('imageViewerModal');
        const viewerImage = modal.querySelector('#viewerImage');
        const imageCounter = modal.querySelector('#imageCounter');
        const closeBtn = modal.querySelector('.close-btn');
        const prevBtn = modal.querySelector('.prev-btn');
        const nextBtn = modal.querySelector('.next-btn');

        let currentIndex = startIndex;

        const updateImage = () => {
            const currentImage = images[currentIndex];
            if (!currentImage) return;

            viewerImage.src = currentImage.url;
            viewerImage.alt = currentImage.content || 'image';
            imageCounter.textContent = `${currentIndex + 1} of ${images.length} image${images.length > 1 ? 's' : ''}`;

            const showNav = images.length > 1;
            prevBtn.style.display = showNav ? 'block' : 'none';
            nextBtn.style.display = showNav ? 'block' : 'none';
        };

        const showPrev = () => {
            if (currentIndex > 0) {
                currentIndex--;
                updateImage();
            }
        };

        const showNext = () => {
            if (currentIndex < images.length - 1) {
                currentIndex++;
                updateImage();
            }
        };

        closeBtn.onclick = () => modal.classList.replace('open', 'hidden');
        prevBtn.onclick = showPrev;
        nextBtn.onclick = showNext;

        modal.onclick = (e) => {
            if (e.target === modal) modal.classList.replace('open', 'hidden');
        };

        updateImage();
        modal.classList.replace('hidden', 'open');
    }

    // === Call Handlers ===
    setupCallHandlers() {
        document.addEventListener("click", (e) => {
            if (e.target.closest("#initiate-call")) {
                e.preventDefault();

                if(this.systemSetting.allow_voice_call !== 'true'){
                    this.showNotification("You're not allowed to make voice calls.",'danger');
                    return;
                }
                
                setTimeout(async () => {
                    if (window.callManager && window.callManager.pendingCall) {
                        const { receiverId, groupId, callType } = window.callManager.pendingCall;
                        await window.callManager.ensureLocalStream(callType === "video");
                        window.callManager.initiateCall(receiverId, groupId, callType);
                    }
                }, 500);
            }

            if (e.target.closest("#initiate-video-call")) {
                e.preventDefault();

                if(this.systemSetting.allow_video_call !== 'true'){
                    this.showNotification("You're not allowed to make video calls.",'danger');
                    return;
                }

                setTimeout(async () => {
                    if (window.callManager && window.callManager.pendingCall) {
                        const { receiverId, groupId, callType } = window.callManager.pendingCall;
                        await window.callManager.ensureLocalStream(callType === "video");
                        window.callManager.initiateCall(receiverId, groupId, callType);
                    }
                }, 500);
            }
        });
    }

    sendFriendRequestSocket(friendId, senderData) {
        this.socket.emit('sendFriendRequest', {
            friendId: friendId,
            senderData: senderData
        });
    }

    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Add dynamic behavior for "Other" selection
    initReportTypeHandler() {
        const reportTypeSelect = this.getElement('select[name="reportType"]');
        if (!reportTypeSelect) return;
        
        const descriptionField = this.getElement('textarea[name="description"]');
        if (!descriptionField) return;
        
        reportTypeSelect.addEventListener('change', function(e) {
            const otherInfo = this.getElement('#otherInfo') || this.createOtherInfoElement();

            if (e.target.value === 'Other') {
                otherInfo.style.display = 'block';
                descriptionField.placeholder = 'Please describe the issue in detail...';
                descriptionField.setAttribute('required', 'true');
            } else {
                otherInfo.style.display = 'none';
                descriptionField.placeholder = 'Please provide any additional information that might help us understand the situation...';
                descriptionField.removeAttribute('required');
            }
        }.bind(this));
    }

    createOtherInfoElement() {
        const descriptionContainer = this.getElement('textarea[name="description"]')?.closest('.mb-3');
        if (!descriptionContainer) return null;
        
        const otherInfo = document.createElement('div');
        otherInfo.id = 'otherInfo';
        otherInfo.className = 'alert alert-warning mt-2';
        otherInfo.innerHTML = '<i class="fa fa-exclamation-circle"></i> Please provide detailed information about the issue.';
        otherInfo.style.display = 'none';
        
        
        descriptionContainer.appendChild(otherInfo);
        this.DOM_CACHE['#otherInfo'] = otherInfo;
        return otherInfo;
    }

    // Generic functions
    async makeApiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) return false;
            
            return await response.json();
        } catch (error) {
            this.showNotification(error.message || 'Something Went Wrong','danger');
            return null;  
        }
    }

    async handleFormSubmit(formId, url, successCallback, errorCallback) {
        const form = this.getElement(formId);
        if (!form) return;

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (submitButton) {
                submitButton.disabled = true;

                if (!submitButton.dataset.originalText) {
                    submitButton.dataset.originalText = submitButton.textContent.trim();
                }
                submitButton.textContent = "";

                let spinner = submitButton.querySelector(".btn-spinner");
                if (!spinner) {
                    spinner = document.createElement("span");
                    spinner.className = "btn-spinner spinner-border spinner-border-sm ms-2";
                    spinner.setAttribute("role", "status");
                    spinner.setAttribute("aria-hidden", "true");
                    submitButton.appendChild(spinner);
                }
            }

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const result = await this.makeApiCall(url, {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (result?.success) {
                    if (typeof successCallback === 'function') successCallback(result);
                } else {
                    this.showNotification(result.message || 'Operation failed','danger');
                }
            } catch (error) {
                if (typeof errorCallback === 'function') {
                    errorCallback(error);
                } else {
                    this.showNotification(error.message || 'An error occurred', 'danger');
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = submitButton.dataset.originalText || 'Submit';
                    delete submitButton.dataset.originalText;
                }
            }
        }.bind(this));
    }

    // Update Privacy Settings
    initPrivacySettings() {
        this.handleFormSubmit('#privacySettingsForm', '/user/setting/account', 
            (result) => {
                this.showNotification('Settings updated successfully', 'success');
                return;
            },
            (error) => {
                const msgBox = this.getElement('#privacySettingsMsg');
                if (msgBox) {
                    msgBox.innerText = 'Error saving settings.';
                    msgBox.style.color = 'red';
                    msgBox.style.display = 'block';
                }
            }
        );
    }

    // Delete Account Request
    async initDeleteAccountRequest() {
        const deleteAccountLink = this.getElement('#deleteAccountLink');
        if (!deleteAccountLink) return;
        
        const confirmationModal = new bootstrap.Modal(this.getElement('#confirmationModal'));
        const adminApprovalModal = new bootstrap.Modal(this.getElement('#adminApprovalModal'));
        const successModal = new bootstrap.Modal(this.getElement('#successModal'));
        
        const confirmDeleteButton = this.getElement('#confirmDelete');
        const understandCheckbox = this.getElement('#understandConsequences');
        const redirectToLogin = this.getElement('#redirectToLogin');
        const originalBtnText = confirmDeleteButton.textContent;
        
        function resetModalState() {
            if (understandCheckbox) understandCheckbox.checked = false;
            if (confirmDeleteButton){
                confirmDeleteButton.disabled = true;

                confirmDeleteButton.innerHTML = `
                    ${originalBtnText}
                    <span class="btn-spinner spinner-border spinner-border-sm d-none" aria-hidden="true"></span>
                `;
            } 
        }
        
        deleteAccountLink.addEventListener('click', function(e) {
            e.preventDefault();
            resetModalState();
            confirmationModal.show();
        });
        
        if (understandCheckbox && confirmDeleteButton) {
            understandCheckbox.addEventListener('change', function() {
                confirmDeleteButton.disabled = !this.checked;
            });
        }
        
        if (confirmDeleteButton) {
            confirmDeleteButton.addEventListener('click', async function() {
                confirmationModal.hide();
                
                try {
                    const result = await this.makeApiCall('/user/setting/account', {
                        method: 'POST',
                        body: JSON.stringify({ delete_requested: 'request' })
                    });
                    
                    if (result.redirect) {
                        successModal.show();
                    } else {
                        adminApprovalModal.show();
                    }
                } catch (error) {
                    this.showNotification(error.message || 'There was an error processing your request', 'danger');
                    return;
                }
            }.bind(this));
        }
        
        if (redirectToLogin) {
            redirectToLogin.addEventListener('click', function() {
                const originalContent = redirectToLogin.innerHTML;
                
                redirectToLogin.innerHTML = `
                    ${originalContent}
                    <span class="btn-spinner spinner-border spinner-border-sm" aria-hidden="true"></span>
                `;
                redirectToLogin.disabled = true;
                
                setTimeout(() => {
                    window.location.href = '/login';
                }, 500);
            });
        }
    }

    // Change Password
    initChangePassword() {
        const changePasswordTrigger = this.getElement('#changePasswordTrigger');
        if (changePasswordTrigger) {
            changePasswordTrigger.addEventListener('click', () => {
                const modal = new bootstrap.Modal(this.getElement('#changePasswordModal'));
                modal.show();
            });
        }

        this.handleFormSubmit(
            '#changePasswordForm',
            '/user/change-password',
            (result) => {
                this.showNotification('Password updated successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            },
            (error) => {
                this.showNotification(error.message || 'Failed to change password', 'danger');
            }
        );
    }

    // === show success modal after drive connected successfully ===
    driveConnectedModal(){
        const urlParams = new URLSearchParams(window.location.search);
        const connected = urlParams.get('connectedDrive');

        if (connected === 'true') {
            const modalEl = document.getElementById('drive-modal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            setTimeout(() => {
                modal.hide();
                const cleanUrl = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, cleanUrl);
            }, 8000);
        }
    }

    // Generic search function for both chat and call
    setupSearch(searchInputId, endpoint, listId, type, emptyStateId) {
        const searchInput = document.getElementById(searchInputId);
        const list = document.getElementById(listId);
        const originalItems = list ? Array.from(list.querySelectorAll('li')) : [];
        const emptyState = document.getElementById(emptyStateId);

        const searchFunction = this.debounce(function(searchTerm) {
            if (searchTerm.length === 0) {
                list.innerHTML = '';
                originalItems.forEach(item => list.appendChild(item.cloneNode(true)));
                if (emptyState) emptyState.style.display = 'none';
                list.style.display = 'block';
                return;
            }
        
            fetch(`${endpoint}?q=${encodeURIComponent(searchTerm)}&type=${encodeURIComponent(type)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.renderContacts(data.contacts, list, type, emptyStateId);
                    } else {
                        list.innerHTML = '<li class="text-center p-3">Error searching contacts</li>';
                    }
                })
                .catch(error => {
                    list.innerHTML = '<li class="text-center p-3">Error searching contacts</li>';
                });
        }.bind(this), 300);

        searchInput?.addEventListener('input', function() {
            searchFunction(this.value.trim());
        });
    }

    renderContacts(contacts, listElement, type, emptyStateId) {
        if (!Array.isArray(contacts) || !listElement) return;

        const emptyState = document.getElementById(emptyStateId);

        listElement.innerHTML = '';
        const hasContacts = contacts.length > 0;

        listElement.style.display = hasContacts ? 'block' : 'none';
        if (emptyState) emptyState.style.display = hasContacts ? 'none' : 'block';
        if (!hasContacts) return;

        const fragment = document.createDocumentFragment();

        contacts.forEach(contact => {
            const li = document.createElement('li');
            li.dataset.to = contact.id;
            li.style.cursor = 'pointer';

            const profileHTML = contact.avatar
                ? `<img class="bg-img" src="${contact.avatar}" alt="Avatar"/>`
                : `<div class="avatar-circle"><span class="initial">${contact.name?.charAt(0).toUpperCase() || ''}</span></div>`;

            const detailsHTML = `
                <div class="profile ${contact.is_online ? 'online' : 'offline'}">${profileHTML}</div>
                <div class="details">
                    <h5>${contact.name || 'Unknown'}</h5>
                    <h6>${contact.status || ''}</h6>
                </div>
            `;

            if (type === 'chat') {
                li.innerHTML = `<div class="chat-box">${detailsHTML}</div>`;
                li.onclick = () => {
                    const chatModal = bootstrap.Modal.getInstance(document.getElementById('msgchatModal'));
                    if (chatModal) chatModal.hide();
                    loadChat(contact.id, li);
                };

            } else if (type === 'call') {
                li.innerHTML = `
                    <div class="call-box">
                        ${detailsHTML}
                        <div class="call-status">
                            <div class="icon-btn btn-outline-primary btn-sm button-effect">
                                <i data-feather="phone"></i>
                            </div>
                            <div class="icon-btn btn-outline-success btn-sm button-effect">
                                <i data-feather="video"></i>
                            </div>
                        </div>
                    </div>
                `;

            } else if (type === 'friend') {
                li.className = 'chat-item';
                li.innerHTML = `
                    <div class="call-box">
                        ${detailsHTML.replace(
                            contact.status,
                            contact.bio || contact.status || ''
                        )}
                        <div class="call-status custom-chat-item">
                            <button type="button" class="btn custom-chat-btn send-request-btn" data-user-id="${contact.id}">
                                <span class="btn-text">Send Request</span>
                                <span class="btn-spinner spinner-border spinner-border-sm d-none ml-1"></span>
                            </button>
                        </div>
                    </div>
                `;

                const button = li.querySelector('.send-request-btn');
                if (button && typeof friendsLoader?.sendFriendRequest === 'function') {
                    button.addEventListener('click', e => {
                        e.stopPropagation();
                        friendsLoader.sendFriendRequest(contact.id, button);
                    });
                }
            }
            fragment.appendChild(li);
        });
        listElement.appendChild(fragment);
    }

    // search contact from new Chat / new Call / Add friend
    newOption() {
        this.setupSearch('chatSearchInput','/new-chat/search', 'newChatList', 'chat', 'chat-empty-state');
        this.setupSearch('callSearchInput','/new-chat/search', 'newCallList', 'call', 'search-call-empty-state');
        this.setupSearch('friendSearchInput', '/new-chat/search', 'newFriendList','friend', 'search-contact-empty-state');
        this.setupSearch('forwardSearchInput','/new-chat/search', 'forwardContacts', 'chat', 'forward-empty-state');

        const allNewChat = document.querySelectorAll('#new-chat');
        
        allNewChat.forEach(function (li) {
            const id = li.dataset.to;
            li.onclick = function () {
                const chatModal = bootstrap.Modal.getInstance(document.getElementById('msgchatModal'));
                chatModal.hide();

                loadChat(id, li);
            };
        });
        
        const friendList = document.getElementById('newFriendList');
        if (!friendList) return;

        friendList.addEventListener('click', function (e) {
            const li = e.target.closest('li.chat-item');
            if (!li) return;

            const button = li.querySelector('.send-request-btn');
            if (!button) return;

            button.addEventListener('click', function (e) {
                e.stopPropagation();
                const userId = button.dataset.userId;

                if (window.friendsLoader && typeof friendsLoader.sendFriendRequest === 'function') {
                    friendsLoader.sendFriendRequest(userId, button);
                }

                Array.from(friendList.children).forEach(child => child.classList.remove('active'));
                li.classList.add('active');
            });
        });
    }

    // search feature on recent chat, recent call, contact
    recentSearch() {
        const searchInput = document.getElementById('chatSearch');
        const chatTab = document.getElementById('chat-tab');
        const callTab = document.getElementById('call-tab');
        const contactTab = document.getElementById('contact-tab');

        chatTab?.addEventListener('click', () => this.setActiveTab('chat'));
        callTab?.addEventListener('click', () => this.setActiveTab('call'));
        contactTab?.addEventListener('click', () => this.setActiveTab('contact'));

        const handleSearch = this.debounce(() => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            if (!searchTerm) {
                window[`${this.activeTab}Loader`]?.refresh?.();
                return;
            }

            if (this.activeTab === 'chat') {
                this.filterChats(searchTerm);
            } else if (this.activeTab === 'call') {
                this.filterCalls(searchTerm);
            } else if (this.activeTab === 'contact') {
                this.filterContacts(searchTerm);
            }
        }, 400);

        searchInput?.addEventListener('input', handleSearch);
    }

    setActiveTab(tab) {
        this.activeTab = tab;
    }

    // Generic fetch helper with loader handling and error management
    async fetchWithLoader(url, loader, onSuccess) {
        try {
            loader.showLoading(true);
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                onSuccess(data);
            } else {
                loader.showError(true);
            }
        } catch (err) {
            loader.showError(true);
        } finally {
            loader.hideLoading();
        }
    }

    async filterChats(searchTerm) {
        const url = `/search/recent-chats?search=${encodeURIComponent(searchTerm)}`;
        const loader = window.chatLoader;

        await this.fetchWithLoader(url, loader, (data) => {
            loader.renderChats(data.chats, true);

            if (data.chats.length) {
                loader.showChatList();
            } else {
                loader.showEmptyState();
            }
        });
    }

    async filterCalls(searchTerm) {
        const url = `/search/recent-calls?search=${encodeURIComponent(searchTerm)}`;
        const loader = window.callLoader;

        await this.fetchWithLoader(url, loader, (data) => {
            if (data.data) {
                loader.renderCalls(data.data, true);

                if (Object.keys(data.data).length > 0) {
                    loader.showCallList();
                }
            } else {
                loader.showError(true);
            }
        });
    }

    async filterContacts(searchTerm) {
        const url = `/search/contact?search=${encodeURIComponent(searchTerm)}`;
        const loader = window.contactLoader;

        await this.fetchWithLoader(url, loader, (data) => {
            loader.renderContacts(data.contacts, true);

            if (data.contacts.length) {
                loader.showContactList();

                const hash = window.location.hash;
                if (hash?.startsWith('#')) {
                    const recipientId = hash.substring(1);
                    const chatElement = document.querySelector(`.contact-chat-item[data-user-id="${recipientId}"]`);
                    if (chatElement) {
                        loadChat(recipientId.toString(), chatElement);
                    }
                }
            }
        });
    }

    // Generic toggle handler for backup settings
    async handleBackupToggle(toggleId, settingName, needsConfirmation = false) {
        const toggle = document.getElementById(toggleId);
        
        toggle?.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isChecked = toggle.checked;

            if (!isChecked && needsConfirmation) {
                const userConfirmed = await new Promise((resolve) => {
                    const modal = new bootstrap.Modal(document.getElementById('backupConfirmModal'));
                    const proceedBtn = document.getElementById('backupConfirmModalProceed');
                    
                    proceedBtn.replaceWith(proceedBtn.cloneNode(true));
                    const newProceedBtn = document.getElementById('backupConfirmModalProceed');
                    
                    newProceedBtn.onclick = () => {
                        modal.hide();
                        resolve(true);
                    };
                    
                    const modalElement = document.getElementById('backupConfirmModal');
                    const handleHide = () => {
                        modalElement.removeEventListener('hidden.bs.modal', handleHide);
                        resolve(false);
                    };
                    
                    modalElement.addEventListener('hidden.bs.modal', handleHide);
                    modal.show();
                });
                if (!userConfirmed) {
                    toggle.checked = true;
                    return;
                }
            }

            try {
                const response = await fetch(`/user/update/${toggleId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [settingName]: isChecked })
                });
                const result = await response.json();

                if (result.success) {
                    if (settingName === 'auto_chat_backup' && result.auto_chat_backup === true) {
                        window.location.href = '/auth/google/';
                    } else if (settingName === 'auto_chat_backup' && !result.auto_chat_backup) {
                        this.showNotification('Disconnected','info')
                    }
                } else {
                    this.showNotification(result.message || 'Update failed','danger');
                    return;
                }
            } catch (err) {
                this.showNotification(err.message || "Something Went Wrong", 'danger');
                toggle.checked = !isChecked;
            }
        });
    }

    // Chat Backup Toggle
    chatBackup() {
        this.handleBackupToggle('auto-backup', 'auto_chat_backup', true);
        this.handleBackupToggle('include-doc', 'include_doc_backup');
        this.handleBackupToggle('include-vid', 'include_video_backup');
    }

    // submit contact us form
    submitContact() {
        const contactUsLink = document.getElementById("contact-us");
        const contactModalEl = document.getElementById("contactModal");
        const form = document.getElementById("contactForm");

        if (!contactUsLink || !contactModalEl || !form) return;

        const contactModal = new bootstrap.Modal(contactModalEl);
        contactUsLink.addEventListener("click", (e) => {
            e.preventDefault();
            contactModal.show();
        });

        this.handleFormSubmit(
            '#contactForm',
            '/contact/submit',
            () => {
                bootstrap.Modal.getInstance(contactModalEl)?.hide();
                form.reset();
                this.showNotification("Your Form has been Sent Successfully", "success");
            },
            (error) => {
                bootstrap.Modal.getInstance(contactModalEl)?.hide();
                this.showNotification(error.message || "Failed to send message", "danger");
            }
        );
    }

    logOut() {
        const logoutBtn = document.getElementById('logoutBtn');
        const confirmLogoutBtn = document.getElementById('confirmLogout');

        if (logoutBtn && confirmLogoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const logoutModal = new bootstrap.Modal(document.getElementById('logoutModal'));
                logoutModal.show();

                confirmLogoutBtn.onclick = () => {
                    this.setButtonLoading(confirmLogoutBtn, 'Logout');

                    setTimeout(() => {
                        window.location.href = '/logout';
                    }, 500); 
                };
            });
        }
    }

    // Button loading utilities
    setButtonLoading(button, text = null) {
        if (!button) return;

        if (!button.dataset.originalHtml) {
            button.dataset.originalHtml = button.innerHTML;
        }

        const buttonText = text ?? button.textContent.trim();
        button.innerHTML = `
            ${buttonText}
            <span class="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true"></span>
        `;

        button.disabled = true;
    }

    resetButton(button) {
        if (!button || !button.dataset.originalHtml) return;

        button.innerHTML = button.dataset.originalHtml;
        button.disabled = false;
        delete button.dataset.originalHtml;
    }

    // Initialize all core functionality
    async initialize() {
        this.monitorConnection();

        const retryButton = document.getElementById('retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', this.retryConnection.bind(this));
        }

        const res = await fetch('/user/fetch/system-setting');
        this.systemSetting = await res.json();

        this.socket.emit("joinUserRoom", this.currentUserId);

        this.setupImageViewer();
        this.setupCallHandlers();
        this.startLastSeenUpdater();

        console.log('AppCore initialized successfully');
    }
}

window.appCore = new AppCore();