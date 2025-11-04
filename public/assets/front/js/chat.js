'use strict';
class ChatSocketManager {
  constructor(socket, currentUserId) {
    this.socket = socket;
    this.currentUserId = currentUserId;
    this.setupSocketEvents();
    this.setupHeartbeat();
  }

  setupSocketEvents() {
    // ========= CONNECTION EVENTS ==========
    this.socket.on("disconnect", (reason) => this.handleDisconnect(reason));
    this.socket.on("reconnect", () => this.handleReconnect());
    this.socket.on("reconnect_error", () => this.handleReconnectError());
    
    // ========== MESSAGE EVENTS ==========
    this.socket.on("newDirectMessage", (msg) => this.handleNewDirectMessage(msg));
    this.socket.on("messageStatusUpdated", (data) => this.handleMessageStatusUpdated(data));
    this.socket.on("messageDeleteForEveryone", (data) => this.handleMessageDelete(data));
    this.socket.on("messageEdit", (data) => this.handleMessageEdit(data));

    // ========== TYPING INDICATORS ==========
    this.socket.on("showTyping", (data) => this.handleShowTyping(data));
    this.socket.on("hideTyping", (data) => this.handleHideTyping(data));

    // ========== FRIEND SYSTEM EVENTS ==========
    this.socket.on("friendListUpdated", () => this.handleFriendListUpdated());
    this.socket.on("friend_removed", (data) => this.handleFriendRemoved(data));

    // ========== NOTIFICATION EVENTS ==========
    this.socket.on("newNotification", (notification) => this.handleNewNotification(notification));
    this.socket.on("browserNotification", (notification) => this.handleBrowserNotification(notification));

    // ========== USER STATUS EVENTS ==========
    this.socket.on("userOnline", (data) => this.handleUserOnline(data));
    this.socket.on("userOffline", (data) => this.handleUserOffline(data));

    // ========== REACTION EVENTS ==========
    this.socket.on("reactionUpdate", (data) => this.handleReactionUpdate(data));

    // ========== CHAT MANAGEMENT EVENTS ==========
    this.socket.on("chat-cleared-for-sender", (data) => this.handleChatCleared(data));

    // ========== CALL EVENTS ==========
    this.socket.on("incomingCall", (data) => this.handleIncomingCall(data));
    this.socket.on("callInitiated", (data) => this.handleCallInitiated(data));
    this.socket.on("callAnswered", (data) => this.handleCallAnswered(data));
    this.socket.on("callDeclined", () => this.handleCallDeclined());
    this.socket.on("callEnded", (data) => this.handleCallEnded(data));
    
    // ========== WEBRTC EVENTS ==========
    this.socket.on("call:offer", (data) => this.handleCallOffer(data));
    this.socket.on("call:answer", (data) => this.handleCallAnswer(data));
    this.socket.on("call:ice-candidate", (data) => this.handleCallIceCandidate(data));
    
  }

  setupHeartbeat() {
    setInterval(() => {
      this.socket.emit("heartbeat", this.currentUserId);
    }, 25000);
  }

  /* ==================== CONNECTION HANDLERS ==================== */

  handleDisconnect(reason) {
    if (reason === "transport close" || reason === "ping timeout") {
    document.body.classList.add("offline");
    }
  }
  
  handleReconnect() {
    if (navigator.onLine) {
    document.body.classList.remove("offline");
    }
  }
  
  handleReconnectError() {
    document.body.classList.add("offline");
  }

  /* ==================== MESSAGE EVENT HANDLERS ==================== */

  handleNewDirectMessage(msg) {
    if (msg.sender_id === this.currentUserId || msg.recipient_id === this.currentUserId) {
      appendMessage(msg);

      const hash = window.location.hash;
      const recipientId = hash.substring(1);
      const messageIds = [
        ...document.querySelectorAll(".chatappend .sent:not(.typing-m) .msg-setting-main")
      ].map((el) => el.dataset.msgId);
  
      if (!messageIds.includes(msg.id.toString())) {
        messageIds.push(msg.id.toString());
      }
      
      if(recipientId === msg.sender_id.toString()){
        this.socket.emit("messageSeen", { messageIds: messageIds, senderId: recipientId });
      }else{
        this.socket.emit("messageDelivered", { messageId: msg.id, senderId: msg.sender_id });
      }

      if (document.hidden) {
        playMessageSound();
        showBrowserNotification(msg.sender.name, msg.content || "Sent a file");
        startTitleBlink(msg.sender.name);
      }
    }
  }

  messageStatusUpdated(messageId, status) {
    const statusMap = {
      sent: "sent",
      delivered: "deliver",
      seen: "deliver seen",
    };
  
    const statusClass = statusMap[status] || "sent";
  
    const elements = document.querySelectorAll(
      `[data-message-id="${messageId}"] .message-status, 
       [data-msg-id="${messageId}"] .aligns-arrow`
    );
  
    elements.forEach((el) => {
      el.className = `${el.classList.contains("message-status") ? "message-status" : "aligns-arrow"} ${statusClass}`;
    });
  }  

  handleMessageStatusUpdated({ messageId, status }) {
    setTimeout(() => {
      this.messageStatusUpdated(messageId, status);
    }, 500);
  }

  handleMessageDelete({ messageId }) {
    const messageEl = document.querySelector(`.msg-setting-main[data-msg-id="${messageId}"]`);
    if (messageEl) {
      messageEl.classList.add('deleted-msg');
      messageEl.innerHTML = `
        <div class="deleted-message">
          <i class="fa fa-trash text-muted"></i>
          <span class="text-muted">This message is deleted</span>
        </div>
      `;
    }

    if (window.chatLoader) {
      window.chatLoader.refresh();
    }
  }

