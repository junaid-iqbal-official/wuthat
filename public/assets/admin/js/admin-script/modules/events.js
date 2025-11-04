'use strict';

// ========== MODAL UTILITIES ========== //
const modalCache = new Map();
const DOM_CACHE = {};

export function openModal(modalId) {
  if (modalCache.has(modalId)) {
    const modal = modalCache.get(modalId);
    modal.show();
    return modal;
  }

  const modalEl = document.getElementById(modalId);
  if (!modalEl) {
    console.warn(`Modal with ID "${modalId}" not found.`);
    return null;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modalCache.set(modalId, modal);
  modal.show();
  return modal;
}

// ========== Toaster ========== //
function getElements(selector, useCache = true) {
  if (useCache && DOM_CACHE[selector]) return DOM_CACHE[selector];

  const elements = document.querySelectorAll(selector);
  if (useCache && elements.length) DOM_CACHE[selector] = elements;
  return elements;
}

// Helper function to show Toaster
export function showNotification(message, type = 'primary') {
  const existingAlerts = getElements('.alert-notification', false);
  existingAlerts.forEach(alert => alert.remove());

  const notification = document.createElement('div');
  notification.className = `alert alert-${type} alert-notification alert-dismissible fade show position-fixed`;
  notification.innerHTML = `${message} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 20000);
}

// ========== Display / hide spinner ========== //
export function showButtonSpinner(button) {
  if (!button) return;

  button.disabled = true;
  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent.trim();
  }

  let spinner = button.querySelector(".btn-spinner");
  if (!spinner) {
    spinner = document.createElement("span");
    spinner.className = "btn-spinner spinner-border spinner-border-sm ms-2";
    spinner.setAttribute("role", "status");
    spinner.setAttribute("aria-hidden", "true");

    button.appendChild(spinner);
  }
}

export function hideButtonSpinner(button) {
  if (!button) return;

  button.disabled = false;
  const originalText = button.dataset.originaltext;

  if (originalText) {
    button.textContent = originalText;
    delete button.dataset.originalText;
  }

  const spinner = button.querySelector('.btn-spinner');
  if (spinner) spinner.remove();
}

// ========== API SERVICE ========== //
function isFormData(value) {
  return value instanceof FormData;
}

export async function fetchPost(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: isFormData(payload) ? undefined : { "Content-Type": "application/json" },
      body: isFormData(payload) ? payload : JSON.stringify(payload),
      credentials: 'include'
    });

    if (!response.ok) {
      showNotification(`HTTP error! status: ${response.status}`, 'danger');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API Request Failed:', { url, error });
    showNotification('Something Went Wrong', 'danger');
    return null;
  }
}

// ========== TABLE ROW UTILITIES ========== //
export function getDataFromRow(element, dataKey) {
  const row = element.closest(`tr[data-${dataKey}]`);
  if (!row) return null;

  try {
    const data = decodeURIComponent(row.dataset[dataKey]);
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to parse ${dataKey} data:`, error);
    return null;
  }
}

export function getEditFormData(formId, fieldMap) {
  const form = document.getElementById(formId);
  if (!form) {
    showNotification(`Form with ID "${formId}" not found.`, 'danger');
    console.error(`Form with ID "${formId}" not found.`);
    return null;
  }

  return Object.entries(fieldMap).reduce((data, [key, inputName]) => {
    const input = form.querySelector(`[name="${inputName}"], #${inputName}`);
    data[key] = input?.type === 'checkbox' ? input.checked : input?.value || '';
    return data;
  }, {});
}

// ========== ACTION HANDLERS ========== //
export function createFormHandler(formId, callback) {
  const form = document.getElementById(formId);
  if (!form) return null;

  const handler = async (e) => {
    e.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');

    try {
      showButtonSpinner(submitButton);
      await callback(form);
    } catch (error) {
      console.error(`Form ${formId} submission failed:`, error);
    } finally {
      hideButtonSpinner(submitButton);
    }
  };

  form.removeEventListener('submit', handler);
  form.addEventListener('submit', handler);
  return handler;
}

export function deleteModal({ id, endpoint, reloadInstance }) {
  const bsModal = openModal("delete-modal");
  if (!bsModal) return;

  try {
    createFormHandler("delete-form", async () => {
      const data = await fetchPost(endpoint, { id });
      if (data.success) {
        bsModal.hide();
        showNotification("Record Deleted Successfully", 'success');
        reloadInstance?.reload();
      }
    });
  } catch (error) {
    showNotification('Something Went Wrong', 'danger');
    return;
  }
}

export function changeStatus({ id, status, endpoint, reloadInstance }) {
  const bsModal = openModal("status-modal");
  if (!bsModal) return;

  createFormHandler("status-form", async (form) => {
    const submitButton = form.querySelector('button[type="submit"]');

    try {
      const data = await fetchPost(endpoint, { id, status });

      if (data.success || data.message === "success") {
        bsModal.hide();
        showNotification("Status updated Successfully", 'success');
        reloadInstance?.reload();
      }
    } catch (error) {
      showNotification(error.message || 'Something Went Wrong', 'danger');
      console.error("Status update failed:", error);
      return;

    } finally {
      hideButtonSpinner(submitButton)
    }
  });
}

