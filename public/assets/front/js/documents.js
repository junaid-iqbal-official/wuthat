'use strict';
class DocumentLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.searchTimeout = null;
        this.allDocuments = [];
        this.filteredDocuments = [];
        this.currentSearchTerm = '';
        this.currentUserId = "<%= currentUserId %>";

        this.elements = {
            docList: document.getElementById('doc-list'),
            loadingIndicator: document.getElementById('doc-loading'),
            loadMoreContainer: document.getElementById('doc-load-more-container'),
            loadMoreBtn: document.getElementById('doc-load-more-btn'),
            emptyState: document.getElementById('doc-empty-state'),
            errorState: document.getElementById('doc-error-state'),
            retryBtn: document.getElementById('doc-retry-btn'),
            searchInput: document.getElementById('documentSearch'),
            searchForm: document.querySelector('#document .search-form'),
            searchIcon: document.querySelector('#document .search'),
            closeSearch: document.querySelector('#document .close-search')
        };

        this.init();
    }

    init() {
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
        this.elements.retryBtn.addEventListener('click', () => this.retry());

        this.elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value.trim());
            }, 300);
        });

        this.loadDocuments(1, true);
        this.showLoading(true);
    }

    async loadDocuments(page = 1, isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/messenger/documents?page=${page}&limit=20`);
            const data = await response.json();

            if (data.success) {
                this.renderDocuments(data.documents, isInitial);
                this.updatePagination(data.pagination);
                if (data.documents.length) {
                    this.showDocList();
                }
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showError(isInitial);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    renderDocuments(documents, isInitial = false) {
        if (isInitial) {
            this.elements.docList.innerHTML = '';
        }

        if (documents.length === 0 && isInitial) {
            this.showEmptyState();
            return;
        }

        documents.forEach(doc => {
            const docItem = this.createDocumentItem(doc);
            this.elements.docList.appendChild(docItem);
        });
    }

    createDocumentItem(doc) {
        const li = document.createElement('li');
        li.className = 'document-item';

        const fileIcon = this.getFileIcon(doc.mime_type || doc.file_type);
        const buttonClasses = this.getButtonClasses(doc.mime_type || doc.file_type);
        const formattedDate = new Date(doc.created_at).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const recipientName = doc.recipient ? doc.recipient.name : 'Unknown';
        const groupName = doc.group ? ` in ${doc.group.name}` : '';

        li.innerHTML = `
        <div class="chat-box">
            <div class="d-flex">
                <div class="profile">
                    <a class="${buttonClasses}" href="javascript:void(0)">
                        <i class="${fileIcon}"></i>
                    </a>
                </div>
                <div class="details">
                    <h5>${doc.file_name}</h5>
                    <small class="text-muted">${formattedDate}</small>
                </div>
                <div class="flex-grow-1">
                    <a class="icon-btn btn-outline-light btn-sm pull-right" 
                       href="${doc.file_url}" 
                       target="_blank"
                       title="Download">
                        <i data-feather="download"></i>
                    </a>
                </div>
            </div>
        </div>
    `;

        return li;
    }

    getButtonClasses(mimeType) {
        if (!mimeType) return 'icon-btn btn-outline-secondary btn-xl pull-right rouded15';

        const type = mimeType.split('/')[0];
        const subtype = mimeType.split('/')[1];

        const colorMap = {
            'image': 'btn-outline-success',

            'application/pdf': 'btn-outline-danger',
            'application/msword': 'btn-outline-primary',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'btn-outline-primary',
            'application/vnd.oasis.opendocument.text': 'btn-outline-primary',

            'application/vnd.ms-excel': 'btn-outline-success',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'btn-outline-success',
            'application/vnd.oasis.opendocument.spreadsheet': 'btn-outline-success',
            'text/csv': 'btn-outline-success',

            'application/vnd.ms-powerpoint': 'btn-outline-warning',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'btn-outline-warning',
            'application/vnd.oasis.opendocument.presentation': 'btn-outline-warning',

            'text/plain': 'btn-outline-info',
            'text/rtf': 'btn-outline-info',
            'text/html': 'btn-outline-info',

            'application/zip': 'btn-outline-secondary',
            'application/x-rar-compressed': 'btn-outline-secondary',
            'application/x-7z-compressed': 'btn-outline-secondary',
            'application/x-tar': 'btn-outline-secondary',
            'application/gzip': 'btn-outline-secondary',

            'audio/mpeg': 'btn-outline-primary',
            'audio/wav': 'btn-outline-primary',

            'video/mp4': 'btn-outline-danger',
            'video/x-msvideo': 'btn-outline-danger',
            'video/quicktime': 'btn-outline-danger',

            'application/javascript': 'btn-outline-warning',
            'application/json': 'btn-outline-warning',
            'application/x-httpd-php': 'btn-outline-primary',
            'text/x-python': 'btn-outline-primary',
            'text/x-java-source': 'btn-outline-primary',
            'application/xml': 'btn-outline-success',
        };

        if (colorMap[mimeType]) {
            return `icon-btn ${colorMap[mimeType]} btn-xl pull-right rouded15`;
        }

        if (colorMap[type]) {
            return `icon-btn ${colorMap[type]} btn-xl pull-right rouded15`;
        }

        if (subtype && (subtype.startsWith('vnd.ms-') || subtype.startsWith('vnd.openxmlformats'))) {
            return 'icon-btn btn-outline-primary btn-xl pull-right rouded15';
        }

        return 'icon-btn btn-outline-secondary btn-xl pull-right rouded15';
    }

    getFileIcon(mimeType) {
        if (!mimeType) return 'fa fa-file-o text-muted';

        const type = mimeType.split('/')[0];
        const subtype = mimeType.split('/')[1];

        const iconMap = {
            'image': 'fa fa-file-image-o text-success',

            'application/pdf': 'fa fa-file-pdf-o text-danger',
            'application/msword': 'fa fa-file-word-o text-primary',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'fa fa-file-word-o text-primary',
            'application/vnd.oasis.opendocument.text': 'fa fa-file-word-o text-primary',

            'application/vnd.ms-excel': 'fa fa-file-excel-o text-success',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'fa fa-file-excel-o text-success',
            'application/vnd.oasis.opendocument.spreadsheet': 'fa fa-file-excel-o text-success',
            'text/csv': 'fa fa-file-excel-o text-success',

            'application/vnd.ms-powerpoint': 'fa fa-file-powerpoint-o text-warning',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': '   text-warning',
            'application/vnd.oasis.opendocument.presentation': 'fa fa-file-powerpoint-o text-warning',

            'text/plain': 'fa fa-file-text-o text-primary',
            'text/rtf': 'fa fa-file-text-o text-primary',
            'text/html': 'fa fa-file-code-o text-primary',

            'application/zip': 'fa fa-file-archive-o text-muted',
            'application/x-rar-compressed': 'fa fa-file-archive-o text-muted',
            'application/x-7z-compressed': 'fa fa-file-archive-o text-muted',
            'application/x-tar': 'fa fa-file-archive-o text-muted',
            'application/gzip': 'fa fa-file-archive-o text-muted',

            'audio/mpeg': 'fa fa-file-audio-o text-primary',
            'audio/wav': 'fa fa-file-audio-o text-primary',

            'video/mp4': 'fa fa-file-video-o text-danger',
            'video/x-msvideo': 'fa fa-file-video-o text-danger',
            'video/quicktime': 'fa fa-file-video-o text-danger',

            'application/javascript': 'fa fa-file-code-o text-warning',
            'application/json': 'fa fa-file-code-o text-warning',
            'application/x-httpd-php': 'fa fa-file-code-o text-primary',
            'text/x-python': 'fa fa-file-code-o text-primary',
            'text/x-java-source': 'fa fa-file-code-o text-primary',
            'application/xml': 'fa fa-file-code-o text-success',

            'application/octet-stream': 'fa fa-file-o text-muted',
            'application/x-msdownload': 'fa fa-cog text-muted',
        };

        if (iconMap[mimeType]) return iconMap[mimeType];

        if (iconMap[type]) return iconMap[type];

        if (subtype && subtype.startsWith('vnd.ms-') || subtype.startsWith('vnd.openxmlformats')) return 'fa fa-file-o text-primary';

        return 'fa fa-file-o text-muted';
    }

    async handleSearch(searchTerm) {
        this.currentSearchTerm = searchTerm.toLowerCase();

        try {
            const response = await fetch(`/messenger/search-document?search=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Search request failed');

            const documents = await response.json();

            this.filteredDocuments = documents;
            this.renderDocuments(this.filteredDocuments, true);

            if (this.filteredDocuments.length > 0) {
                this.showDocList();
            } else {
                this.showEmptyState();
            }
        } catch (err) {
            this.showEmptyState();
        }
    }

    loadMore() {
        this.currentPage++;
        this.loadDocuments(this.currentPage, false);
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadDocuments(1, true);
    }

    updatePagination(pagination) {
        this.hasMore = pagination.hasMore;
        this.currentPage = pagination.currentPage;

        if (this.hasMore && pagination.totalCount > 0) {
            this.elements.loadMoreContainer.style.display = 'block';
        } else {
            this.elements.loadMoreContainer.style.display = 'none';
        }
    }

    showLoading(isInitial) {
        if (isInitial) {
            this.elements.loadingIndicator.style.display = 'block';
            this.elements.docList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.doc-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.doc-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.doc-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.doc-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showDocList() {
        this.elements.docList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.docList.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.docList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
        }
    }

    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadDocuments(1, true);
    }

    addNewDocument(doc) {
        const docItem = this.createDocumentItem(doc);
        this.elements.docList.insertBefore(docItem, this.elements.docList.firstChild);

        if (this.elements.emptyState.style.display !== 'none') {
            this.showDocList();
        }
    }
}