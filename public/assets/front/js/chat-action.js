'use strict';

class ChatManagement {
    constructor(socket, currentUserId, systemSetting) {
        this.socket = socket;
        this.currentUserId = currentUserId;
        this.systemSetting = systemSetting;
        this.selectedRecipients = new Set();
        this.DOM_CACHE = {};

        window.updateAfterClear = this.updateAfterClear.bind(this)
    }
    
    updateAfterClear() {
        const emptyChat = document.querySelector(".chatbox-container .empty-chat");
        const mainChat = document.querySelector(".main-chat-container");

        if (emptyChat) emptyChat.classList.remove("d-none");
        if (mainChat) mainChat.classList.add("d-none");

        const recentMedia = document.getElementById('recent-media');
        const mediaCount = document.getElementById('media-count');
        if (recentMedia) recentMedia.innerHTML = 'No shared images';
        if (mediaCount) mediaCount.textContent = '0';

        const recentDoc = document.getElementById('recent-document');
        const docCount = document.getElementById('document-count');
        if (recentDoc) recentDoc.innerHTML = 'No shared documents ';
        if (docCount) docCount.textContent = '0';

        const recentStarred = document.getElementById('recent-starred');
        const StarredCount = document.getElementById('starred-count');
        if (recentStarred) recentStarred.innerHTML = 'No starred messages';
        if (StarredCount) StarredCount.textContent = '0';

        const chatContainer = document.querySelector(".chatappend");
        if (chatContainer) {
            chatContainer.innerHTML = "";  
        }

        const recipientId = document.querySelector(".contact-details")?.dataset.receiverId;
        handleMessageUi(recipientId);
        if (recipientId && window.ChatCacheEntry && window.cacheManager) {
            const emptyEntry = new ChatCacheEntry(recipientId.toString());
            emptyEntry.updateContent("", 0, 0, false, false, window.chatState?.conversationType);
            cacheManager.set(recipientId.toString(), emptyEntry);
        }

        if(window.chatLoader) window.chatLoader.refresh();
    }

