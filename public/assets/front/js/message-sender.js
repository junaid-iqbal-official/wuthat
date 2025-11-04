'use strict';

class MessageSender {
    constructor(socket, currentUserId, systemSetting) {
        this.socket = socket;
        this.currentUserId = currentUserId;
        this.systemSetting = systemSetting;
        this.selectedFiles = [];
        this.isDragActive = false;
        this.typingTimer = null;
        this.typingInterval = 1500;
        this.DOM_CACHE = {};

        window.appendMessage = this.appendMessage.bind(this);
    }
    
    // === File Upload Setup ===
    setupFileUpload() {
        const fileInput = document.getElementById("file-input");
        const documentInput = document.getElementById("document-input");
        const anyFileInput = document.getElementById("any-file-input");
        const clearFilesBtn = document.getElementById("clear-files");

        [fileInput, documentInput, anyFileInput].forEach((input) => {
            if (input) {
                input.addEventListener("change", (e) => {
                    this.handleFileSelection(Array.from(e.target.files));
                    input.value = ""; 
                });
            }
        });

        if (clearFilesBtn) {
            clearFilesBtn.addEventListener("click", () => {
                this.clearSelectedFiles();
            });
        }
    }

    // === Drag and Drop Setup ===
    setupDragAndDrop() {
        const chatContainer = document.querySelector(".chatbox-container");
        const dragOverlay = document.getElementById("drag-overlay");
        if (!chatContainer || !dragOverlay) return;

        let dragCounter = 0;
        let dragTimer = null;

        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const resetDragState = () => {
            dragCounter = 0;
            this.isDragActive = false;
            dragOverlay.classList.add("d-none");
            chatContainer.classList.remove("drag-active");
            document.body.classList.remove("drag-mode");
            if (dragTimer) {
                clearTimeout(dragTimer);
                dragTimer = null;
            }
        };

        const showDragOverlay = () => {
            if (!this.isDragActive) {
                this.isDragActive = true;
                dragOverlay.classList.remove("d-none");
                chatContainer.classList.add("drag-active");
                document.body.classList.add("drag-mode");
            }
        };

        ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) =>
            document.addEventListener(evt, preventDefaults, false)
        );

        document.addEventListener("dragenter", (e) => {
            if (e.dataTransfer?.types.includes("Files")) {
                dragCounter++;
                if (dragCounter === 1) showDragOverlay();
                if (dragTimer) {
                    clearTimeout(dragTimer);
                    dragTimer = null;
                }
            }
        });

        document.addEventListener("dragover", (e) => {
            if (e.dataTransfer?.types.includes("Files")) {
                e.dataTransfer.dropEffect = "copy";
            }
        });

        document.addEventListener("dragleave", (e) => {
            if (e.dataTransfer?.types.includes("Files")) {
                dragCounter--;
                dragTimer = setTimeout(() => {
                    if (dragCounter <= 0) resetDragState();
                }, 50);
            }
        });

        document.addEventListener("drop", (e) => {
            if (e.dataTransfer?.types.includes("Files")) {
                resetDragState();

                const isInChatArea = chatContainer.contains(e.target) || chatContainer === e.target || dragOverlay.contains(e.target);
                if (isInChatArea) {
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length) this.handleFileSelection(files);
                }
            }
        });

        document.addEventListener("paste", (e) => {
            if (e.clipboardData?.items) {
                const files = Array.from(e.clipboardData.items)
                    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
                    .map((item) => item.getAsFile()).filter(Boolean);

                if (files.length) {
                    e.preventDefault();
                    this.handleFileSelection(files);
                }
            }
        });

        window.addEventListener("blur", resetDragState);
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) resetDragState();
        });
    }

    // === Handle File Selection ===
    handleFileSelection(files) {
        if (!files || files.length === 0) return;

        if (this.selectedFiles.length + files.length > 10) {
            showNotification("Too much files",'danger');
            return;
        }

        for (const file of files) {
            if (!this.validateFileSize(file)) {
                return;
            }
        }

        this.selectedFiles.push(...files);
        this.updateFilePreview();
        this.showFilePreviewArea();
    }

    // === Validate File Size ===
    validateFileSize(file) {
        const fileSizeLimits = {
            image: 10 * 1024 * 1024,
            audio: 50 * 1024 * 1024,
            video: 100 * 1024 * 1024,
            document: 25 * 1024 * 1024,
            file: 25 * 1024 * 1024,
        };

        const fileType = this.getFileTypeFromMime(file.type);
        const maxSize = fileSizeLimits[fileType] || fileSizeLimits.file;

        if (file.size > maxSize) {
            showNotification(`${file.name} is too large. Maximum size for ${fileType} files is ${this.formatFileSize(maxSize)}`,'danger');
            return false;
        }

        return true;
    }

    getFileTypeFromMime(mimetype) {
        if (mimetype.startsWith("image/")) return "image";
        if (mimetype.startsWith("audio/")) return "audio";
        if (mimetype.startsWith("video/")) return "video";
        if (mimetype === "application/pdf" || mimetype.includes("document") || mimetype.includes("text") || mimetype.includes("sheet") || mimetype.includes("presentation")) return "document";
        return "file";
    }

    formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    updateFilePreview() {
        const previewList = document.getElementById("file-preview-list");
        if (!previewList) return;

        previewList.innerHTML = "";

        this.selectedFiles.forEach((file, index) => {
            const previewItem = this.createFilePreview(file, index);
            previewList.appendChild(previewItem);
        });
    }

    createFilePreview(file, index) {
        const fileType = this.getFileTypeFromMime(file.type);
        const fileSize = this.formatFileSize(file.size);

        const previewDiv = document.createElement("div");
        previewDiv.className = "file-preview-item";
        previewDiv.dataset.index = index;

        let previewContent = "";

        if (fileType === "image") {
            const imageUrl = URL.createObjectURL(file);
            previewContent = `
                <div class="file-preview-image">
                    <img src="${imageUrl}" alt="${file.name}" />
                </div>
            `;
        } else {
            const fileIcon = this.getFileIcon(fileType, file.name);
            previewContent = `
                <div class="file-preview-icon">
                    ${fileIcon}
                </div>
            `;
        }

        previewDiv.innerHTML = `
            ${previewContent}
            <div class="file-preview-info">
                <div class="file-preview-name" title="${file.name}">${file.name}</div>
                <div class="file-preview-size">${fileSize}</div>
            </div>
            <button class="remove-file-btn" onclick="messageSender.removeFile(${index})">
                <i data-feather="trash"></i>
            </button>
        `;

        return previewDiv;
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

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFilePreview();

        if (this.selectedFiles.length === 0) {
            this.hideFilePreviewArea();
        }
    }

    clearSelectedFiles() {
        this.selectedFiles = [];
        this.hideFilePreviewArea();
    }

    showFilePreviewArea() {
        const previewArea = document.getElementById("file-preview-area");
        if (previewArea) {
            previewArea.classList.remove("d-none");
        }
    }

    hideFilePreviewArea() {
        const previewArea = document.getElementById("file-preview-area");
        if (previewArea) {
            previewArea.classList.add("d-none");
        }
    }

    // === Audio Recording Setup ===
    setupAudioRecording() {
        let mediaRecorder;
        let audioChunks = [];
        let recordingStartTime;
        let recordingInterval;
        let isCancelled = false;
        const micButton = document.getElementById("mic-button");
        const voiceUI = document.getElementById("voice-ui");
        const recordTime = document.getElementById("record-time");
        const cancelBtn = document.getElementById("cancel-btn");
        const sendBtn = document.querySelector("#message-form .submit");

        const resetRecordingUI = () => {
            clearInterval(recordingInterval);
            recordTime.textContent = "0:00";
            voiceUI.classList.add("d-none");
            micButton.classList.remove("d-none");
            audioChunks = [];
        };
        const stopMediaTracks = () => {
            if (mediaRecorder?.stream) {
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
        };

        const handleStopRecording = (cancel = false, event = null) => {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                if (event) event.preventDefault();
                isCancelled = cancel;
                mediaRecorder.stop();
            }
            stopMediaTracks();
            resetRecordingUI();
        };

        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60).toString();
            const secs = (seconds % 60).toFixed(0).toString().padStart(2, "0");
            return `${mins}:${secs}`;
        };

        micButton?.addEventListener("click", async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                isCancelled = false;

                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

                mediaRecorder.onstart = () => {
                    micButton.classList.add("d-none");
                    voiceUI.classList.remove("d-none");
                    recordingStartTime = Date.now();

                    recordingInterval = setInterval(() => {
                        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
                        recordTime.textContent = formatTime(elapsed);
                    }, 500);
                };

                mediaRecorder.onstop = async () => {
                    resetRecordingUI();
                    stopMediaTracks();

                    if (isCancelled) return;

                    const receiverId = document.querySelector(".contact-details")?.dataset.receiverId;
                    if (!receiverId || receiverId === "null") return;

                    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                    const formData = new FormData();
                    formData.append("files", audioBlob, "voice-message.webm");
                    formData.append("recipientId", parseInt(receiverId));

                    try {
                        const res = await fetch("/messages/send", { method: "POST", body: formData });
                        if (!res.ok) {
                            showNotification("Something Went Wrong", "danger");
                        }
                    } catch (err) {
                        showNotification(err.message || "Something Went Wrong", "danger");
                    } finally {
                        audioChunks = [];
                    }
                };

                mediaRecorder.start();
            } catch (error) {
                showNotification(err.message || "Something Went Wrong", "danger");
            }
        });

        cancelBtn?.addEventListener("click", () => handleStopRecording(true));
        sendBtn?.addEventListener("click", (e) => handleStopRecording(false, e));
    }

    // === Bind Form Submission ===
    bindMessageForm() {
        const form = document.getElementById("message-form");
        if (!form) return;

        const cloned = form.cloneNode(true);
        form.parentNode.replaceChild(cloned, form);

        cloned.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    // === Handle Submit Message ===
    async handleSubmit() {
        const contentInput = document.querySelector("#message-input");
        const receiverId = document.querySelector(".contact-details")?.getAttribute("data-receiver-id");
        const content = contentInput?.value.trim();
        const charLimit = parseInt(this.systemSetting.character_limit, 10);

        if (content.length > charLimit) {
            showNotification('Your message is too long.','danger')
            return;
        }

        if (!receiverId || receiverId === "null") {
            showNotification('No recipient selected','danger');
            return;
        }

        if (!content && this.selectedFiles.length === 0) return;

        const replyBox = document.querySelector(".reply");
        const replyToId = replyBox?.dataset.replyTo || null;

        try {
            let response;

            if (this.selectedFiles.length > 0) {
                if(this.systemSetting.media_send_allowed === 'true'){
                    const formData = new FormData();

                    this.selectedFiles.forEach((file) => {
                        formData.append("files", file);
                    });

                    formData.append("recipientId", parseInt(receiverId));
                    if (content) formData.append("content", content);
                    if (replyToId) formData.append("reply_to", replyToId);

                    response = await fetch("/messages/send", {
                        method: "POST",
                        body: formData,
                    });
                }else{
                    showNotification('You are not allowed to send Media files','danger');
                    return;
                }
            } else {
                const payload = {
                    recipientId: parseInt(receiverId),
                    content,
                    message_type: "text",
                };

                if (replyToId) {
                    payload.reply_to = replyToId;
                }

                response = await fetch("/messages/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            const data = await response.json();
            if (data.success) {
                const chatTabTrigger = document.querySelector("#chat-tab");
                if (chatTabTrigger) {
                    const tab = new bootstrap.Tab(chatTabTrigger);
                    tab.show();
                }

                if (data.messages && Array.isArray(data.messages)) {
                    data.messages.forEach((message) => {
                        this.appendMessage(message);
                    });
                } else if (data.message) {
                    this.appendMessage(data.message);
                }

                contentInput.value = "";
                this.clearSelectedFiles();

                if (replyBox) {
                    replyBox.classList.add("reply-hidden");
                    replyBox.classList.remove("reply-active");
                    delete replyBox.dataset.replyTo;
                }
            }else{
                showNotification(data.error || "Failed to send message",'danger');
            }
        } catch (err) {
            showNotification("Network error occurred",'danger');
        }
    } 

    // === Append Message and Refresh Chat ===
    appendMessage(msg) {
        const currentChatUserId = document.querySelector(".contact-details")?.getAttribute("data-receiver-id");
        const chatContainer = document.querySelector(".chatappend");
        const emptyChat = document.querySelector(".chatbox-container .empty-chat");
        const mainChat = document.querySelector(".main-chat-container");
        
        if (emptyChat) emptyChat.classList.add("d-none");
        if (mainChat) mainChat.classList.remove("d-none");

        if (window.chatLoader) {
            window.chatLoader.refresh();
        }

        if (msg.message_type == 'call') {
            if (window.callLoader) {
                window.callLoader.refresh();
            }
        }

        if (!chatContainer) return;
        if (chatContainer.querySelector(`[data-msg-id="${msg.id}"]`)) return;

        if (parseInt(currentChatUserId) === msg.sender_id || parseInt(currentChatUserId) === msg.recipient_id) {
            fetch(`/messages/render/${msg.id}`)
                .then((res) => res.text())
                .then((html) => {
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = html.trim();

                    const newContent = tempDiv.firstElementChild;

                    if (chatContainer.querySelector(`[data-msg-id="${msg.id}"]`)) return;

                    if (newContent.classList.contains("date-separator")) {
                        const dateLabel = newContent.querySelector(".date-label span")?.textContent;
                        const existingDateSeparator = this.findExistingDateSeparator(chatContainer, dateLabel);

                        if (!existingDateSeparator) {
                            let currentElement = newContent;
                            while (currentElement) {
                                const nextElement = currentElement.nextElementSibling;
                                chatContainer.appendChild(currentElement);
                                currentElement = nextElement;
                            }
                        } else {
                            this.handleMessageGroupingWithDates(msg, tempDiv, existingDateSeparator, chatContainer);
                        }
                    } else {
                        this.handleRegularMessageGrouping(msg, newContent, chatContainer);
                    }

                    scrollToBottom();
                    if (typeof handleMessageUi === 'function') {
                        handleMessageUi(msg.recipient_id);
                    }
                })
                .catch((err) => {
                    showNotification(err.message ||"Something Went Wrong",'danger')
                });
        }
    }

    findExistingDateSeparator(container, dateLabel) {
        const dateSeparators = container.querySelectorAll(".date-separator .date-label span");
        for (let separator of dateSeparators) {
            if (separator.textContent === dateLabel) {
                return separator.closest(".date-separator");
            }
        }
        return null;
    }

    handleMessageGroupingWithDates(msg, tempDiv, existingDateSeparator, chatContainer) {
        const newMessageGroups = [];
        let currentElement = tempDiv.firstElementChild;

        while (currentElement) {
            if (currentElement.classList && (currentElement.classList.contains("replies") || currentElement.classList.contains("sent"))) {
                newMessageGroups.push(currentElement);
            }
            currentElement = currentElement.nextElementSibling;
        }

        if (newMessageGroups.length === 0) return;

        const newMessageGroup = newMessageGroups[0];
        const newBlockType = newMessageGroup.classList.contains("replies") ? "replies" : "sent";
        const newMsgElement = newMessageGroup.querySelector(".msg-box li");
        const newMsgTime = newMsgElement?.getAttribute("data-msg-created_at");
        const messageGroupsInDate = [];
        let nextElement = existingDateSeparator.nextElementSibling;

        while (nextElement && !nextElement.classList.contains("date-separator")) {
            if (nextElement.classList.contains("replies") || nextElement.classList.contains("sent")) {
                messageGroupsInDate.push(nextElement);
            }
            nextElement = nextElement.nextElementSibling;
        }

        let shouldCreateNewGroup = true;
        const lastMessageGroup = messageGroupsInDate[messageGroupsInDate.length - 1];

        if (lastMessageGroup) {
            const lastBlockType = lastMessageGroup.classList.contains("replies") ? "replies" : "sent";

            if (lastBlockType === newBlockType) {
                const lastMsgElement = lastMessageGroup.querySelector(".msg-box")?.lastElementChild;
                const lastMsgTime = lastMsgElement?.getAttribute("data-msg-created_at");

                if (!this.isMessageTimeGapLarge(lastMsgTime, newMsgTime)) {
                    const msgBox = lastMessageGroup.querySelector(".msg-box");
                    if (msgBox && !msgBox.querySelector(`[data-msg-id="${msg.id}"]`)) {
                        msgBox.appendChild(newMsgElement.cloneNode(true));
                        shouldCreateNewGroup = false;
                    }
                }
            }
        }

        if (shouldCreateNewGroup) {
            if (lastMessageGroup) {
                lastMessageGroup.insertAdjacentElement("afterend", newMessageGroup.cloneNode(true));
            } else {
                existingDateSeparator.insertAdjacentElement("afterend", newMessageGroup.cloneNode(true));
            }
        }
    }

    handleRegularMessageGrouping(msg, newMessageBlock, chatContainer) {
        const newBlockType = newMessageBlock.classList.contains("replies") ? "replies" : "sent";
        const newMsgElement = newMessageBlock.querySelector(".msg-box li");
        const newMsgTime = newMsgElement?.getAttribute("data-msg-created_at");
        const allBlocks = [...chatContainer.children];
        const lastRealBlock = allBlocks.reverse().find((el) => !(el.classList.contains("typing-m") && el.classList.contains("sent") && el.classList.contains("last")));
        let shouldCreateNewGroup = true;

        if (lastRealBlock && !lastRealBlock.classList.contains("date-separator")) {
            const lastBlockType = lastRealBlock.classList.contains("replies") ? "replies" : "sent";

            if (lastBlockType === newBlockType) {
                const lastMsgElement = lastRealBlock.querySelector(".msg-box")?.lastElementChild;
                const lastMsgTime = lastMsgElement?.getAttribute("data-msg-created_at");

                if (!this.isMessageTimeGapLarge(lastMsgTime, newMsgTime)) {
                    const msgBox = lastRealBlock.querySelector(".msg-box");
                    if (msgBox && !msgBox.querySelector(`[data-msg-id="${msg.id}"]`)) {
                        msgBox.appendChild(newMsgElement);
                        shouldCreateNewGroup = false;
                    }
                }
            }
        }
        if (shouldCreateNewGroup && !chatContainer.querySelector(`[data-msg-id="${msg.id}"]`)) {
            chatContainer.appendChild(newMessageBlock);
        }
    }

    isMessageTimeGapLarge(earlierTime, laterTime, thresholdMinutes = 5) {
        if (!earlierTime || !laterTime) return true;

        const earlier = new Date(earlierTime);
        const later = new Date(laterTime);

        if (isNaN(earlier.getTime()) || isNaN(later.getTime())) return true;

        const diffMinutes = (later - earlier) / (1000 * 60);
        return Math.abs(diffMinutes) > thresholdMinutes;
    }

    // === Typing === //
    handleTyping() {
        const receiverId = document.querySelector(".contact-details")?.getAttribute("data-receiver-id");
        if (!receiverId) return;

        this.socket.emit("typing", {
            senderId: this.currentUserId,
            receiverId,
        });

        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.socket.emit("stopTyping", {
                senderId: this.currentUserId,
                receiverId,
            });
        }, this.typingInterval);
    }

    // === Handle Stickers ===
    initStickers() {
        const stickers = document.querySelectorAll('.sticker-contain img');
        if (!stickers.length) return;
        
        stickers.forEach(sticker => {
            sticker.addEventListener('click', async () => {
                const receiverId = getElement('.contact-details')?.getAttribute('data-receiver-id');
                const stickerUrl = sticker.getAttribute('data-sticker');
                
                if (!receiverId || !stickerUrl) return;
                
                try {
                    const result = await makeApiCall('/messages/send', {
                        method: 'POST',
                        body: JSON.stringify({
                            recipientId: parseInt(receiverId),
                            content: null,
                            message_type: 'sticker',
                            file_url: stickerUrl,
                        })
                    });
                    
                    if (result.success && result.message) {
                        this.appendMessage(result.message);
                    }
                } catch (err) {
                    showNotification(err.message || 'Failed to send sticker', 'danger');
                }
            });
        });
    }

    initialize() {
        this.setupFileUpload();
        this.setupDragAndDrop();
        this.setupAudioRecording();
        this.bindMessageForm();
        this.initStickers();

        document.addEventListener("keydown", (e) => {
            const input = document.querySelector("#message-input");
            if (e.target === input && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit();
            }
        });

        document.getElementById("message-input")?.addEventListener("input", () => {
            this.handleTyping();
        });
    }
}