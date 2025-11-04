'use strict';
class ContactLoader {
    constructor() {
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.currentUserId = "<%= currentUserId %>";

        this.elements = {
            contactList: document.getElementById('friends-list'),
            loadingIndicator: document.getElementById('contact-loading'),
            loadMoreContainer: document.getElementById('contact-load-more-container'),
            loadMoreBtn: document.getElementById('contact-load-more-btn'),
            emptyState: document.getElementById('contact-empty-state'),
            errorState: document.getElementById('contact-error-state'),
            retryBtn: document.getElementById('contact-retry-btn')
        };

        this.init();
    }

    init() {
        this.elements.loadMoreBtn.addEventListener('click', () => this.loadMore());
        this.elements.retryBtn.addEventListener('click', () => this.retry());

        this.loadContacts(1, true);
        this.showLoading(true);
    }

    async loadContacts(page = 1, isInitial = false) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            const response = await fetch(`/messenger/contacts?page=${page}&limit=20`);
            const data = await response.json();

            if (data.success) {
                this.renderContacts(data.contacts, isInitial);
                this.updatePagination(data.pagination);
                if (data.contacts.length) {
                    this.showContactList();
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

    renderContacts(contacts, isInitial = false) {
        if (isInitial) {
            this.elements.contactList.innerHTML = '';
        }

        if (contacts.length === 0 && isInitial) {
            this.showEmptyState();
            return;
        }

        const groupedContacts = this.groupContactsByLetter(contacts);

        Object.keys(groupedContacts).sort().forEach(letter => {
            if (!document.getElementById(`contact-letter-${letter}`)) {
                const letterHeading = this.createLetterHeading(letter);
                this.elements.contactList.appendChild(letterHeading);
            }

            groupedContacts[letter].forEach(contact => {
                const contactItem = this.createContactItem(contact);
                this.insertContactInOrder(contactItem, letter);
            });
        });
    }

    groupContactsByLetter(contacts) {
        const grouped = {};
        contacts.forEach(contact => {
            const firstLetter = contact.name.charAt(0).toUpperCase();
            if (!grouped[firstLetter]) {
                grouped[firstLetter] = [];
            }
            grouped[firstLetter].push(contact);
        });
        return grouped;
    }

    createLetterHeading(letter) {
        const li = document.createElement('li');
        li.className = 'contact-letter-heading';
        li.id = `contact-letter-${letter}`;
        li.textContent = letter;
        return li;
    }

    insertContactInOrder(contactItem, letter) {
        const letterHeading = document.getElementById(`contact-letter-${letter}`);
        if (!letterHeading) {
            this.elements.contactList.appendChild(contactItem);
            return;
        }

        let nextSibling = letterHeading.nextSibling;
        while (nextSibling && !nextSibling.classList?.contains('contact-letter-heading')) {
            nextSibling = nextSibling.nextSibling;
        }

        if (nextSibling) {
            this.elements.contactList.insertBefore(contactItem, nextSibling);
        } else {
            this.elements.contactList.appendChild(contactItem);
        }
    }

    createContactItem(contact) {
        const li = document.createElement('li');
        li.className = 'chat-item contacts-chat contact-chat-item';
        li.setAttribute('data-user-id', contact.id);
        li.setAttribute('data-name', contact.name.toLowerCase());
        li.setAttribute('data-email', contact.email?.toLowerCase() || '');

        li.onclick = () => {
            loadChat(contact.id, li);
        };

        li.innerHTML = `
                <div class="chat-box">
                    <div class="profile bg-size">
                        <div class="profile ${contact.is_online ? 'online' : 'offline'}">
                            ${this.renderAvatar(contact.avatar, contact.name)}
                        </div>
                    </div>
                    <div class="details">
                        <h5>
                            ${contact.name}
                        </h5>
                        <h6 class="status">${contact.bio || "Hey! I'm using Chitchat."}</h6>
                        <h6 class="last-message d-none"></h6>
                        <div class="date-status d-none">
                            <h6 class="timestamp"></h6>
                            <div class="badge badge-primary sm"></div>
                        </div>
                    </div>
                </div>
            `;

        return li;
    }

    renderAvatar(avatar, name) {
        if (avatar) {
            return `<img src="${avatar}" alt="${name}" class="img-fluid">`;
        } else {
            const initial = name.charAt(0).toUpperCase();
            return `<div class="avatar-circle"><span class="initial">${initial}</span></div>`;
        }
    }

    loadMore() {
        this.currentPage++;
        this.loadContacts(this.currentPage, false);
    }

    retry() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadContacts(1, true);
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
            this.elements.loadingIndicator.style.display = 'flex';
            this.elements.contactList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
            this.elements.errorState.style.display = 'none';
        } else {
            this.elements.loadMoreBtn.querySelector('.contact-load-more-text').textContent = 'Loading...';
            this.elements.loadMoreBtn.querySelector('.contact-load-more-spinner').classList.remove('d-none');
            this.elements.loadMoreBtn.disabled = true;
        }
    }

    hideLoading() {
        this.elements.loadingIndicator.style.display = 'none';
        this.elements.loadMoreBtn.querySelector('.contact-load-more-text').textContent = 'Load More';
        this.elements.loadMoreBtn.querySelector('.contact-load-more-spinner').classList.add('d-none');
        this.elements.loadMoreBtn.disabled = false;
    }

    showContactList() {
        this.elements.contactList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showEmptyState() {
        this.elements.emptyState.style.display = 'flex';
        this.elements.contactList.style.display = 'none';
        this.elements.errorState.style.display = 'none';
    }

    showError(isInitial) {
        if (isInitial) {
            this.elements.errorState.style.display = 'block';
            this.elements.contactList.style.display = 'none';
            this.elements.emptyState.style.display = 'none';
        }
    }

    refresh() {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadContacts(1, true);
    }

    addNewContact(contact) {
        const contactItem = this.createContactItem(contact);
        const firstLetter = contact.name.charAt(0).toUpperCase();

        if (!document.getElementById(`contact-letter-${firstLetter}`)) {
            const letterHeading = this.createLetterHeading(firstLetter);
            this.insertLetterHeadingInOrder(letterHeading, firstLetter);
        }

        this.insertContactInOrder(contactItem, firstLetter);

        if (this.elements.emptyState.style.display !== 'none') {
            this.showContactList();
        }
    }

    insertLetterHeadingInOrder(letterHeading, letter) {
        const allLetterHeadings = this.elements.contactList.querySelectorAll('.contact-letter-heading');
        let inserted = false;

        allLetterHeadings.forEach(heading => {
            if (!inserted && heading.textContent > letter) {
                this.elements.contactList.insertBefore(letterHeading, heading);
                inserted = true;
            }
        });

        if (!inserted) this.elements.contactList.appendChild(letterHeading);
    }
}