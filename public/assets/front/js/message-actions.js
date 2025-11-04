'use strict';

class MessageActions {
    constructor(socket, currentUserId) {
        this.socket = socket;
        this.currentUserId = currentUserId;
        this.QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
        this.reactionSystemInitialized = false;
        this.touchTimer = null;
        this.touchStartTime = null;
        this.currentPickerMessageId = null;
        this.selectedRecipients = new Set();
        this.DOM_CACHE = {};

        window.updateReactionCounts = this.updateReactionCounts.bind(this);
    }

    // Initialize reaction system
    initializeReactions() {
        if (this.reactionSystemInitialized) return;
        this.setupReactionListeners();
        this.reactionSystemInitialized = true;
    }

    setupReactionListeners() {
        document.removeEventListener("click", this.handleReactionClick.bind(this));
        document.removeEventListener("contextmenu", this.handleReactionMenu.bind(this));
        document.removeEventListener("touchstart", this.handleTouchStart.bind(this));
        document.removeEventListener("touchend", this.handleTouchEnd.bind(this));

        document.addEventListener("click", this.handleReactionClick.bind(this), true);
        document.addEventListener("contextmenu", this.handleReactionMenu.bind(this), true);
        document.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener("touchend", this.handleTouchEnd.bind(this), { passive: false });

        document.addEventListener("click", this.handleGlobalClick.bind(this));
        document.addEventListener("keydown", this.handleEscapeKey.bind(this));
    }

    handleTouchStart(e) {
        const messageElement = e.target.closest("[data-msg-id]");
        if (!messageElement) return;

        if (e.target.closest("button, a, audio, .reaction-count")) return;

        this.touchStartTime = Date.now();
        this.touchTimer = setTimeout(() => {
            e.preventDefault();
            const messageId = messageElement.getAttribute("data-msg-id");
            this.showMessageOptions(messageElement, e.touches[0], messageId);
        }, 500);
    }

    handleTouchEnd(e) {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    handleReactionClick(e) {
        const target = e.target;
        if (!target) return;

        if(target.closest(".reaction-count")?.getAttribute('data-is-blocked') === "true") return;
        
        if (target.classList.contains("quick-reaction") ||
            target.classList.contains("menu-toggle") ||
            target.closest(".menu-toggle") ||
            target.classList.contains("message-option") ||
            target.closest(".message-option") ||
            target.classList.contains("reaction-count") ||
            target.closest(".reaction-count") ||
            target.classList.contains("reaction-btn") ||
            target.closest(".reaction-btn") ||
            target.closest(".forward-contact")
        ) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        
        if (target.classList.contains("quick-reaction")) {
            return this.toggleReaction(target.dataset.messageId, target.dataset.emoji);
        }

        if (target.classList.contains("menu-toggle") || target.closest(".menu-toggle")) {
            const picker = target.closest(".message-options-picker");
            picker?.querySelector(".options-dropdown")?.classList.toggle("hidden");
            return;
        }

        // === Message Options ===
        const optionElement = target.closest(".message-option");
        if (optionElement) {
            const { action, messageId } = optionElement.dataset;
            if (!action || !messageId) return;

            switch (action) {
                case "copy":   return this.handleCopy(messageId);
                case "star":
                case "unstar": return this.handleStar(messageId, action === "star");
                case "edit":   return this.handleEdit(messageId);
                case "reply":  return this.handleReply(messageId);
                case "delete": return this.handleDelete(messageId);
                case "forward":return this.handleForward(messageId);
            }
            this.removeMessageOptions();
            return;
        }

        const forwardContact = target.closest(".forward-contact");
        if (forwardContact) {
            return this.toggleForwardRecipient(forwardContact);
        }

        const reactionElement = target.closest(".reaction-count");
        if (reactionElement) {
            return this.toggleReaction(reactionElement.dataset.messageId, reactionElement.dataset.emoji);
        }

        if (target.classList.contains("reaction-btn") || target.closest(".reaction-btn")) {
            const messageElement = target.closest("[data-msg-id]");
            const messageId = messageElement?.dataset.msgId;
            if (!messageId) return;

            if (this.currentPickerMessageId === messageId) {
                this.removeMessageOptions();
            } else {
                this.showMessageOptions(messageElement, e, messageId);
            }
            return;
        }
    }

    /* === Message Action Handlers === */
    handleCopy(messageId) {
        const el = document.querySelector(`.message-content[data-message-id="${messageId}"]`);
        if (!el) return showNotification(`No message content found for ID ${messageId}`, "danger");

        const messageText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
            .map((n) => n.textContent.trim())[0];

        if (!messageText) return;

        const inputField = document.getElementById("message-input");
        if (inputField) {
            inputField.value = messageText;
            inputField.focus();
        }

        navigator.clipboard.writeText(messageText).catch((err) =>
            showNotification(err.message || "Clipboard copy failed", "danger")
        );

        showNotification("Message copied to clipboard!", "success");
        this.removeMessageOptions();
    }

    async handleStar(messageId, shouldStar) {
        try {
            const response = await fetch(`/messages/${messageId}/star`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
                body: JSON.stringify({ starred: shouldStar }),
            });

            if (!response.ok) throw new Error(`Failed to ${shouldStar ? "star" : "unstar"} message`);
            
            const data = await response.json();
            this.updateMessageStarUI(messageId, shouldStar);
            const el = document.querySelector(`.msg-setting-main[data-msg-id="${messageId}"]`);
            if (el) el.dataset.msgStarred = data.action === "starred" ? "true" : "";
            this.refreshMessageOptions(messageId);
        } catch (err) {
            showNotification(err.message, "danger");
        }
    }

