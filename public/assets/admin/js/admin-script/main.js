'use strict';

import { initTable } from "./modules/init-table.js";
import { deleteModal, getDataFromRow, changeStatus, setupToggleHandler, 
  updatePageContent, attachTableEvents , showButtonSpinner, showNotification,createFormHandler } from "./modules/events.js";
import {  renderUserRow, renderFaqRow, renderWallpaperRow , renderStickerRow, renderReports, 
  renderContactRow, renderDeletedAccountRow,renderReportRow } from "./modules/helper.js";
import { Logger } from "./modules/utils/logger.js";
import { DashboardChartManager } from "./modules/dashboard.js";

// ===== Configuration ===== //
const CONFIG = {
  tables: {
    user: {
      id: "userTable",
      fetchUrl: "/admin/user/all",
      columns: 6,
      renderer: renderUserRow,
      events: {
        dataKey: "user",
        endpoints: {
          edit: "/admin/user/edit",
          delete: "/admin/user/delete",
          status: "/admin/user/status"
        },
        fieldMap: {
          name: "edit-name",
          email: "edit-email",
          username: "edit-username",
          phone: "edit-phone",
          role: "edit-role",
          status: "edit-status"
        },
        modalId: "editUserModal",
        formId: "editUser",
        statusMap: (val) => val === "active"
      }
    },
    faq: {
      id: "faqTable",
      fetchUrl: "/admin/faq/all",
      columns: 5,
      renderer: renderFaqRow,
      events: {
        dataKey: "faq",
        endpoints: {
          edit: "/admin/faq/edit",
          delete: "/admin/faq/delete",
          status: "/admin/faq/status"
        },
        fieldMap: {
          title: "title",
          description: "description",
          status: "status"
        },
        modalId: "editFAQ",
        formId: "edit-faq"
      }
    },
    wallpaper: {
      id: "wallpaperTable",
      fetchUrl: "/admin/wallpaper/all",
      columns: 7,
      renderer: renderWallpaperRow,
      events: {
        dataKey: "wallpaper",
        endpoints: {
          edit: "/admin/wallpaper/edit",
          delete: "/admin/wallpaper/delete",
        },
        fieldMap: {
          name: "name",
          is_active:"is_active",
        },
        modalId: "editWallpaper",
        formId: "edit-wallpaper"
      }
    },
    sticker: {
      id:"stickerTable",
      fetchUrl: "/admin/sticker/all",
      columns: 6,
      renderer: renderStickerRow,
      events: {
        dataKey: "sticker",
        endpoints: {
          edit: "/admin/sticker/edit",
          delete: "/admin/sticker/delete",
          status: "/admin/sticker/status"
        },
        fieldMap: {
          title: "title",
          status:"stickerStatus"
        },
        modalId: "editSticker",
        formId: "edit-sticker"
      }
    },
    report: {
      id:"reportTable",
      fetchUrl: "/admin/account-report/all",
      columns: 11,
      renderer: renderReports,
      events: {
        dataKey: "report",
        endpoints: {
          edit: "/admin/account-report/edit",
        },
        fieldMap: {
          admin_notes: "admin_notes",
          status:"status"
        },
        modalId: "editReport",
        formId: "edit-report"
      }
    },
    contact: {
      id: "contactTable",
      fetchUrl: "/admin/contact/all",
      columns: 6,
      renderer: renderContactRow,
    },
    deletedAccount: {
      id: "deleteAccountTable",
      fetchUrl: "/admin/deleted-accounts/all",
      columns: 5,
      renderer: renderDeletedAccountRow,
    },
    reportSetting: {
      id: "reportSettingTable",
      fetchUrl: "/admin/report/all",
      columns: 4,
      renderer: renderReportRow,
      events: {
        dataKey: "report",
        endpoints: {
          edit: "/admin/report/edit",
          delete: "/admin/report/delete",
        },
        fieldMap: {
          title: "title",
        },
        modalId: "edit-report-modal",
        formId: "edit-report-setting"
      }
    },
  },
  pages: {
    privacy: {
      formId: "privacy-page",
      slugId: "privacy-policy",
      contentId: "privacy_content"
    },
    terms: {
      formId: "terms-page",
      slugId: "terms-and-conditions",
      contentId: "term_content"
    }
  }
};

// ===== Core Application ===== //
class AdminPanel {
  constructor() {
    this.logger = new Logger('AdminPanel');
    this.tables = {};
    this.domElements = {};
    this.dashboardManager = null;
  }

  initialize() {
    try {
      this.logger.debug('Initializing admin panel');
      
      // DOM Pre-Caching
      this.cacheDomElements();

      // Initialize Dashboard if on dashboard page
      this.initializeDashboard();
      
      // Table Initialization
      this.initializeTables();
      
      // Event Setup
      this.setupEventHandlers();

      this.logout();
      this.showSpinner();
      
      this.logger.info('Admin panel initialized successfully');
    } catch (error) {
      this.logger.error('Initialization failed', error);
      showNotification('Application Error','dangerF');
    }
  }

  cacheDomElements() {
    this.domElements = {
      wallpaperTable: document.getElementById("wallpaperTable"),
      settingToggles: document.querySelectorAll('input[data-settingKey]'),

      // Logout
      logoutTrigger: document.querySelector("[data-logout]"),
      statusForm: document.getElementById("status-form"),
      statusConfirmBtn: document.getElementById("status-confirm-btn"),
      statusModal: document.getElementById("status-modal"),

      allForms: document.querySelectorAll("form"),
    };
    
    // Cache all table elements
    for (const [key, config] of Object.entries(CONFIG.tables)) {
      if(config.id){
        this.domElements[`${key}Table`] = document.getElementById(config.id);
      }
    }
  }
  
