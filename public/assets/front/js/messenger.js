'use strict';


document.addEventListener("DOMContentLoaded", async () => {
  if (!window.socket) {
    window.socket = io({
      transports: ['polling'], // Add polling fallback
      secure: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

  }

  window.appCore.setSocket(window.socket);
  await window.appCore.initialize();

  if (document.getElementById('archive-chat')) {
    window.archiveChatLoader = new ArchiveChatLoader();
  }

  if (document.getElementById('block-contact')) {
    window.blockedContactsLoader = new BlockedContactsLoader();
  }

  if (document.getElementById('document')) {
    window.documentLoader = new DocumentLoader();
  }

  if (document.getElementById('favourite')) {
    window.favoriteLoader = new FavoriteLoader();
  }

  if (document.getElementById('contact-list')) {
    window.friendsLoader = new FriendsLoader();
  }

  if (document.getElementById('notification')) {
    window.notificationLoader = new NotificationLoader();
  }

  const socket = window.socket;
  const currentUserId = window.appCore.currentUserId;
  const systemSetting = window.appCore.systemSetting;

  window.chatLoader = new ChatLoader(window.appCore.currentUserId);
  window.callLoader = new CallLoader();
  window.contactLoader = new ContactLoader();
  window.chatSearchManager = new ChatSearchManager();

  window.chatManagement = new ChatManagement(socket, currentUserId, systemSetting);
  window.messageActions = new MessageActions(socket, currentUserId);
  window.messageSender = new MessageSender(socket, currentUserId, systemSetting);
  window.chatSocketManager = new ChatSocketManager(socket, currentUserId);
  window.callManager = new CallManager(socket, currentUserId, systemSetting);

  window.messageSender.initialize();

  window.customizer = new Customizer();

  initializeModules();
});


function initializeModules() {
  window.chatManagement.initialize();
  window.messageActions.initialize();

  window.appCore.initReportTypeHandler();
  window.appCore.initPrivacySettings();
  window.appCore.initDeleteAccountRequest();
  window.appCore.initChangePassword();

  window.appCore.newOption();
  window.appCore.recentSearch();
  window.appCore.chatBackup();
  window.appCore.submitContact();
  window.appCore.logOut();
  window.appCore.driveConnectedModal();

  window.customizer.initialize();
  window.customizer.applyTheme();
}