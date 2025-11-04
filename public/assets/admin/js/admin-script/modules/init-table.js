'use strict';

// === Server-side rendered Data-table ===
export function initTable({ tableId, fetchUrl, renderRow, columns }) {

  const state = {
    currentPage: 1,
    sortField: "id",
    sortOrder: "desc",
    searchQuery: "",
    limit: 10,
    totalPages: 1
  };

  // DOM references with null checks
  const tableEl = document.getElementById(tableId);
  if (!tableEl) {
    return {
      reload: () => console.warn(`Table ${tableId} not found, cannot reload`),
      getState: () => ({ currentPage: 1, sortField: "id", sortOrder: "desc", searchQuery: "", limit: 10, totalPages: 1 }),
      getDomRefs: () => ({})
    };
  }

  const dom = {
    tbody: tableEl.querySelector("tbody"),
    pagination: document.getElementById(`${tableId}-pagination`),
    searchInput: document.getElementById(`${tableId}-search`),
    limitSelect: document.getElementById(`${tableId}-limit`),
    tableLabel: document.getElementById(`${tableId}-label`),
    sortableHeaders: document.querySelectorAll(`th.${tableId}-sortable`)
  };

  // API Request with caching
  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        page: state.currentPage,
        limit: state.limit,
        sortField: state.sortField,
        sortOrder: state.sortOrder,
        search: state.searchQuery
      });

      const response = await fetch(`${fetchUrl}?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      state.totalPages = data.totalPages || 1;
      
      renderTable(data.items || []);
      renderPagination(state.totalPages, data.currentPage || state.currentPage);
      updateStatusLabel(data.itemCount || 0, data.currentPage || state.currentPage);
    } catch (err) {
      const errorObj = new Error("Failed to fetch table data");
      errorObj.details = err;
      console.error(errorObj);
      
      showError();
    }
  };

  const renderTable = (items) => {
    if (!items.length) {
      dom.tbody.innerHTML = `<tr><td class="text-center" colspan="${columns}">No data found</td></tr>`;
      return;
    }
    dom.tbody.innerHTML = items.map((item, index) => renderRow(item, index, state)).join("");
  };

  const renderPagination = (totalPages, currentPageNum) => {
    if (!dom.pagination) return;

    const maxPages = 5;
    let start = Math.max(1, currentPageNum - 2);
    let end = Math.min(totalPages, start + maxPages - 1);

    if (end - start < maxPages - 1) {
      start = Math.max(1, end - maxPages + 1);
    }

    // Generate page buttons
    const pages = Array.from({ length: end - start + 1 }, (_, i) => {
      const pageNum = start + i;
      const active = pageNum === currentPageNum ? "current" : "";
      return `<button class="dt-paging-button ${active}" data-page="${pageNum}">${pageNum}</button>`;
    }).join("");

    // Navigation buttons state
    const prevDisabled = currentPageNum <= 1 ? "disabled" : "";
    const nextDisabled = currentPageNum >= totalPages ? "disabled" : "";

    dom.pagination.innerHTML = `
      <button class="dt-paging-button first ${prevDisabled}" data-page="1">«</button>
      <button class="dt-paging-button previous ${prevDisabled}" data-page="1">‹</button>
      ${pages}
      <button class="dt-paging-button next ${nextDisabled}" data-page="${totalPages}">›</button>
      <button class="dt-paging-button last ${nextDisabled}" data-page="${totalPages}">»</button>
    `;
  };

  const updateStatusLabel = (total, page) => {
    if (!dom.tableLabel) return;
    const start = (page - 1) * state.limit + 1;
    const end = Math.min(page * state.limit, total);
    dom.tableLabel.textContent = total > 0 
      ? `Showing ${start} to ${end} of ${total} entries` 
      : "No entries found";
  };

  const showError = () => {
    if (dom.tbody) {
      dom.tbody.innerHTML = `<tr><td colspan="${columns}">Error loading data</td></tr>`;
    }
  };

  // Event utilities
  const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  // Event handlers
  const setupEventListeners = () => {
    // Pagination
    if (dom.pagination) {
      dom.pagination.addEventListener("click", (e) => {
        const page = e.target.dataset.page;
        if (page) {
          state.currentPage = parseInt(page,10);
          fetchData();
        }
      });
    }

    // Search
    if (dom.searchInput) {
      const handleSearch = debounce(() => {
        state.searchQuery = dom.searchInput.value.trim();
        state.currentPage = 1;
        fetchData();
      }, 500);
      dom.searchInput.addEventListener("input", handleSearch);
    }

    // Limit change
    if (dom.limitSelect) {
      dom.limitSelect.addEventListener("change", () => {
        state.limit = parseInt(dom.limitSelect.value,10);
        state.currentPage = 1;
        fetchData();
      });
    }

    // Column sorting
    dom.sortableHeaders.forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (!field) return;
        
        if(state.sortOrder === 'asc'){
          th.classList.remove('descending');
          th.classList.add('ascending');
        }else{
          th.classList.add('descending');
          th.classList.remove('ascending');
        }
        
        if (state.sortField === field) {
          state.sortOrder = state.sortOrder === "asc" ? "desc" : "asc";
        } else {
          state.sortField = field;
          state.sortOrder = "asc";
        }
        state.currentPage = 1;
        fetchData();
      });
    });
  };

  // Initialization
  setupEventListeners();
  fetchData();

  return {
    reload: fetchData,
    getState: () => ({ ...state }), // For debugging
    getDomRefs: () => ({ ...dom })  // For testing
  };
}