  handleMessageEdit({ messageId, content }) {
    const messageEl = document.querySelector(`.message-content[data-message-id="${messageId}"]`);
    const time = messageEl?.querySelector('p')?.textContent || "";

    if (messageEl) {
      messageEl.innerHTML = `
        ${content}
        <small class="edited-label">(edited)</small>
        <p>${time}</p>
      `;
    }
  }

  /* ==================== TYPING EVENT HANDLERS ==================== */

  handleShowTyping({ senderId }) {
    const item = document.querySelector(`.chat-item[data-user-id="${senderId}"]`);
    const itemScreen = document.querySelector(`.typing-m[data-user-receiver-id="${senderId}"]`);
    
    if (item) {
      item.querySelector(".typing-indicator")?.classList.remove("d-none");
      item.querySelector(".last-message")?.classList.add("d-none");
    }

    if (itemScreen) {
      itemScreen.classList.remove("d-none");
    }
    scrollToBottom();
  }

  handleHideTyping({ senderId }) {
    const item = document.querySelector(`.chat-item[data-user-id="${senderId}"]`);
    if (item) {
      item.querySelector(".typing-indicator")?.classList.add("d-none");
      item.querySelector(".last-message")?.classList.remove("d-none");
    }
    
    const itemScreen = document.querySelector(`.typing-m[data-user-receiver-id="${senderId}"]`);
    if (itemScreen) {
      itemScreen.classList.add("d-none");
    }
  }

  /* ==================== FRIEND SYSTEM HANDLERS ==================== */

  handleFriendListUpdated() {
    if (window.chatLoader) window.chatLoader.refresh();
    if (window.contactLoader) window.contactLoader.refresh();
    if (window.favoriteLoader) window.favoriteLoader.refresh();
  }

  /* ==================== USER STATUS HANDLERS ==================== */

  handleUserOnline({ userId }) {
    updateUserOnlineStatus(userId, true);
  }

  handleUserOffline({ userId, lastSeen }) {
    updateUserOnlineStatus(userId, false, lastSeen);
  }

  /* ==================== REACTION HANDLERS ==================== */

  handleReactionUpdate({ messageId, emoji, action, userId, reactionCounts }) {
    if (userId === this.currentUserId) return;

    cacheManager.clear(this.currentUserId.toString());
    
    if (reactionCounts) {
      updateReactionCounts(messageId, reactionCounts);
    } else {
      const reaction = { emoji, user_id: userId };
      updateReactionUI(messageId, reaction, action);
    }
  }

  /* ==================== CHAT MANAGEMENT HANDLERS ==================== */

  handleChatCleared({ success, receiverId }) {
    if (success) {
      updateAfterClear();
      const button = document.getElementById("clear-for-me");
      resetButton(button);
      
      if (window.chatLoader) window.chatLoader.refresh();
    }
  }

  handleNewNotification(notification) {
    playMessageSound();

    if (window.notificationLoader) {
      window.notificationLoader.addNewNotification(notification);
    }

    setTimeout(() => {
      if (window.friendsLoader) window.friendsLoader.refresh();
    }, 500);

    showBrowserNotification(notification.title, notification.message, notification.from_user?.avatar);
  }

  handleBrowserNotification(notification) {
    showBrowserNotification(notification.title, notification.message, notification.from_user?.avatar);
  }

  handleFriendRemoved({ userId, targetId }) {
    if (targetId === this.currentUserId) {
      showNotification(`${userId} unfriended you`, 'danger');

      window.chatLoader.refresh();
      window.contactLoader.refresh();
      window.friendsLoader.refresh();
      window.favoriteLoader.refresh();
      window.archiveChatLoader.refresh();
      
      document.querySelector('#blank').classList.add('active');
      document.querySelector('#chatting').classList.remove('active');
      document.querySelector('.reply-chat').classList.add('d-none');
      window.history.replaceState(null, "", "/messenger");
    }
  }

  /* ==================== CALL EVENT HANDLERS ==================== */

  handleIncomingCall(data) {
    if (window.callManager) {
      window.callManager.showIncomingCallModal(data.call);
    }
  }

  handleCallInitiated(data) {
    if (window.callManager) {
      window.callManager.currentCall = data.call;
      window.callManager.showOutgoingCallModal(data.call);
    }
  }

  handleCallAnswered(data) {
    if (window.callManager && data.userId !== this.currentUserId) {
      window.callManager.stopRingtones();
      window.callManager.updateCallStatus("Call answered", "success");
      if (window.callManager.currentCall?.call_mode === "direct") {
        window.callManager.startCall();
      }
    }
  }

  handleCallDeclined() {
    if (window.callManager) {
      window.callManager.stopRingtones();
      window.callManager.updateCallStatus("Call declined", "error");
      window.callManager.endCurrentCall();
    }
  }

  handleCallEnded(data) {
    if (window.callManager) {
      window.callManager.stopRingtones();
      window.callManager.stopCallTimer();
      window.callManager.updateCallStatus(
        `Call ended${data.duration ? ` • ${window.callManager.formatDuration(data.duration)}` : ""}`, 
        "info"
      );
      window.callManager.endCurrentCall();
    }
  }

  handleCallOffer(data) {
    if (window.callManager) {
      window.callManager.handleOffer(data);
    }
  }

  handleCallAnswer(data) {
    if (window.callManager) {
      window.callManager.handleAnswer(data);
    }
  }

  handleCallIceCandidate(data) {
    if (window.callManager) {
      window.callManager.handleIceCandidate(data);
    }
  }
}