    handleEdit(messageId) {
        this.removeMessageOptions();
        
        const el = document.querySelector(`.message-content[data-message-id="${messageId}"]`);
        if (!el) return;
        const originalText = el.childNodes[0]?.textContent?.trim() || "";
        const time = el.querySelector("p")?.textContent || "";
        el.dataset.time = time;
        el.innerHTML = `
            <input type="text" class="edit-message-input" value="${originalText}" />
            <button class="save-edit-btn" data-message-id="${messageId}" title="Save">
                <i class="fa fa-check-circle"></i>
            </button>
        `;
    }

    handleReply(messageId) {
        this.removeMessageOptions();
        
        const el = document.querySelector(`.message-content[data-message-id="${messageId}"]`);
        if (!el) return;

        const senderName = el.dataset.messageSender || "Unknown";
        const messageText = el.dataset.messageText || "";
        const messageType = el.dataset.messageType || "";

        const replyBox = document.querySelector(".reply");
        if (replyBox) {
            replyBox.classList.remove("reply-hidden");
            replyBox.classList.add("reply-active");
            replyBox.querySelector("h5").textContent = senderName;
            replyBox.querySelector("p").innerHTML = this.formatReplyPreview(messageType, messageText);
            replyBox.dataset.replyTo = messageId;
        }

        document.getElementById("message-input")?.focus();
    }

    handleDelete(messageId) {
        const modalEl = document.getElementById("deleteModal");
        modalEl.dataset.messageId = messageId;
        new bootstrap.Modal(modalEl).show();
    }

    handleForward(messageId) {
        const modalEl = document.getElementById("forward-message");
        if (!modalEl) return;
        modalEl.dataset.messageId = messageId;
        this.selectedRecipients.clear();

        document.querySelectorAll(".forward-contact.selected").forEach((el) => {
            el.classList.remove("selected");
            el.querySelector(".tick-icon")?.style.setProperty("display", "none");
        });

        new bootstrap.Modal(modalEl).show();
    }