    // === Clear Chat Handler === 
    initClearChatHandler() {
        const modalEl = document.getElementById('clearChatModal');
        const clearChatBtn = document.getElementById('clear-chat');
        
        if (!modalEl || !clearChatBtn) return;

        clearChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        });

        const clearForMeBtn = document.getElementById("clear-for-me");
        if (clearForMeBtn) {
            clearForMeBtn.addEventListener("click", (e) => {
                e.preventDefault();
                
                setButtonLoading(clearForMeBtn, clearForMeBtn.textContent.trim());
            
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            
                const contactDetails = document.querySelector('.contact-details');
                const receiverId = contactDetails?.dataset.receiverId;
            
                if (!receiverId) {
                    resetButton(clearForMeBtn);
                    return;
                }
            
                this.socket.emit('clear-chat-for-me', {
                    senderId: this.currentUserId,
                    receiverId: receiverId
                });

                resetButton(clearForMeBtn);
            });
        }
    }

    // === Export Chat Handler === 
    initExportChatHandler() {
        const modalEl = document.getElementById('exportChatModal');
        const exportChatBtn = document.getElementById('export-chat');
        
        if (!modalEl || !exportChatBtn) return;

        exportChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        });

        const confirmExportBtn = document.getElementById('confirmExportBtn');
        if (confirmExportBtn) {
            confirmExportBtn.addEventListener('click', async () => {
                const exportModal = bootstrap.Modal.getInstance(document.getElementById('exportChatModal'));
                try {
                    setButtonLoading(confirmExportBtn, 'Exporting');

                    const recipientId = document.querySelector('.contact-details')?.dataset.receiverId;
                    if (!recipientId) {
                        showNotification('Cannot identify the conversation. Please try again.','danger');
                        resetButton(confirmExportBtn);
                        return;
                    }

                    const response = await fetch(`/chat/export?recipientId=${recipientId}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/plain'
                        },
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        showNotification(`Export failed: ${response.status}`,'danger');
                        resetButton(confirmExportBtn);
                        return;
                    }

                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const contentDisposition = response.headers.get('Content-Disposition');
                    let filename = 'chat_export.txt';
                    
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                        if (filenameMatch) filename = filenameMatch[1];
                    }

                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    
                    window.URL.revokeObjectURL(downloadUrl);
                    exportModal.hide();

                    showNotification('Chat Exported Successfully','success');
                } catch (error) {
                    exportModal?.hide();
                    showNotification(error.message || 'Something Went Wrong','danger');
                } finally {
                    resetButton(confirmExportBtn);
                }
            });
        }
    }

    // === Report Contact Handler ===
    async initReportContact() {
        const reportContactBtn = getElement("#report-contact");
        if (!reportContactBtn) return;

        let currentReportedUserId = null;
        let shouldOpenReasonModal = false;

        reportContactBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const recipientId = getElement(".contact-details")?.dataset.receiverId;
            if (!recipientId) {
                showNotification("Cannot identify the contact to report.", "danger");
                return;
            }
            currentReportedUserId = recipientId;
            new bootstrap.Modal(getElement("#reportModal")).show();
        });

        getElement("#confirmReport")?.addEventListener("click", () => {
            shouldOpenReasonModal = true;
            bootstrap.Modal.getInstance(getElement("#reportModal"))?.hide();
        });

        getElement("#reportModal")?.addEventListener("hidden.bs.modal", () => {
            if (!shouldOpenReasonModal) return;
            shouldOpenReasonModal = false;

            getElement("#reportUserId").value = currentReportedUserId || "";
            const typeSelect = getElement('select[name="reportType"]');
            const descField = getElement('textarea[name="description"]');
            if (typeSelect) typeSelect.value = "";
            if (descField) descField.value = "";

            new bootstrap.Modal(getElement("#reportUserModal")).show();
        });

        getElement("#submitReport")?.addEventListener("click", async () => {
            const btn = getElement("#submitReport");
            const originalText = btn.innerHTML;
            const reasonModal = bootstrap.Modal.getInstance(getElement("#reportUserModal"));

            const formData = {
                reportedUserId: getElement("#reportUserId")?.value,
                reportType: getElement('select[name="reportType"]')?.value,
                description: getElement('textarea[name="description"]')?.value
            };

            if (!formData.reportType) {
                reasonModal?.hide();
                showNotification("Please select a reason for reporting", "danger");
                return;
            }
            if (formData.reportType === "other" && (!formData.description || formData.description.trim().length < 10)) {
                reasonModal?.hide();
                showNotification(
                    'Please provide more details when selecting "Other" (at least 10 characters)',
                    "danger"
                );
                return;
            }

            try {
                btn.innerHTML = `${originalText}<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`;
                btn.disabled = true;

                const result = await makeApiCall("/user/report", {
                    method: "POST",
                    credentials: "include",
                    body: JSON.stringify(formData)
                });

                reasonModal?.hide();

                if (!result) showNotification(result?.message || "An error occurred", "danger");
                else showNotification("Report submitted successfully! Our team will review it shortly.","success");

            } catch (err) {
                showNotification(err.message || "Failed to submit report. Please try again.","danger");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // === Bulk Chat Actions (Clear All, Archive All, Delete All) ===
    initBulkChatAction({ buttonSelector, apiEndpoint, loadingText, successMessage, failureMessage, afterSuccess = () => {} }) {
        const btn = getElement(buttonSelector);
        if (!btn) return;

        btn.addEventListener('click', async () => {
            const originalHtml = btn.innerHTML;

            try {
                btn.innerHTML = `
                    ${loadingText}
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                `;
                btn.disabled = true;

                const result = await makeApiCall(apiEndpoint, {
                    method: 'POST',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });

                if (result.success) {
                    const closeBtn = btn.closest('.modal')?.querySelector('.btn-close');
                    if (closeBtn) closeBtn.click();

                    afterSuccess(result);

                    showNotification(successMessage, 'success');
                } else {
                    showNotification(failureMessage, 'danger');
                }
            } catch (error) {
                showNotification(error.message || failureMessage, 'danger');
            } finally {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                btn.removeAttribute('aria-disabled');
            }
        });
    }

    // Initialize Functions
    initClearAllChat() {
        this.initBulkChatAction({
            buttonSelector: '#confirmClearChat',
            apiEndpoint: '/clear-all',
            loadingText: 'Clearing...',
            successMessage: 'All chats cleared successfully',
            failureMessage: 'Failed to clear chats',
            afterSuccess: () => this.updateAfterClear()
        });
    }

    initArchiveAllChat() {
        this.initBulkChatAction({
            buttonSelector: '#confirmarchiveChat',
            apiEndpoint: '/chat/archive/all',
            loadingText: 'Archiving...',
            successMessage: 'Chats archived successfully',
            failureMessage: 'Failed to archive chats',
            afterSuccess: (result) => {
                if (window.chatLoader) window.chatLoader.refresh();
                if (window.archiveChatLoader) window.archiveChatLoader.refresh();
                showNotification(`${result.archivedCount || 'All'} chats archived.`, 'success');
            }
        });
    }

    initDeleteAllChat() {
        this.initBulkChatAction({
            buttonSelector: '#confirmDeleteChat',
            apiEndpoint: '/chat/delete/all',
            loadingText: 'Deleting...',
            successMessage: 'All chats deleted from your view.',
            failureMessage: 'Failed to delete chats',
            afterSuccess: () => {
                this.updateAfterClear();
                if (window.chatLoader) window.chatLoader.refresh();
                if (window.contactLoader) window.contactLoader.refresh();
                if (window.friendsLoader) window.friendsLoader.refresh();

                const blankTab = document.querySelector('#blank');
                const chattingTab = document.querySelector('#chatting');
                const replyChat = document.querySelector('.reply-chat');
                
                if (blankTab) blankTab.classList.add('active');
                if (chattingTab) chattingTab.classList.remove('active');
                if (replyChat) replyChat.classList.add('d-none');
                
                window.history.replaceState(null, "", "/messenger");
            }
        });
    }

    initialize() {
        this.initClearChatHandler();
        this.initExportChatHandler();
        this.initReportContact();
        this.initClearAllChat();
        this.initArchiveAllChat();
        this.initDeleteAllChat();
    }
}