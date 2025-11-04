'use strict';

// === Shared utilities ===
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

const getSerial = (index, state) => (state.currentPage - 1) * state.limit + index + 1;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

const renderSwitch = (id, checked, className = "changeStatus", dataStatus = null) => `
  <div class="form-check-size">
    <div class="form-check form-switch form-check-inline">
      <input class="form-check-input switch-primary check-size ${className}"
        ${dataStatus !== null ? `data-status="${dataStatus}"` : ""}
        ${checked ? "checked" : ""}
        id="status-${id}" type="checkbox">
    </div>
  </div>
`;

const renderActionButtons = () => `
  <ul class="action">
    <li class="edit">
      <div class="edit-btn">
        <i class="fa-regular fa-pen-to-square"></i>
      </div>
    </li>
    <li class="delete">
      <div class="delete-btn">
        <i class="fa-solid fa-trash-can"></i>
      </div>
    </li>
  </ul>
`;

// === Row renderers ===

const renderUserRow = (user, index, state) =>`
  <tr data-user="${encodeURIComponent(JSON.stringify(user))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(user.name)}</td>
    <td>${escapeHtml(user.username ? user.username : '-')}</td>
    <td>${escapeHtml(user.email)}</td>
    <td>${renderSwitch(user.id, user.status === "active", "changeStatus", user.status)}</td>
    <td>${formatDate(user.created_at)}</td>
    <td>${renderActionButtons()}</td>
  </tr>
`;

const renderContactRow = (cnt, index, state) =>`
  <tr data-user="${encodeURIComponent(JSON.stringify(cnt))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(cnt.name)}</td>
    <td>${escapeHtml(cnt.email)}</td>
    <td>${escapeHtml(cnt.subject)}</td>
    <td>${escapeHtml(cnt.message)}</td>
    <td>${formatDate(cnt.created_at)}</td>
  </tr>
`;

const renderDeletedAccountRow = (account, index, state) =>`
  <tr data-user="${encodeURIComponent(JSON.stringify(account))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(account.name)}</td>
    <td>${escapeHtml(account.email)}</td>
    <td><span class="badge bg-${account.status === 'approved' ? 'success' : 'warning'}">${escapeHtml(account.status)}</span></td>
    <td>${formatDate(account.requestedAt)}</td>
  </tr>
`;

const renderFaqRow = (faq, index, state) => `
  <tr data-faq="${encodeURIComponent(JSON.stringify(faq))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(faq.title)}</td>
    <td>${renderSwitch(faq.id, faq.status, "changeStatus", faq.status)}</td>
    <td>${formatDate(faq.created_at)}</td>
    <td>${renderActionButtons()}</td>
  </tr>
`;

const renderReportRow = (report, index, state) => `
  <tr data-report="${encodeURIComponent(JSON.stringify(report))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(report.title)}</td>
    <td>${formatDate(report.created_at)}</td>
    <td>${renderActionButtons()}</td>
  </tr>
`;

const renderWallpaperRow = (cw, index, state) => `
  <tr data-wallpaper="${encodeURIComponent(JSON.stringify(cw))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(cw.name)}</td>
    <td><img class="img-fluid table-avtar" src="${cw.wallpaper}" alt="Image"></td>
    <td>${renderSwitch(cw.id, cw.is_active, "changeStatus", cw.is_active)}</td>
    <td>${formatDate(cw.created_at)}</td>
    <td>${renderActionButtons()}</td>
  </tr>
`;

const renderStickerRow = (st,index,state) => `
  <tr data-sticker="${encodeURIComponent(JSON.stringify(st))}">
    <td>${getSerial(index, state)}</td>
    <td>${escapeHtml(st.title)}</td>
    <td><img class="img-fluid table-avtar" src="${st.sticker}" alt="Image"></td>
    <td>${renderSwitch(st.id, st.status, "changeStatus", st.status)}</td>
    <td>${formatDate(st.created_at)}</td>
    <td>${renderActionButtons()}</td>
  </tr>
`;

const renderReports = (report, index, state) =>{
  const statusColors = {
    pending: "bg-info",
    resolved: "bg-success",
    under_review: "bg-secondary",
    dismissed: "bg-danger"
  };

  const formatStatus = (status) => {
    let formatted = status.replace(/_/g, " ");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const badgeColor = statusColors[report.status] || "bg-secondary";
  const displayStatus = formatStatus(report.status);
  
  return `
    <tr data-report="${encodeURIComponent(JSON.stringify(report))}">
      <td>${getSerial(index, state)}</td>
      <td>${escapeHtml(report.reporter.name)}</td>
      <td>${escapeHtml(report.reported_user.name)}</td>
      <td>${escapeHtml(report.report_type)}</td>
      <td>${escapeHtml(report.description ? report.description : '-')}</td>
      <td><span class="badge ${badgeColor}">${displayStatus}</span></td>
      <td>${escapeHtml(report.admin_notes ? report.admin_notes : '-')}</td>
      <td>${escapeHtml(report.resolver?.name || '-' )}</td>
      <td>${report.resolved_at ? formatDate(report.resolved_at) : '-'}</td>
      <td>${formatDate(report.created_at)}</td>
      <td>
        <ul class="action">
          <li class="edit">
            <div class="edit-btn"><i class="fa-regular fa-pen-to-square"></i></div>
          </li>
        </ul>
      </td>
    </tr> 
  `;
} 

export { 
  renderUserRow, 
  renderFaqRow, 
  renderWallpaperRow, 
  renderStickerRow, 
  renderReports,
  renderContactRow, 
  renderDeletedAccountRow, 
  renderReportRow 
};