    toggleForwardRecipient(forwardContact) {
        const userId = forwardContact.dataset.to;
        const tick = forwardContact.querySelector(".tick-icon");

        if (this.selectedRecipients.has(userId)) {
            this.selectedRecipients.delete(userId);
            forwardContact.classList.remove("selected");
            if (tick) tick.style.display = "none";
        } else {
            this.selectedRecipients.add(userId);
            forwardContact.classList.add("selected");
            if (tick) tick.style.display = "block";
        }
    }

    formatReplyPreview(type, text) {
        const fileNameFromUrl = (url) => url.split("/").pop().split("?")[0];
        switch (type) {
            case "image":
            case "sticker": return `<img class="img-fluid" src="${text}" alt="📷 Photo" loading="lazy">`;
            case "document":
                const fileName = fileNameFromUrl(text);
                return `<div class="d-flex align-items-center gap-2">${this.getFileIcon(null, fileName)}<span class="file-name small">${fileName}</span></div>`;
            case "video": return `<video class="replied-video" src="${text}"></video>`;
            case "audio": return `<div class="audiomessage"><div class="call-bg"><div class="aligns"><audio controls preload="none"><source src="${text}" type="audio/webm" /></audio></div></div></div>`;
            default: return text;
        }
    }

    getFileIcon(fileType, fileName) {
        const fileExt = fileName.split(".").pop().toLowerCase();
        
        if (fileExt === "pdf") {
            return '<i class="fa fa-file-pdf-o font-danger"></i>';
        } else if (["doc", "docx"].includes(fileExt)) {
            return '<i class="fa fa-file-word-o font-primary"></i>';
        } else if (["xls", "xlsx"].includes(fileExt)) {
            return '<i class="fa fa-file-excel-o font-success"></i>';
        } else if (["ppt", "pptx"].includes(fileExt)) {
            return '<i class="fa fa-file-powerpoint-o font-warning"></i>';
        } else if (fileExt === "txt") {
            return '<i class="fa fa-file-text-o font-info"></i>';
        } else if (["zip", "rar", "7z"].includes(fileExt)) {
            return '<i class="fa fa-file-archive-o font-secondary"></i>';
        } else if (["mp3", "wav", "ogg"].includes(fileExt)) {
            return '<i class="fa fa-file-audio-o font-info"></i>';
        } else if (["mp4", "avi", "mov", "mkv"].includes(fileExt)) {
            return '<i class="fa fa-file-video-o font-warning"></i>';
        } else if (["jpg", "jpeg", "png", "gif", "svg"].includes(fileExt)) {
            return '<i class="fa fa-file-image-o font-primary"></i>';
        } else {
            return '<i class="fa fa-file-o font-dark"></i>';
        }
    }

    // Helper function to update message bubble UI
    updateMessageStarUI(messageId, isStarred) {
        const messageContentEl = document.querySelector(`.message-content[data-message-id="${messageId}"]`);
        
        if (!messageContentEl) return;
        let starIcon = messageContentEl.querySelector(".starred-icon");
        
        if (isStarred) {
            if (!starIcon) {
                starIcon = document.createElement("i");
                starIcon.classList.add("fa", "fa-star", "starred-icon");
                messageContentEl.appendChild(starIcon);
            }
        } else {
            if (starIcon) {
                starIcon.remove();
            }
        }
    }

    refreshMessageOptions(messageId) {
        const existingPicker = document.querySelector(`.message-options-picker[data-message-id="${messageId}"]`);
        if (existingPicker) existingPicker.remove();
        
        const messageElement = document.querySelector(`.msg-setting-main[data-msg-id="${messageId}"]`);
        if (messageElement) {
            this.showMessageOptions(messageElement, null, messageId);
        }
        this.removeMessageOptions();
    }

    handleReactionMenu(e) {
        const messageElement = e.target.closest("[data-msg-id]");
        if (messageElement && !e.target.closest("button, a, .deleted-msg, .reaction-count, .voicecall, .videocall")) {
            e.preventDefault();
            const messageId = messageElement.getAttribute("data-msg-id");
            this.showMessageOptions(messageElement, e, messageId);
        }
    }

