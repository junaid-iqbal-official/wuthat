'use strict';
class CallManager {
  constructor(socket, userId, systemSetting) {
    this.socket = socket;
    this.userId = userId;
    this.systemSetting = systemSetting
    this.currentCall = null;
    this.localStream = null;
    this.peerConnections = new Map(); // socketId -> RTCPeerConnection
    this.remoteVideoStreams = new Map(); // userId -> MediaStream
    this.pendingIceQueues = new Map(); // socketId -> RTCIceCandidateInit[]
    this.participantNames = new Map(); // userId -> name
    this.participantSocketIds = new Map(); // userId -> socketId
    this.peerId = this.generatePeerId();
    this.isCallActive = false;
    this.isMuted = false;
    this.isVideoEnabled = false;
    this.hasVideoPermission = false;
    this.hasAudioPermission = false;
    this.callTimer = null;
    this.callStartTime = null;
    this.ringtonePlaying = false;
    this.outgoingRingtone = null;
    this.incomingRingtone = null;
    this.participantVideoStatus = new Map(); // userId -> boolean
    this.activeModals = new Set();
    this.callTimeout = null;
    this.callTimeoutDuration = null; 

    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        {
          urls: ["turn:116.74.126.0:3478", "turn:116.74.126.0:3478?transport=tcp"],
          username: "myuser",
          credential: "mypassword",
        },
      ],
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    };

    this.ensureDomScaffold();
    this.initializeAudioElements();
    this.setupCallModalEvents();
  }

  /* ------------------------ DOM scaffold & helpers ------------------------ */

  ensureDomScaffold() {
    let container = document.getElementById("main-video-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "main-video-container";
      container.className = "d-none";
      container.innerHTML = `
        <div class="video-ui">
          <div class="video-header">
            <span id="video-call-status">Connecting...</span>
            <span id="video-call-duration">0:00</span>
          </div>
          <div class="video-body">
            <video id="local-video" autoplay muted playsinline style="display:none; background:#000; border-radius:8px;"></video>
            <div id="remote-videos-grid" class="grid-container"></div>
          </div>
          <div class="video-controls">
            <button id="video-mute-btn" type="button" class="btn"><i data-feather="mic"></i></button>
            <button id="video-toggle-btn" type="button" class="btn"><i data-feather="video-off"></i></button>
            <button id="video-end-btn" type="button" class="btn btn-danger"><i data-feather="phone-off"></i></button>
          </div>
        </div>`;
      document.body.appendChild(container);
    }

    if (!document.getElementById("audioContainer")) {
      const audioContainer = document.createElement("div");
      audioContainer.id = "audioContainer";
      audioContainer.style.display = "contents";
      document.body.appendChild(audioContainer);
    }

    const videoMute = document.getElementById("video-mute-btn");
    if (videoMute) videoMute.onclick = () => this.toggleMute();

    const videoToggle = document.getElementById("video-toggle-btn");
    if (videoToggle)
      videoToggle.onclick = () => {
        if (this.hasVideoPermission) this.toggleVideo();
        else this.showError("Camera permission required.");
      };

    const videoEnd = document.getElementById("video-end-btn");
    if (videoEnd) videoEnd.onclick = () => this.endCall();
  }

  createVideoContainer() {
    const videoContainer = document.getElementById("main-video-container");
    if (!videoContainer) return;
    videoContainer.classList.remove("d-none");

    const muteBtn = document.getElementById("video-mute-btn");
    if (muteBtn) muteBtn.onclick = () => this.toggleMute();

    const videoBtn = document.getElementById("video-toggle-btn");
    if (videoBtn)
      videoBtn.onclick = () => {
        if (this.hasVideoPermission) this.toggleVideo();
      };

    const endBtn = document.getElementById("video-end-btn");
    if (endBtn) endBtn.onclick = () => this.endCall();
  }

  /* ----------------------------- Permissions ----------------------------- */

  notifyPermissionStatus() {
    const issues = [];
    if (!this.hasAudioPermission) issues.push("Microphone access is required for voice calls");
    if (!this.hasVideoPermission) issues.push("Camera access is required for video calls");
    if (issues.length) showNotification(`Media permissions needed:${issues}`,'danger');
  }

  updateVideoButtonState() {
    const videoButtons = document.querySelectorAll(".video-toggle-btn, #initiate-video-call, #video-toggle-btn");
    videoButtons.forEach((btn) => {
      if (!btn) return;
      if (!this.hasVideoPermission) {
        btn.classList.add("disabled");
        btn.disabled = true;
        btn.title = "Camera permission required";
      } else {
        btn.classList.remove("disabled");
        btn.disabled = false;
        btn.title = this.isVideoEnabled ? "Turn off camera" : "Turn on camera";
      }
    });
  }

  /* --------------------------- Tones & utilities -------------------------- */

  initializeAudioElements() {
    this.outgoingRingtone = new Audio("/assets/sounds/outgoing.wav");
    this.outgoingRingtone.loop = true;
    this.outgoingRingtone.volume = 0.5;
    this.outgoingRingtone.preload = "auto";
    this.outgoingRingtone.onerror = () => showNotification("Outgoing ringtone not found",'danger');

    this.incomingRingtone = new Audio("/assets/sounds/incoming.wav");
    this.incomingRingtone.loop = true;
    this.incomingRingtone.volume = 0.7;
    this.incomingRingtone.preload = "auto";
    this.incomingRingtone.onerror = () => showNotification("Incoming ringtone not found",'danger');
  }

  generatePeerId() {
    return `peer_${this.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  setupCallModalEvents() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("#initiate-call")) {
        e.preventDefault();
        
        const contactDetails = document.querySelector(".contact-details");
        if (!contactDetails) return;
        const receiverId = contactDetails.dataset.receiverId;
        const receiverName = contactDetails.querySelector("h5.full-name")?.textContent.trim() || "";
        this.participantNames.set(receiverId, receiverName);
        const receiverInitials = this.getInitials(receiverName);
        this.prepareCallModal(receiverId, receiverName, receiverInitials, "direct", null, "audio");
      }

      if (e.target.closest("#initiate-video-call")) {
        e.preventDefault();
        // if (!this.hasVideoPermission) {
        //   this.showError('Camera permission is required for video calls. Allow camera access and refresh.');
        //   return;
        // }
        const contactDetails = document.querySelector(".contact-details");
        if (!contactDetails) return;
        const receiverId = contactDetails.dataset.receiverId;
        const receiverName = contactDetails.querySelector("h5.full-name")?.textContent.trim() || "";
        this.participantNames.set(receiverId, receiverName);
        const receiverInitials = this.getInitials(receiverName);
        this.prepareCallModal(receiverId, receiverName, receiverInitials, "direct", null, "video");
      }

      if (e.target.closest(".answer-call-btn")) {
        e.preventDefault();
        this.answerCall();
      }
      if (e.target.closest(".decline-call-btn")) {
        e.preventDefault();
        this.declineCall();
      }
      if (e.target.closest(".end-call-btn")) {
        e.preventDefault();
        this.endCall();
      }
      if (e.target.closest(".mute-toggle-btn")) {
        e.preventDefault();
        this.toggleMute();
      }

      if (e.target.closest(".video-toggle-btn")) {
        e.preventDefault();
        if (this.hasVideoPermission) this.toggleVideo();
      }

      if (e.target.closest(".cancel-call-btn")) {
        e.preventDefault();
        this.cancelCall();
      }
    });
  }

  startAutoDeclineTimer(type) {
    this.clearAutoDeclineTimer();
    this.callTimeoutDuration = this.systemSetting.call_timeout_seconds * 1000;
    
    this.callTimeout = setTimeout(async () => {
      if (!this.currentCall) return;
      if (type === "outgoing") {
        this.cancelCall();
      }
    }, this.callTimeoutDuration);
  }

  clearAutoDeclineTimer() {
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }
  }


  /* --------------------------- Call orchestration -------------------------- */

  prepareCallModal(receiverId, receiverName, receiverInitials, callMode = "direct", groupId = null, callType = "audio") {
    if (this.activeModals.has("outgoing")) return;
    const avatarInitialsElem = document.querySelector("#audiocall #avatarInitials");
    if (avatarInitialsElem) avatarInitialsElem.textContent = receiverInitials;
    const callerNameElem = document.querySelector("#audiocall #callerName");
    if (callerNameElem) callerNameElem.textContent = receiverName;
    const callerLocationElem = document.querySelector("#audiocall #callerLocation");
    if (callerLocationElem) callerLocationElem.textContent = callType === "video" ? "Video calling..." : "Calling...";

    this.pendingCall = { receiverId, receiverName, callMode, groupId, callType };
    this.isVideoEnabled = callType === "video";
  }

  async ensureLocalStream(includeVideo = false) {
    try {
      if (!this.localStream || this.localStream.getAudioTracks().length === 0) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (this.localStream) {
            const audioSender = this.peerConnections.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
              if (sender) sender.replaceTrack(audioStream.getAudioTracks()[0]);
            });
            this.localStream.getAudioTracks().forEach((t) => t.stop());
            this.localStream.addTrack(audioStream.getAudioTracks()[0]);
          } else {
            this.localStream = audioStream;
          }
          this.hasAudioPermission = true;
        } catch (audioError) {
          showNotification('Audio access failed, continuing without audio','danger')
          this.hasAudioPermission = false;
        }
      }

      if (includeVideo) {
        if (!this.localStream?.getVideoTracks().length || !this.isVideoEnabled) {
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });

            if (this.localStream?.getVideoTracks().length > 0) {
              this.localStream.getVideoTracks().forEach((t) => t.stop());
            }

            if (this.localStream) {
              this.localStream.addTrack(videoStream.getVideoTracks()[0]);
            } else {
              this.localStream = videoStream;
            }

            this.hasVideoPermission = true;
            this.isVideoEnabled = true;
          } catch (videoError) {
            console.warn("Video access failed, continuing without video", videoError);
            this.hasVideoPermission = false;
            this.isVideoEnabled = false;
          }
        }
      }

      this.setupLocalVideo();
      return this.localStream;
    } catch (error) {
      showNotification(`Failed to get media stream:${error}`,'danger');
      throw error;
    }
  }

  setupLocalVideo() {
    const isVideoCall = this.currentCall?.call_type === "video" || this.isVideoEnabled;
    const localVideo = document.getElementById("local-video");

    if (!localVideo) return;
    if (!this.localStream) return;

    localVideo.autoplay = true;
    localVideo.muted = true;
    localVideo.playsInline = true;
    localVideo.srcObject = this.localStream;

    if (isVideoCall && this.isVideoEnabled) {
      localVideo.style.display = "block";
    } else {
      localVideo.style.display = "none";
    }

    localVideo.play().catch(() => {});
  }

  async initiateCall(receiverId, groupId = null, callType = "audio") {
    this.clearAutoDeclineTimer();
    try {
      try {
        const constraints = {
          audio: callType === "audio",
          video: callType === "video",
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((t) => t.stop());

        this.hasAudioPermission = callType === "audio";
        this.hasVideoPermission = callType === "video";
      } catch (e) {
        showNotification(`Permissions not granted:${e}`,'danger');
      }

      await this.ensureLocalStream(callType === "video");

      const response = await fetch("/call/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId, groupId, callType }),
      });

      const data = await response.json();
      if (data.success) {
        this.currentCall = data.call;
        return data.call;
      } else {
        throw new Error(data.error || "Failed to initiate call");
      }
    } catch (error) {
      this.showError("Failed to start call");
      this.closeCallModal();
      throw error;
    }
  }

  async answerCall() {
    this.clearAutoDeclineTimer();

    if (!this.currentCall) return;
    try {
      this.stopRingtones();
      const includeVideo = this.currentCall.call_type === "video";
      await this.ensureLocalStream(includeVideo);

      const response = await fetch("/call/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: this.currentCall.id }),
      });

      const data = await response.json();
      if (data.success) {
        this.isVideoEnabled = includeVideo && this.hasVideoPermission;
        this.startCall();
      } else {
        throw new Error(data.error || "Failed to answer call");
      }
    } catch (error) {
      this.showError("Failed to answer call");
      this.endCurrentCall();
    }
  }

  async declineCall() {
    this.clearAutoDeclineTimer();

    if (!this.currentCall) return;
    try {
      this.stopRingtones();
      const response = await fetch("/call/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: this.currentCall.id, reason: "declined" }),
      });
      const data = await response.json();
      if (data.success) {
        this.closeCallModal();
        this.currentCall = null;
      }
    } catch (error) {
      this.showError("Error declining call");
    }
  }

  async endCall() {
    this.clearAutoDeclineTimer();
    if (!this.currentCall) return;
    try {
      this.stopRingtones();
      this.stopCallTimer();
      const response = await fetch("/call/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: this.currentCall.id }),
      });
      const data = await response.json();
      if (data.success) this.endCurrentCall();
    } catch {
      this.endCurrentCall();
    }
  }

  cancelCall() {
    this.clearAutoDeclineTimer();
    this.stopRingtones();
    if (this.currentCall) this.endCall();
    else this.closeCallModal();
  }

  async startCall() {
    this.clearAutoDeclineTimer();
    try {
      const includeVideo = this.currentCall?.call_type === "video" || this.isVideoEnabled;
      await this.ensureLocalStream(includeVideo);

      this.socket.emit("call:join-room", {
        callId: this.currentCall.id,
        peerId: this.peerId,
      });

      this.isCallActive = true;

      if (this.currentCall.call_type === "video") {
        this.showVideoCallUI();
      } else {
        this.showActiveCallUI();
      }
    } catch (error) {
      this.showError("Failed to start call");
      this.endCurrentCall();
    }
  }

  showVideoCallUI() {
    this.closeCallModal();

    const videoContainer = document.getElementById("main-video-container");
    if (videoContainer) {
      videoContainer.classList.add("active");
      videoContainer.classList.remove("d-none");

      const status = document.getElementById("video-call-status");
      if (status) status.textContent = "Connected";

      this.setupLocalVideo();
      this.updateVideoControls();
    }

    if (!this.callTimer) this.startCallTimer();
  }

  updateVideoControls() {
    const muteBtn = document.getElementById("video-mute-btn");
    const videoBtn = document.getElementById("video-toggle-btn");

    if (muteBtn) {
      muteBtn.innerHTML = `<i data-feather="${this.isMuted ? "mic-off" : "mic"}"></i>`;
      muteBtn.classList.toggle("muted", this.isMuted);
    }

    if (videoBtn) {
      videoBtn.innerHTML = `<i data-feather="${this.isVideoEnabled ? "video" : "video-off"}"></i>`;
      videoBtn.classList.toggle("off", !this.isVideoEnabled);
      videoBtn.classList.toggle("disabled", !this.hasVideoPermission);
    }

  }

  startCallTimer() {
    if (this.callTimer) return;
    this.callStartTime = Date.now();
    this.callTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
      this.updateCallDuration(elapsed);
    }, 1000);

    this.socket.emit("call:start-timer", {
      callId: this.currentCall?.id,
      startTime: this.callStartTime,
    });
  }

  stopCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
    this.callStartTime = null;
  }

  updateCallDuration(seconds) {
    const duration = this.formatDuration(seconds);
    const callerLocationElem = document.querySelector(".call-ui.show #callerLocation");
    if (callerLocationElem && this.isCallActive) {
      const callType = this.currentCall?.call_type === "video" ? "Video call" : "Voice call";
      callerLocationElem.textContent = `${callType} • ${duration}`;
    }
    const videoDurationElem = document.getElementById("video-call-duration");
    if (videoDurationElem) videoDurationElem.textContent = duration;
  }

  playOutgoingRingtone() {
    try {
      this.outgoingRingtone.currentTime = 0;
      this.outgoingRingtone.play().catch(() => {});
    } catch {}
  }

  playIncomingRingtone() {
    try {
      this.incomingRingtone.currentTime = 0;
      this.incomingRingtone.play().catch(() => {});
    } catch {}
  }

  stopRingtones() {
    try {
      this.outgoingRingtone.pause();
      this.outgoingRingtone.currentTime = 0;
      this.incomingRingtone.pause();
      this.incomingRingtone.currentTime = 0;
    } catch {}
  }

  /* ------------------------------ Participants ----------------------------- */

  async handleExistingParticipants(participants) {
    for (const p of participants) {
      await this.createPeerConnection(p.socketId, p.userId, false);
    }
  }

  async handleUserJoined(data) {
    await this.createPeerConnection(data.socketId, data.userId, true);
  }

  handleUserLeft(data) {
    const pc = this.peerConnections.get(data.socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(data.socketId);
    }
    this.removeParticipantFromUI(data.userId);
    this.participantVideoStatus.delete(data.userId);
  }

  async createPeerConnection(socketId, userId, shouldCreateOffer) {
    if (this.peerConnections.has(socketId)) return;

    const includeVideo = this.currentCall?.call_type === "video" || this.isVideoEnabled;
    await this.ensureLocalStream(includeVideo);

    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(socketId, pc);
    this.pendingIceQueues.set(socketId, []);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.handleRemoteStream(userId, socketId, remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentCall?.id) {
        this.socket.emit("call:ice-candidate", {
          targetSocketId: socketId,
          candidate: event.candidate,
          callId: this.currentCall.id,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      this.updateConnectionStatus(userId, pc.connectionState);
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        this.peerConnections.delete(socketId);
        this.removeParticipantFromUI(userId);
      }
    };

    if (shouldCreateOffer) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: includeVideo,
        iceRestart: false,
      });
      await pc.setLocalDescription(offer);
      this.socket.emit("call:offer", {
        targetSocketId: socketId,
        offer,
        callId: this.currentCall.id,
      });
    }
  }

  async handleOffer(data) {
    const includeVideo = this.currentCall?.call_type === "video" || this.isVideoEnabled;
    await this.ensureLocalStream(includeVideo);

    let pc = this.peerConnections.get(data.fromSocketId);
    if (!pc) {
      await this.createPeerConnection(data.fromSocketId, data.fromUserId, false);
      pc = this.peerConnections.get(data.fromSocketId);
    }
    if (!pc) return;

    if (pc.signalingState === "have-local-offer") {
      const shouldBackDown = this.userId < data.fromUserId;
      if (shouldBackDown) await pc.setLocalDescription({ type: "rollback" });
      else return;
    }

    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

    const queue = this.pendingIceQueues.get(data.fromSocketId) || [];
    while (queue.length) {
      const cand = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
      }
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit("call:answer", {
      targetSocketId: data.fromSocketId,
      answer,
      callId: data.callId,
    });
  }

  async handleAnswer(data) {
    const pc = this.peerConnections.get(data.fromSocketId);
    if (!pc) return;
    if (pc.signalingState !== "have-local-offer") return;

    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

    const queue = this.pendingIceQueues.get(data.fromSocketId) || [];
    while (queue.length) {
      const cand = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
      }
    }
  }

  async handleIceCandidate(data) {
    const pc = this.peerConnections.get(data.fromSocketId);
    if (!pc) return;

    const candidate = data.candidate;
    try {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        const q = this.pendingIceQueues.get(data.fromSocketId) || [];
        q.push(candidate);
        this.pendingIceQueues.set(data.fromSocketId, q);
      }
    } catch (e) {
    }
  }

  /* --------------------------- Media element wiring ------------------------ */

  handleRemoteStream(userId, socketId, stream) {
    const userName = this.participantNames.get(userId) || `User ${userId}`;
    this.remoteVideoStreams.set(userId, stream);

    const hasVideo = stream.getVideoTracks().length > 0;
    if (this.currentCall?.call_type === "video") {
      this.addRemoteVideoToGrid(userId, stream, hasVideo);
    } else {
      this.createRemoteAudioElement(userId, stream);
    }

    stream.getVideoTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        this.updateParticipantVideoStatus(userId, false);
      });
    });
  }

  addRemoteVideoToGrid(userId, stream, hasVideo) {
    const gridContainer = document.getElementById("remote-videos-grid");
    if (!gridContainer) return;

    const userName = this.participantNames.get(userId) || `User ${userId}`;
    const userInitials = this.getInitials(userName);
    const id = `remote-video-${userId}`;
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.className = "remote-video-item";
    wrap.id = id;

    if (hasVideo && stream.getVideoTracks()[0]?.enabled) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.srcObject = stream;
      v.onloadedmetadata = () => v.play().catch(() => {});
      wrap.appendChild(v);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "video-placeholder";
      placeholder.innerHTML = `
        <div class="avatar">${userInitials}</div>
        <span>Camera off</span>`;
      wrap.appendChild(placeholder);

      const a = document.createElement("audio");
      a.autoplay = true;
      a.srcObject = stream;
      wrap.appendChild(a);
    }

    const overlay = document.createElement("div");
    overlay.className = "video-overlay";
    overlay.innerHTML = `
      <span class="status-dot ${this.participantVideoStatus.get(userId) === false ? "muted" : ""}"></span>
      <span>${userName}</span>`;
    wrap.appendChild(overlay);

    gridContainer.appendChild(wrap);
  }

  createRemoteAudioElement(userId, stream) {
    const existing = document.getElementById(`remote-audio-${userId}`);
    if (existing) existing.remove();

    const a = document.createElement("audio");
    a.id = `remote-audio-${userId}`;
    a.autoplay = true;
    a.style.display = "none";
    a.srcObject = stream;

    const audioContainer = document.getElementById("audioContainer") || document.body;
    audioContainer.appendChild(a);
  }

  /* ----------------------------- UI toggles ------------------------------- */

  toggleMute() {
    if (!this.localStream) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack) {
      showNotification('No audio track available to mute','danger');
      return;
    }

    this.isMuted = !this.isMuted;
    audioTrack.enabled = !this.isMuted;

    this.updateMuteButton();
    this.updateVideoControls();

    this.socket.emit("call:toggle-audio", {
      callId: this.currentCall?.id,
      isMuted: this.isMuted,
    });
  }

  async toggleVideo() {
    if (this.isVideoEnabled) {
      const videoTrack = this.localStream?.getVideoTracks()[0];
      if (videoTrack) videoTrack.enabled = false;
      this.isVideoEnabled = false;
    } else {
      if (!this.hasVideoPermission) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((t) => t.stop());
          this.hasVideoPermission = true;
        } catch (e) {
          this.showError("Could not access camera. Please allow camera access.");
          return;
        }
      }

      if (!this.localStream) {
        await this.ensureLocalStream(true);
      } else {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
        } else {
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.localStream.addTrack(videoStream.getVideoTracks()[0]);
          } catch (e) {
            return;
          }
        }
      }
      this.isVideoEnabled = true;
    }

    this.updateVideoButton();
    this.updateVideoControls();

    this.socket.emit("call:toggle-video", {
      callId: this.currentCall?.id,
      isVideoEnabled: this.isVideoEnabled,
    });
  }

  showIncomingCallModal(call) {
    if (this.activeModals.has("incoming")) return;
    this.activeModals.add("incoming");

    this.currentCall = call;
    this.playIncomingRingtone();

    const caller = call.call_mode === "direct" ? call.initiator : call.group;
    const callerName = caller.name;
    const callerInitials = this.getInitials(callerName);

    if (call.call_mode === "direct") {
      this.participantNames.set(call.initiator.id, callerName);
    }

    const avatarInitialsElem = document.querySelector("#incomingcall #avatarInitials");
    if (avatarInitialsElem) avatarInitialsElem.textContent = callerInitials;

    const callerNameElem = document.querySelector("#incomingcall #callerName");
    if (callerNameElem) callerNameElem.textContent = callerName;

    const callerLocationElem = document.querySelector("#incomingcall #callerLocation");
    if (callerLocationElem) {
      const callTypeText = call.call_type === "video" ? "Incoming video call" : "Incoming call";
      const modeText = call.call_mode === "direct" ? callTypeText : `Group ${call.call_type} call`;
      callerLocationElem.textContent = modeText;
    }

    const centerConUl = document.querySelector("#incomingcall .center-con ul");
    if (centerConUl) {
      centerConUl.innerHTML = `
        <li>
          <a href="javascript:void(0)" class="icon-btn btn-success button-effect btn-xl is-animating calling answer-call-btn">
            <i data-feather="phone"></i>
          </a>
        </li>
        <li>
          <a href="javascript:void(0)" class="icon-btn btn-danger button-effect btn-xl decline-call-btn">
            <i data-feather="phone-off"></i>
          </a>
        </li>
      `;
    }

    const modalEl = document.getElementById("incomingcall");
    if (modalEl && window.bootstrap?.Modal) {
      const incomingModal = new bootstrap.Modal(modalEl, { backdrop: "static", keyboard: false });
      incomingModal.show();

      modalEl.addEventListener(
        "hidden.bs.modal",
        () => {
          this.activeModals.delete("incoming");
        },
        { once: true }
      );
    }

    if (!this.callTimeout) this.startAutoDeclineTimer("incoming");
  }

  showOutgoingCallModal(call) {
    if (this.activeModals.has("outgoing")) return;
    this.activeModals.add("outgoing");

    this.playOutgoingRingtone();

    const receiver = call.call_mode === "direct" ? call.receiver : call.group;
    const receiverName = receiver.name;
    const receiverInitials = this.getInitials(receiverName);

    if (call.call_mode === "direct") {
      this.participantNames.set(call.receiver.id, receiverName);
    }

    const avatarInitialsElem = document.querySelector("#audiocall #avatarInitials");
    if (avatarInitialsElem) avatarInitialsElem.textContent = receiverInitials;

    const callerNameElem = document.querySelector("#audiocall #callerName");
    if (callerNameElem) callerNameElem.textContent = receiverName;

    const callerLocationElem = document.querySelector("#audiocall #callerLocation");
    if (callerLocationElem) {
      const callTypeText = call.call_type === "video" ? "Video calling..." : "Calling...";
      callerLocationElem.textContent = callTypeText;
    }

    const centerConUl = document.querySelector("#audiocall .center-con ul");
    if (centerConUl) {
      centerConUl.innerHTML = `
        <li>
          <a href="javascript:void(0)" class="icon-btn mic button-effect btn-xl mute-toggle-btn">
            <i data-feather="mic"></i>
          </a>
        </li>
        <li>
          <a href="javascript:void(0)" class="icon-btn btn-danger button-effect btn-xl cancel-call-btn">
            <i data-feather="phone"></i>
          </a>
        </li>
      `;
    }

    const modalEl = document.getElementById("audiocall");
    if (modalEl && window.bootstrap?.Modal) {
      const audioModal = new bootstrap.Modal(modalEl, { backdrop: "static", keyboard: false });
      audioModal.show();

      modalEl.addEventListener(
        "hidden.bs.modal",
        () => {
          this.activeModals.delete("outgoing");
        },
        { once: true }
      );
    }

    if (!this.callTimeout) this.startAutoDeclineTimer("outgoing");
  }

  showActiveCallUI() {
    const callerLocationElem = document.querySelector(".call-ui.show #callerLocation");
    if (callerLocationElem) {
      const callType = this.currentCall?.call_type === "video" ? "Video call" : "Voice call";
      callerLocationElem.textContent = `${callType} • Connected`;
    }

    const centerConUl = document.querySelector(".call-ui.show .center-con ul");
    if (centerConUl) {
      centerConUl.innerHTML = `
        <li>
          <a href="javascript:void(0)" class="icon-btn mic button-effect btn-xl mute-toggle-btn">
            <i data-feather="mic${this.isMuted ? "-off" : ""}"></i>
          </a>
        </li>
        <li>
          <a href="javascript:void(0)" class="icon-btn btn-danger button-effect btn-xl end-call-btn">
            <i data-feather="phone-off"></i>
          </a>
        </li>
      `;
    }

    if (!this.callTimer) this.startCallTimer();
  }

  updateMuteButton() {
    const muteButtons = document.querySelectorAll(".mute-toggle-btn, #video-mute-btn");
    muteButtons.forEach((btn) => {
      if (btn) {
        btn.innerHTML = `<i data-feather="${this.isMuted ? "mic-off" : "mic"}"></i>`;
        btn.classList.toggle("muted", this.isMuted);
      }
    });
  }

  updateVideoButton() {
    const videoBtn = document.querySelector(".video-toggle-btn");
    if (videoBtn && this.hasVideoPermission) {
      videoBtn.innerHTML = `<i data-feather="${this.isVideoEnabled ? "video" : "video-off"}"></i>`;
    }
  }

  addParticipantToUI(userId) {
    const userName = this.participantNames.get(userId) || `User ${userId}`;
  }

  removeParticipantFromUI(userId) {
    const audioElement = document.getElementById(`remote-audio-${userId}`);
    if (audioElement) audioElement.remove();

    const videoElement = document.getElementById(`remote-video-${userId}`);
    if (videoElement) videoElement.remove();

    this.remoteVideoStreams.delete(userId);
  }

  updateParticipantAudioStatus(userId, isMuted) {
    const dot = document.querySelector(`#remote-video-${userId} .video-overlay .status-dot`);
    if (dot) dot.classList.toggle("muted", isMuted);
  }

  updateParticipantVideoStatus(userId, isVideoEnabled) {
    this.participantVideoStatus.set(userId, isVideoEnabled);

    const container = document.getElementById(`remote-video-${userId}`);
    if (!container) return;

    const userName = this.participantNames.get(userId) || `User ${userId}`;
    const userInitials = this.getInitials(userName);

    container.innerHTML = "";
    const stream = this.remoteVideoStreams.get(userId);
    if (!stream) return;

    if (isVideoEnabled && stream.getVideoTracks().length > 0) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.srcObject = stream;
      v.onloadedmetadata = () => v.play().catch(() => {});
      container.appendChild(v);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "video-placeholder";
      placeholder.innerHTML = `
        <div class="avatar">${userInitials}</div>
        <span>Camera off</span>`;
      container.appendChild(placeholder);

      const a = document.createElement("audio");
      a.autoplay = true;
      a.srcObject = stream;
      container.appendChild(a);
    }

    const overlay = document.createElement("div");
    overlay.className = "video-overlay";
    overlay.innerHTML = `
      <span class="status-dot"></span>
      <span>${userName}</span>`;
    container.appendChild(overlay);
  }

  updateConnectionStatus(userId, status) {
    const userName = this.participantNames.get(userId) || `User ${userId}`;
    const statusElement = document.getElementById("video-call-status");
    if (statusElement && this.currentCall?.call_type === "video") {
      if (status === "connected") statusElement.textContent = "Connected";
      else if (status === "connecting") statusElement.textContent = "Connecting...";
      else if (status === "disconnected" || status === "failed") statusElement.textContent = "Connection issues";
    }
  }

  closeCallModal() {
    setTimeout(() => {
      const modalAudioEl = document.getElementById("audiocall");
      if (modalAudioEl && window.bootstrap?.Modal) {
        const audioModal = bootstrap.Modal.getInstance(modalAudioEl);
        if (audioModal) {
          audioModal.hide();
          this.activeModals.delete("outgoing");
        }
      }
      const modalIncomingEl = document.getElementById("incomingcall");
      if (modalIncomingEl && window.bootstrap?.Modal) {
        const incomingModal = bootstrap.Modal.getInstance(modalIncomingEl);
        if (incomingModal) {
          incomingModal.hide();
          this.activeModals.delete("incoming");
        }
      }
    }, 800);
  }

  endCurrentCall() {
    this.stopRingtones();
    this.stopCallTimer();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.peerConnections.clear();
    this.pendingIceQueues.clear();
    this.remoteVideoStreams.clear();
    this.participantVideoStatus.clear();

    if (this.currentCall) {
      this.socket.emit("call:leave", { callId: this.currentCall.id });
    }

    this.currentCall = null;
    this.isCallActive = false;
    this.isMuted = false;
    this.isVideoEnabled = false;
    this.activeModals.clear();

    const videoContainer = document.getElementById("main-video-container");
    if (videoContainer) videoContainer.classList.remove("active");

    this.closeCallModal();

    document.querySelectorAll('[id^="remote-audio-"], [id^="remote-video-"]').forEach((el) => el.remove());

    const localVideo = document.getElementById("local-video");
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.style.display = "none";
    }

    const localVideoPreview = document.getElementById("localVideoPreview");
    if (localVideoPreview) localVideoPreview.remove();
  }

  /* ------------------------------ Misc helpers ---------------------------- */

  getInitials(name) {
    return (name || "")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  updateCallStatus(message) {
    const statusElements = document.querySelectorAll("#audiocall #callerLocation, #incomingcall h6");
    statusElements.forEach((el) => {
      el.textContent = message;
    });
  }

  showError(message) {
    showNotification(message,'danger');
    showChatActionConfirmation(message);
  }
}