export function editItemModal({
  item,
  modalId,
  formId,
  endpoint,
  fieldMap,
  extraFields = {},
  instanceToReload,
  statusMap = (val) => val
}) {
  const form = document.getElementById(formId);
  const bsModal = openModal(modalId);
  if (!form || !bsModal) return;

  Object.entries(fieldMap).forEach(([key, selector]) => {
    const input = form.querySelector(`[name="${selector}"], #${selector}`);
    if (!input) return;
    input[input.type === 'checkbox' ? 'checked' : 'value'] = input.type === 'checkbox' ? statusMap(item[key]) : item[key] || '';
  });

  function formHasFiles(formElement) {
    const fileInputs = formElement.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
      if (input.files.length > 0) return true;
    }
    return false;
  }

  createFormHandler(formId, async () => {
    const formElement = document.getElementById(formId);
    const submitButton = formElement.querySelector('button[type="submit"]');
    let payload;

    try {
      showButtonSpinner(submitButton);

      if (formHasFiles(formElement)) {
        payload = new FormData(formElement);
        // append extraFields to FormData
        payload.append(`${item.type || ''}id`, item.id);
        for (const [key, val] of Object.entries(extraFields)) {
          payload.append(key, val);
        }
      } else {
        // create a JSON object
        const formData = new FormData(formElement);
        payload = {};
        formData.forEach((value, key) => {
          payload[key] = value;
        });
        // add extraFields
        payload[`${item.type || ''}id`] = item.id;
        Object.assign(payload, extraFields);
      }

      const data = await fetchPost(endpoint, payload);
      if (data.success) {
        bsModal.hide();
        showNotification(data.message || 'Record updated Successfully', 'success');
        instanceToReload?.reload();
      } else {
        showNotification(data.message || 'Something went wrong', 'danger');
      }
    } catch (error) {
      console.error('Edit form error:', error);
      showNotification('An unexpected error occurred.', 'danger');

    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = submitButton.dataset.originalText || 'Submit';
        delete submitButton.dataset.originalText;
      }
    }
  });
}

// ========== EVENT MANAGEMENT ========== //
export function attachTableEvents(configs = []) {
  configs.forEach(config => {
    const { tableElement, dataKey, endpoints, fieldMap, modalId, formId, tableInstance, statusMap } = config;
    if (!tableElement) return;

    tableElement.addEventListener("click", (e) => {
      const getActionData = (selector) => {
        const element = e.target.closest(selector);
        return element ? getDataFromRow(element, dataKey) : null;
      };

      const data = getActionData(".changeStatus") || getActionData(".edit-btn") || getActionData(".delete-btn");
      if (!data) return;

      if (e.target.closest(".changeStatus")) {
        e.preventDefault();
        changeStatus({
          id: data.id,
          status: data.status,
          endpoint: endpoints.status,
          reloadInstance: tableInstance
        });
      } else if (e.target.closest(".edit-btn")) {
        editItemModal({
          item: data,
          endpoint: endpoints.edit,
          modalId,
          formId,
          fieldMap,
          instanceToReload: tableInstance,
          ...(statusMap && { statusMap })
        });
      } else if (e.target.closest(".delete-btn")) {
        deleteModal({
          id: data.id,
          endpoint: endpoints.delete,
          reloadInstance: tableInstance
        });
      }
    });
  });
}

export function setupToggleHandler({ key }) {
  const toggle = document.getElementById(key);
  const form = document.getElementById("setting-toggle-form");
  if (!toggle || !form) return;

  toggle.addEventListener("click", (e) => {
    e.preventDefault();

    const modalEl = openModal("setting-confirmation");
    if (!modalEl) return;

    createFormHandler("setting-toggle-form", async () => {
      const currentStatus = toggle.checked;
      const data = await fetchPost("/admin/setting/toggle-setting", {
        settingKey: key,
        currentStatus
      });

      if (data.success) {
        toggle.checked = !currentStatus;
        modalEl.hide();
        showNotification(data.message || "Setting updated Successfully", 'success');
      } else {
        showNotification(data.message || "Something went wrong", 'danger');
      }
    });
  });
}

export function updatePageContent({ formId, contentId, slugId }) {
  createFormHandler(formId, async () => {
    // Sync CKEditor content before getting form values
    if (window.CKEDITOR) {
      Object.values(CKEDITOR.instances).forEach(instance => instance.updateElement());
    }
    const content = document.getElementById(contentId)?.value || '';
    const slug = document.getElementById(slugId)?.value || '';

    try {
      const data = await fetchPost("/admin/page/update", { content, slug });

      if (data?.success) {
        showNotification("Content updated", 'success');
      } else {
        showNotification(data.message || "Something went wrong", 'danger');
      }
    } catch (error) {
      console.error("Page update failed:", error);
      showNotification("Error updating page content", 'danger');
    }
  });
}