  initializeTables() {
    for (const [key, config] of Object.entries(CONFIG.tables)) {
      try {
        this.tables[key] = initTable({
          tableId: config.id,
          fetchUrl: config.fetchUrl,
          columns: config.columns,
          renderRow: config.renderer
        });
      } catch (error) {
        this.logger.error(`Failed to initialize ${key} table`, error);
      }
    }
  }

  initializeDashboard() {
    if (DashboardChartManager.isDashboardPage()) {
      this.dashboardManager = new DashboardChartManager();
      this.dashboardManager.initialize();
      this.logger.debug('Dashboard charts initialized');
    }
  }

  setupEventHandlers() {
    // Table Events
    const eventConfigs = [];
    
    for (const [key, config] of Object.entries(CONFIG.tables)) {
      if (config.events) {
        eventConfigs.push({
          ...config.events,
          tableElement: this.domElements[`${key}Table`],
          tableInstance: this.tables[key]
        });
      }
    }
    
    if (eventConfigs.length) {
      attachTableEvents(eventConfigs);
    }

    this.setupWallpaperEvents();
    
    this.initializeSettingsToggles();
    
    this.initializePageHandlers();
  }

  setupWallpaperEvents() {
    this.domElements.wallpaperTable?.addEventListener("click", (e) => {
      e.preventDefault();

      const target = e.target.closest("[data-action]") || e.target;
      
      try {
        const action = target.dataset.action || 
                      (target.closest(".changeStatus") ? "status" : 
                       target.closest(".changeDefault") ? "default" : 
                       target.closest(".delete-btn") ? "delete" : null);
                       
        if (!action) return;
        
        const cw = getDataFromRow(target, "wallpaper");
        if (!cw) return;
        
        switch(action) {
          case "status":
            this.handleWallpaperToggle(target, action, cw);
            break;
          case "delete":
            this.handleWallpaperDelete(cw);
            break;
        }
      } catch (error) {
        this.logger.error('Wallpaper event handler failed', error);
      }
    });
  }

  handleWallpaperToggle(target, type, cw) {
    const status = type === "status" ? cw.is_active : cw.is_default;
    const field = type === "status" ? "is_active" : "is_default";
    
    changeStatus({
      id: cw.id,
      status: status,
      endpoint: `/admin/wallpaper/status?field=${field}`,
      modalId: "faq-status-modal",
      formId: "faq-status-form",
      reloadInstance: this.tables.wallpaper,
    });
  }

  handleWallpaperDelete(cw) {
    deleteModal({
      id: cw.id,
      endpoint: "/admin/wallpaper/delete",
      reloadInstance: this.tables.wallpaper,
    });
  }

  initializeSettingsToggles() {
    this.domElements.settingToggles?.forEach(toggle => {
      const key = toggle.dataset.settingkey;
      setupToggleHandler({ key });  
    });
  }

  initializePageHandlers() {
    for (const config of Object.values(CONFIG.pages)) {
      updatePageContent(config);
    }
  }

  logout() {
    const { logoutTrigger, statusForm, statusConfirmBtn, statusModal } = this.domElements;
    logoutTrigger?.addEventListener("click", () => {
      const modal = new bootstrap.Modal(statusModal);
      modal.show();

      statusForm.onsubmit = (e) => {
        e.preventDefault();
        showButtonSpinner(statusConfirmBtn);
        setTimeout(() => {
          window.location.href = "/admin/auth/logout";
        }, 500);
      };
    });
  }

  showSpinner() {
    const { allForms } = this.domElements;
    allForms.forEach((form) => {
      form.addEventListener("submit", function () {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) showButtonSpinner(submitButton);
      });
    });
  }
}

// Generic form submit handler
function handleAdminFormSubmit(formId, url, onSuccess, onError) {
  return createFormHandler(formId, async (form) => {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    const originalBtn = submitBtn.textContent;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (res.ok) {
        if (typeof onSuccess === 'function') onSuccess(result, form);
      } else {
        if (typeof onError === 'function') onError(result, form);
        else showNotification(result.error || 'Operation failed', 'danger');
      }
    } catch (err) {
      const errorObj = new Error('Form submission failed');
      errorObj.details = err;
      showNotification('Something went wrong', 'danger');
      console.error(errorObj);
    } finally {
      submitBtn.innerHTML = originalBtn;
    }
  });
};

// Update Admin Password
function updateAccount() {
  const errorBox = document.getElementById("error-text");
  handleAdminFormSubmit(
    'passwordForm',
    '/admin/account/change-password',
    (result, form) => {
      
      if(result.success){
        showNotification('Password Changed Successfully', 'success');
        form.reset();
        if (errorBox) errorBox.classList.add('d-none');
      }
    },
    (result, form) => {
      if (result.password) {
        const errorBox = document.getElementById('error-text');
        if (errorBox) errorBox.classList.remove('d-none');
      } else {
        showNotification(result.error || 'Failed to change password.', 'danger');
      }
    }
  );
};

// Update Admin Profile
function updateProfile() {
  handleAdminFormSubmit(
    'profileForm',
    '/admin/account/update-profile',
    () => {
      showNotification('Profile Updated Successfully', 'success');
    },
    (result) => {
      showNotification(result.error || 'Failed to update profile.', 'danger');
    }
  );
}

// ===== Initialize System ===== //
document.addEventListener("DOMContentLoaded", () => {
  new AdminPanel().initialize();

  updateAccount();
  updateProfile();
});