    handleGlobalClick(e) {
        const messageOptions = document.querySelector(".message-options-picker");
        const emojiPicker = document.querySelector(".emoji-picker-modal");

        if (messageOptions && !messageOptions.contains(e.target) &&
            !e.target.closest(".reaction-btn") && !e.target.classList.contains("reaction-btn")) {
            this.removeMessageOptions();
        }

        if (emojiPicker && e.target.classList.contains("emoji-picker-backdrop")) {
            emojiPicker.remove();
        }
    }

    handleEscapeKey(e) {
        if (e.key === "Escape") {
            this.removeMessageOptions();
            const emojiPicker = document.querySelector(".emoji-picker-modal");
            if (emojiPicker) {
                emojiPicker.remove();
            }
        }
    }

    // Show message options with two-level design
    showMessageOptions(messageElement, event, messageId) {
        if (!messageId) return;

        this.removeMessageOptions();
        this.currentPickerMessageId = messageId;

        const isSentByCurrentUser = !!messageElement.closest("li.sent");
        const messageType = messageElement.dataset.msgType;
        const isStarred = messageElement.dataset.msgStarred === "true";
        const actions = [];

        actions.push(`
            <button class="message-option" data-action="reply" data-message-id="${messageId}">
                <i data-feather="corner-up-left"></i><span>Reply</span>
            </button>
        `);

        if (messageType !== "call") {
            actions.push(`
                <button class="message-option" data-action="forward" data-message-id="${messageId}">
                    <i data-feather="share"></i><span>Forward</span>
                </button>
            `);
        }

        if (messageType === "text") {
            actions.push(`
                <button class="message-option" data-action="copy" data-message-id="${messageId}">
                    <i data-feather="copy"></i><span>Copy</span>
                </button>
            `);
        }

        if (messageType !== "sticker") {
            actions.push( isStarred
                ? `
                    <button class="message-option" data-action="unstar" data-message-id="${messageId}">
                        <i class="fa fa-star starred-icon"></i><span>Unstar</span>
                    </button>
                `
                : `
                    <button class="message-option" data-action="star" data-message-id="${messageId}">
                        <i data-feather="star"></i><span>Star</span>
                    </button>
                `
            );
        }

        if (!isSentByCurrentUser && messageType === "text") {
            actions.push(`
                <button class="message-option" data-action="edit" data-message-id="${messageId}">
                    <i data-feather="edit"></i><span>Edit</span>
                </button>
            `);
        }

        if (!isSentByCurrentUser) {
            actions.push(`
                <button class="message-option delete-option" data-action="delete" data-message-id="${messageId}">
                    <i data-feather="trash-2"></i><span>Delete</span>
                </button>
            `);
        }

        const picker = document.createElement("div");
        picker.className = "message-options-picker";
        picker.dataset.messageId = messageId;
        picker.innerHTML = `
            <div class="emoji-quick-bar">
                ${this.QUICK_REACTIONS.map(
                    (emoji) => `
                    <button class="quick-reaction" data-emoji="${emoji}" data-message-id="${messageId}">
                        ${emoji}
                    </button>`
                ).join("")}
                <button class="more-reactions" data-message-id="${messageId}" title="More reactions">
                    <i data-feather="plus"></i>
                </button>
                <button class="menu-toggle" data-message-id="${messageId}" title="Options">
                    <i data-feather="more-horizontal"></i>
                </button>
            </div>
            <div class="options-dropdown hidden">
                <div class="message-actions">${actions.join("")}</div>
            </div>
        `;

        messageElement.style.position = "relative";
        messageElement.appendChild(picker);

        if (document.documentElement.classList.contains("dark") || document.body.classList.contains("dark")) {
            picker.querySelector(".emoji-quick-bar")?.classList.add("dark");
            picker.querySelector(".options-dropdown")?.classList.add("dark");
        }

        picker.querySelector(".menu-toggle")?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            picker.querySelector(".options-dropdown")?.classList.toggle("hidden");
        });

        picker.querySelector(".more-reactions")?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showEmojiPicker(messageId, e);
        });

        setTimeout(() => {
            if (document.body.contains(picker) && this.currentPickerMessageId === messageId) {
                this.removeMessageOptions();
            }
        }, 8000);
    }

    removeMessageOptions() {
        const existingPickers = document.querySelectorAll(".message-options-picker");
        existingPickers.forEach(picker => {
            if (picker.parentNode) {
                picker.remove();
            }
        });
        this.currentPickerMessageId = null;
    }

    showEmojiPicker(messageId, event) {
        const commonEmojis = ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "🤬", "🤯", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "👍", "👎", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💯"];

        this.removeMessageOptions();

        const picker = document.createElement("div");
        picker.className = "emoji-picker-modal";
        picker.innerHTML = `
            <div class="emoji-picker-backdrop"></div>
            <div class="emoji-picker-content">
                <div class="emoji-picker-header">
                    <h4>Choose a reaction</h4>
                    <button class="close-emoji-picker" type="button">&times;</button>
                </div>
                <div class="emoji-grid custom-scroll">
                    ${commonEmojis
                    .map(
                        (emoji) =>
                            `<button class="emoji-option" data-emoji="${emoji}" data-message-id="${messageId}" type="button">
                                ${emoji}
                            </button>`
                    )
                    .join("")}
                </div>
            </div>
        `;

        document.body.appendChild(picker);

        // Handle emoji selection
        picker.addEventListener("click", (e) => {
            if (e.target.classList.contains("emoji-option")) {
                const emoji = e.target.getAttribute("data-emoji");
                const msgId = e.target.getAttribute("data-message-id");
                this.toggleReaction(msgId, emoji);
                picker.remove();
            } else if (e.target.classList.contains("close-emoji-picker") || e.target.classList.contains("emoji-picker-backdrop")) {
                picker.remove();
            }
        });
    }

    // Toggle reaction with proper counting logic
    async toggleReaction(messageId, emoji) {
        if (!messageId || !emoji) {
            showNotification('Missing messageId or emoji','danger');
            return;
        }

        try {
            this.removeMessageOptions();

            const response = await fetch("/messages/toggle-reaction", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messageId: parseInt(messageId),
                    emoji: emoji,
                }),
            });

            if (!response.ok) {
                showNotification(`HTTP error! status: ${response.status}`,'danger');
                return;
            }

            const data = await response.json();

            if (data.success) {
                if (data.reactionCounts) {
                    this.updateReactionCounts(messageId, data.reactionCounts);
                } else {
                    this.updateReactionUI(messageId, data.reaction, data.action);
                }

                const recipientId = document.querySelector('.contact-details')?.dataset.receiverId;
                if (typeof handleMessageUi === 'function') {
                    handleMessageUi(recipientId);
                }

                if (typeof this.socket !== "undefined" && this.socket.connected) {
                    this.socket.emit("reactionUpdate", {
                        messageId: parseInt(messageId),
                        emoji: emoji,
                        action: data.action,
                        userId: data.reaction?.user_id,
                        reactionCounts: data.reactionCounts,
                    });
                }
            } else {
                showNotification(data.error || "Something Went Wrong", 'danger');
                return;
            }
        } catch (error) {
            showNotification(error.message || "Something Went Wrong", 'danger');
            return;
        }
    }

    // Update reaction UI (simple version - for fallback)
    updateReactionUI(messageId, reaction, action) {
        const messageElement = document.querySelector(`[data-msg-id="${messageId}"]`);
        if (!messageElement) return;

        let reactionsContainer = messageElement.querySelector(".message-reactions");

        if (!reactionsContainer && action === "added") {
            reactionsContainer = document.createElement("div");
            reactionsContainer.className = "message-reactions";

            if (messageElement) {
                messageElement.appendChild(reactionsContainer);
            }
        }

        if (!reactionsContainer) return;

        if (action === "added") {
            this.addOrUpdateReactionCount(reactionsContainer, reaction, messageId);
        } else if (action === "removed") {
            this.removeReactionCount(reactionsContainer, reaction.emoji, messageId);
        }
    }

    addOrUpdateReactionCount(container, reaction, messageId) {
        let reactionElement = container.querySelector(`[data-emoji="${reaction.emoji}"]`);

        if (reactionElement) {
            const countElement = reactionElement.querySelector(".count");
            const currentCount = parseInt(countElement.textContent) || 0;
            countElement.textContent = currentCount + 1;

            if (reaction.user_id === this.currentUserId) {
                reactionElement.classList.add("user-reacted");
            }
        } else {
            reactionElement = document.createElement("div");
            reactionElement.className = "reaction-count";
            reactionElement.setAttribute("data-emoji", reaction.emoji);
            reactionElement.setAttribute("data-message-id", messageId);

            if (reaction.user_id === this.currentUserId) {
                reactionElement.classList.add("user-reacted");
            }

            reactionElement.innerHTML = `
                <span class="emoji">${reaction.emoji}</span>
                <span class="count">1</span>
            `;

            container.appendChild(reactionElement);
        }
    }

    // Remove reaction count
    removeReactionCount(container, emoji, messageId) {
        const reactionElement = container.querySelector(`[data-emoji="${emoji}"]`);

        if (reactionElement) {
            const countElement = reactionElement.querySelector(".count");
            const currentCount = parseInt(countElement.textContent) || 0;

            if (currentCount <= 1) {
                reactionElement.remove();

                if (container.children.length === 0) container.remove();
            } else {
                countElement.textContent = currentCount - 1;
                reactionElement.classList.remove("user-reacted");
            }
        }
    }

    updateReactionCounts(messageId, reactionCounts) {
        const messageElement = document.querySelector(`[data-msg-id="${messageId}"]`);
        if (!messageElement) return;

        let reactionsContainer = messageElement.querySelector(".message-reactions");

        if (reactionCounts.length === 0) {
            if (reactionsContainer) {
                reactionsContainer.remove();
            }
            return;
        }

        if (!reactionsContainer) {
            reactionsContainer = document.createElement("div");
            reactionsContainer.className = "message-reactions";

            if (messageElement) {
                messageElement.appendChild(reactionsContainer);
            }
        }

        reactionsContainer.innerHTML = "";
        reactionCounts.forEach(({ emoji, count, userReacted, users }) => {
            const reactionElement = document.createElement("div");
            reactionElement.className = `reaction-count ${userReacted ? "user-reacted" : ""}`;
            reactionElement.setAttribute("data-emoji", emoji);
            reactionElement.setAttribute("data-message-id", messageId);

            if (users && users.length > 0) {
                const names = users.map((u) => u.name).slice(0, 3);
                let tooltip = names.join(", ");
                if (users.length > 3) {
                    tooltip += ` and ${users.length - 3} others`;
                }
                reactionElement.setAttribute("title", tooltip);
            }

            reactionElement.innerHTML = `
                <span class="emoji">${emoji}</span>
                <span class="count">${count}</span>
            `;

            reactionsContainer.appendChild(reactionElement);
        });
    }

    initialize() {
        this.initializeReactions();
        this.setupAdditionalEventListeners();
    }

    setupAdditionalEventListeners() {
        document.addEventListener("click", async (e) => {
            const target = e.target;
            
            const editBtn = target.closest(".save-edit-btn");
            if (editBtn) {
                await this.saveEditedMessage(editBtn);
                return;
            }
            
            if (target.matches('[data-action="delete-for-me"], [data-action="delete-for-everyone"]')) {
                await this.deleteMessage(target);
                return;
            }
        });

        document.getElementById("forwardSubmitBtn")?.addEventListener("click", async () => {
            await this.handleForwardSubmit();
        });

        document.querySelector(".cancel-reply")?.addEventListener("click", () => {
            const replyBox = document.querySelector(".reply");
            if (replyBox) {
                replyBox.classList.remove("reply-active")
                replyBox.classList.add("reply-hidden");
                delete replyBox.dataset.replyTo;
            }
        });
    }

    async saveEditedMessage(editBtn) {
        const messageId = editBtn.dataset.messageId;
        const input = editBtn.previousElementSibling;
        const updatedText = input?.value.trim();
        if (!updatedText) return;

        try {
            const res = await fetch(`/messages/${messageId}/edit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: updatedText }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Update failed");

            const messageEl = document.querySelector(`.message-content[data-message-id="${messageId}"]`);
            if (messageEl) {
                const time = messageEl.dataset.time || "";
                messageEl.innerHTML = `
                    ${updatedText}
                    <small class="edited-label">(edited)</small>
                    <p>${time}</p>
                `;
            }
        } catch (err) {
            showNotification(err.message || "Error updating message", "danger");
        }
    }

    async deleteMessage(actionEl) {
        const modalEl = document.getElementById("deleteModal");
        const messageId = modalEl?.dataset.messageId;
        const deleteType = actionEl.dataset.action;
        if (!messageId || !deleteType) return;

        try {
            const res = await fetch(`/messages/${messageId}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: deleteType }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || "Delete failed");

            bootstrap.Modal.getInstance(modalEl)?.hide();
            const messageEl = document.querySelector(`.msg-setting-main[data-msg-id="${messageId}"]`);

            if (deleteType === "delete-for-me") {
                if (messageEl) {
                    const messageItem = messageEl.closest(".msg-setting-main");
                    const msgBox = messageItem?.closest(".msg-box");
                    messageItem?.remove();

                    const remainingMessages = msgBox?.querySelectorAll(".msg-setting-main");
                    if (!remainingMessages || remainingMessages.length === 0) {
                        const groupBlock = msgBox?.closest("li.sent, li.replies");
                        groupBlock?.remove();
                    }
                }
            } else {
                if (window.chatLoader) window.chatLoader.refresh();
                if (messageEl) {
                    messageEl.classList.add("deleted-msg");
                    messageEl.innerHTML = `
                        <div class="deleted-message">
                            <i class="fa fa-trash text-muted"></i>
                            <span class="text-muted">This message is deleted</span>
                        </div>
                    `;
                }
            }
        } catch (err) {
            showNotification(err.message || "Internal Server Error", "danger");
        }
    }

    async handleForwardSubmit() {
        const forwardBtn = document.getElementById("forwardSubmitBtn");
        const modalEl = document.getElementById("forward-message");
        const messageId = modalEl?.dataset.messageId;
        const bootstrapModal = bootstrap.Modal.getInstance(modalEl);

        if (!messageId || this.selectedRecipients.size === 0) {
            showNotification("Please select at least one contact to forward the message.", 'danger');
            return;
        }

        setButtonLoading(forwardBtn,'Forward');

        try {
            const res = await fetch("/messages/forward", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messageId: parseInt(messageId),
                    recipientIds: Array.from(this.selectedRecipients),
                }),
            });

            const data = await res.json();
            if (data.success) {
                bootstrapModal.hide();
                showNotification("Message Forwarded Successfully", 'success');
                return;
            } else {
                bootstrapModal.hide();
                showNotification(data.error || "Something Went Wrong", 'danger');
                return;
            }
        } catch (err) {
            bootstrapModal.hide();

            showNotification(err.message || "Something Went Wrong", 'danger');
            return;
        } finally {
            resetButton(forwardBtn)
        }
    }
}