'use strict';
document.addEventListener('DOMContentLoaded', async function () {
    let systemSetting;

    const res = await fetch('/user/fetch/system-setting');
    systemSetting = await res.json();

    document.querySelectorAll('.chat-cont-toggle').forEach(toggle => {
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();

            document.querySelectorAll('.chat-cont-setting').forEach(setting => {
                setting.classList.toggle('open');
            });
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        const isClickInsideDropdown = e.target.closest('.chat-cont-setting');
        const isClickOnToggle = e.target.closest('.chat-cont-toggle');
        const isClickInModal = e.target.closest('.modal');

        // Don't close dropdown if click is inside a modal
        if (!isClickInsideDropdown && !isClickOnToggle && !isClickInModal) {
            document.querySelectorAll('.chat-cont-setting').forEach(setting => {
                setting.classList.remove('open');
            });
        }
    });

    document.getElementById('openNewChatModal')?.addEventListener('click', function () {
        const modalEl = document.getElementById('msgchatModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    });

    const chatItems = document.querySelectorAll('li[data-to]');

    chatItems.forEach(function (item) {
        item.addEventListener('click', function () {
            chatItems.forEach(i => i.classList.remove('active'));

            this.classList.add('active');
        });
    });

    /*=====================
      Tooltip js
    ==========================*/
    if (typeof tippy !== 'undefined') {
        tippy('.sidebar-main .icon-btn', {
            theme: 'tooltiprad',
            placement: 'right-end',
            arrow: false
        });
        tippy('.user-popup', {
            content: "Status",
            theme: 'gradienttooltip',
            placement: 'right-end',
            arrow: false
        });
        tippy('.calls  > li > .icon-btn', {
            placement: 'bottom-end',
            arrow: true
        });
        tippy('.clfooter a', {
            placement: 'top-end',
            arrow: true
        });
        tippy('.audiocall2 a', {
            placement: 'top-end',
            arrow: true
        });
    }

    // Setup auto-detection
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    if (node.hasAttribute && node.hasAttribute('data-feather')) {
                        feather.replace({}, node.parentNode);
                    }
                    if (node.querySelectorAll) {
                        const featherIcons = node.querySelectorAll('[data-feather]');
                        if (featherIcons.length > 0) {
                            feather.replace({}, node);
                        }
                    }
                }
            });
        });
    });

    // Watch the whole body for DOM changes
    observer.observe(document.body, { childList: true, subtree: true });

    /*=====================
      Background Image js
    ==========================*/
    document.querySelectorAll(".bg-top").forEach(el => {
        el.parentElement.classList.add('b-top');
    });
    document.querySelectorAll(".bg-bottom").forEach(el => {
        el.parentElement.classList.add('b-bottom');
    });
    document.querySelectorAll(".bg-center").forEach(el => {
        el.parentElement.classList.add('b-center');
    });
    document.querySelectorAll(".bg_size_content").forEach(el => {
        el.parentElement.classList.add('b_size_content');
    });
    document.querySelectorAll(".bg-img").forEach(el => {
        el.parentElement.classList.add('bg-size');
        const src = el.getAttribute('src');
        const parent = el.parentElement;
        parent.style.cssText = `
            background-image: url(${src});
            background-size: cover;
            background-position: center;
            display: block;
        `;
        el.style.display = 'none';
    });

    /*=====================
      Chitchat Loder js
    ==========================*/
    const chitchatLoader = document.querySelector('.chitchat-loader');
    if (chitchatLoader) {
        setTimeout(() => {
            chitchatLoader.style.transition = 'all 0.5s ease';
            chitchatLoader.style.height = '0';
            chitchatLoader.style.overflow = 'hidden';
        }, 800);
        setTimeout(() => {
            chitchatLoader.remove();
        }, 1000);
    }

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('favourite-btn')) {
            document.querySelector('.fevorite-tab').classList.add('active');
        }
    });


    /*=====================
      Search js
    ==========================*/
    document.querySelectorAll('.search').forEach(el => {
        el.addEventListener('click', function (e) {
            this.nextElementSibling.classList.toggle("open");
        });
    });
    document.querySelectorAll('.close-search').forEach(el => {
        el.addEventListener('click', function (e) {
            this.parentElement.parentElement.classList.remove("open");
        });
    });
    document.querySelectorAll('.search-right').forEach(el => {
        el.addEventListener('click', function (e) {
            let formInline = this.closest('.chitchat-container').querySelector('.form-inline');
            if (formInline) {
                formInline.classList.toggle("open");
            }
        });
    });

    /*=====================
      Chat Search js
    ==========================*/

    // Convert click handlers for .contact-log-main li and .call-log-main li
    document.querySelectorAll(".contact-log-main li, .call-log-main li").forEach(function (element) {
        element.addEventListener('click', function () {
            this.parentNode.querySelectorAll("li").forEach(function (li) {
                li.classList.remove("active");
            });
            this.classList.add("active");
        });
    });

    // Convert click handler for #myTab1 li a
    document.querySelectorAll("#myTab1 li a").forEach(function (element) {
        element.addEventListener('click', function () {
            var active_class = this.getAttribute("data-to");
            document.querySelectorAll('.messages.custom-scroll').forEach(function (el) {
                el.classList.remove("active");
            });
            document.getElementById(active_class).classList.add("active");
        });
    });

    // Convert click handler for .chat-tabs .nav-tabs li[data-to]
    document.querySelectorAll(".chat-tabs .nav-tabs li[data-to]").forEach(function (element) {
        element.addEventListener('click', function () {
            document.querySelectorAll('.chitchat-main .tabto').forEach(function (el) {
                el.classList.remove("active");
            });
            var active_class = this.getAttribute("data-to");
            document.querySelectorAll('.' + active_class).forEach(function (el) {
                el.classList.add("active");
            });
        });
    });

    // Convert click handler for .sidebar-top a
    document.querySelectorAll(".sidebar-top a").forEach(function (element) {
        element.addEventListener('click', function () {
            document.querySelectorAll(".sidebar-top a").forEach(function (a) {
                a.classList.remove("active");
            });
            this.classList.add("active");
            document.querySelectorAll('.dynemic-sidebar').forEach(function (el) {
                el.classList.remove("active");
            });
            var active_class = this.getAttribute("href");
            document.getElementById(active_class).classList.add("active");
        });
    });


    /*=====================
      Mute js
    ==========================*/

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('submit-mute')) {
            const selected = document.querySelector('input[name="muteDuration"]:checked');
            if (!selected) {
                alert('Please select a mute duration.');
                return;
            }

            const duration = selected.value;
            const targetId = document.querySelector(".contact-details")?.getAttribute('data-receiver-id');
            const targetType = 'user';
            const button = document.querySelector('.mute-btn');

            fetch('/chat/mute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target_id: targetId,
                    target_type: targetType,
                    duration: duration
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('muteNotificationModal'));
                        modal.hide();
                        const icon = button?.querySelector('i');
                        icon?.classList.add('off');
                        icon?.classList.add('submit-unmute');

                        button?.removeAttribute('data-bs-toggle');
                        button?.removeAttribute('data-bs-target');

                        button?.classList.add('submit-unmute');
                        document.querySelector(".contact-details")

                        const muteIcon = document.querySelector(`[data-user-id="${targetId}"] .mute-icon`);
                        muteIcon.classList.remove('d-none');

                        handleMessageUi(targetId);
                    }
                })
                .catch(err => {
                    return;
                });
        }

        if (e.target.classList.contains('submit-unmute')) {
            const targetId = document.querySelector(".contact-details")?.getAttribute('data-receiver-id');
            const targetType = 'user';
            const button = document.querySelector('.mute-btn');

            fetch('/chat/unmute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target_id: targetId,
                    target_type: targetType
                })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        const icon = button?.querySelector('i');
                        icon?.classList.remove('off');
                        icon?.classList.remove('submit-unmute');

                        button?.setAttribute('data-bs-toggle', 'modal');
                        button?.setAttribute('data-bs-target', '#muteNotificationModal');

                        button?.classList.remove('submit-unmute');

                        const muteIcon = document.querySelector(`[data-user-id="${targetId}"] .mute-icon`);
                        muteIcon.classList.add('d-none');

                        handleMessageUi(targetId);
                    }
                })
                .catch(err => {
                    return;
                });
        }
    });

    /*=====================
      Button Effect js
    ==========================*/
    document.querySelectorAll('.button-effect').forEach(el => {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const btnWidth = this.offsetWidth;
            const x = e.offsetX;
            const y = e.offsetY;

            const wave = document.createElement('span');
            wave.className = 'effect-wave';
            wave.style.cssText = `
                position: absolute;
                top: ${y}px;
                left: ${x}px;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255,255,255,0.4);
                transform: translate(-50%, -50%);
                pointer-events: none;
            `;

            this.prepend(wave);

            const animateWave = () => {
                wave.style.width = `${btnWidth * 2}px`;
                wave.style.height = `${btnWidth * 2}px`;
                wave.style.opacity = '0';

                setTimeout(() => {
                    wave.remove();
                }, 500);
            };

            requestAnimationFrame(animateWave);
        });
    });

    /*=====================
      Collapse Title js
    ==========================*/
    document.querySelectorAll('.block-title').forEach(el => {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const speed = 300;
            const thisItem = this.parentElement;
            const nextLevel = this.nextElementSibling;

            if (thisItem.classList.contains('open')) {
                thisItem.classList.remove('open');
                nextLevel.style.transition = `height ${speed}ms ease`;
                nextLevel.style.height = '0';
                nextLevel.style.overflow = 'hidden';
                setTimeout(() => {
                    nextLevel.style.display = 'none';
                }, speed);
            } else {
                thisItem.classList.add('open');
                nextLevel.style.display = 'block';
                nextLevel.style.height = 'auto';
                const height = nextLevel.offsetHeight;
                nextLevel.style.height = '0';
                nextLevel.style.overflow = 'hidden';

                setTimeout(() => {
                    nextLevel.style.height = `${height}px`;
                    setTimeout(() => {
                        nextLevel.style.height = 'auto';
                    }, speed);
                }, 10);
            }
        });
    });

    document.querySelectorAll('.tap-top').forEach(el => {
        el.addEventListener('click', function () {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            return false;
        });
    });

    /*=====================
       Customizer
    ==========================*/

    const customizerHTML = `
        <div class="sidebar-pannle-main">
            <ul>
                <li class="rtl-setting icon-btn btn-primary">RTL</li>
                <li class="cog-click icon-btn btn-success"><i class="fa fa-cog"></i></li>
            </ul>
        </div>
        <section class="setting-sidebar">
            <div class="theme-title">
                <div class="d-flex">
                    <div>
                        <h2>Customizer</h2>
                        <h4>Real Time Customize</h4>
                    </div>
                    <div class="flex-grow-1">
                        <a class="icon-btn btn-outline-light button-effect pull-right cog-close" href="#">
                            <i class="fa fa-close"></i>
                        </a>
                    </div>
                </div>
            </div>
            <div class="color-picker">
                <h5>Choose color</h5>
                <ul class="colors">
                    <li class="color active" data-color="lc-light-blue" data-attr="28, 157, 234"></li>
                    <li class="color1" data-color="lc-dark-blue" data-attr="58, 98, 184"></li>
                    <li class="color2" data-color="lc-dark-green" data-attr="6, 76, 60"></li>
                    <li class="color3" data-color="lc-purple" data-attr="155, 74, 255"></li>
                    <li class="color4" data-color="lc-light-green" data-attr="0, 211, 203"></li>
                    <li class="color5" data-color="lc-pink" data-attr="255, 91, 146"></li>
                    <li class="color6" data-color="lc-orange" data-attr="255, 128, 60"></li>
                </ul>
            </div>
            <div class="theme-layout">
                <h5>Layout</h5>
                <ul>
                    <li data-attr="default">
                        <div class="sidebar"></div>
                        <div class="sidebar-content"></div>
                    </li>
                    <li data-attr="dark-sidebar">
                        <div class="sidebar"></div>
                        <div class="sidebar-content"></div>
                    </li>
                    <li data-attr="dark">
                        <div class="sidebar"></div>
                        <div class="sidebar-content"></div>
                    </li>
                    <li data-attr="colorfull">
                        <div class="sidebar"></div>
                        <div class="sidebar-content"></div>
                    </li>
                </ul>
            </div>
            <div class="chat-wallpaper">
                <h5>Chat wallpaper</h5>
                <ul class="wallpaper">
                    <li class="bg-color bg-default active"></li>
                    <li class="bg-color grediant-1" data-wallpaper="linear-gradient(359.3deg, rgba(var(--primary-color), 0.1) 1%, rgba(187, 187, 187, 0) 70.9%)"></li>
                    <li class="bg-color grediant-2" data-wallpaper="radial-gradient(328px at 2.9% 15%, rgb(191, 224, 251) 0%, rgb(232, 233, 251) 25.8%, rgb(252, 239, 250) 50.8%, rgb(234, 251, 251) 77.6%, rgb(240, 251, 244) 100.7%)"></li>
                    <li class="bg-color grediant-3" data-wallpaper="linear-gradient(109.6deg, rgb(223, 234, 247) 11.2%, rgb(244, 248, 252) 91.1%)"></li>
                    <li class="bg-color grediant-4" data-wallpaper="linear-gradient(-109.6deg, rgb(204, 228, 247) 11.2%, rgb(237, 246, 250) 100.2%)"></li>
                    <li class="bg-color grediant-5" data-wallpaper="radial-gradient(circle at 10% 20%, rgb(239, 246, 249) 0%, rgb(206, 239, 253) 90%)"></li>
                    <li class="bg-color grediant-6" data-wallpaper="radial-gradient(circle at 10% 20%, rgb(226, 240, 254) 0%, rgb(255, 247, 228) 90%)"></li>
                </ul>
            </div>
            <div class="sidebar-setting">
                <h5>Sidebar</h5>
                <ul>
                    <li class="three-column">
                        <div class="sm-sidebar"></div>
                        <div class="sidebar"></div>
                        <div class="sidebar-content"></div>
                    </li>
                    <li class="two-column">
                        <div class="sidebar"></div>
                        <div class="sidebar-content"></div>
                    </li>
                </ul>
            </div>
        </section>
    `;

    if (systemSetting.allow_customizer === 'true') {
        document.body.insertAdjacentHTML('beforeend', customizerHTML);

        const colorElements = document.querySelectorAll('.colors li');
        if (!colorElements.length) return;

        colorElements.forEach(el => {
            el.addEventListener('click', async function () {
                colorElements.forEach(item => {
                    item.classList.remove('active');
                });

                const color = this.getAttribute("data-attr");
                const colorClass = this.getAttribute("data-color");

                document.documentElement.style.setProperty(
                    "--primary-color",
                    color
                );
                this.classList.add('active');

                document.body.classList.forEach(cls => {
                    if (cls.startsWith('lc')) {
                        document.body.classList.remove(cls);
                    }
                });

                document.body.classList.add(colorClass);

                try {
                    const result = await fetch('/user/setting/theme-color', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            theme_color: color,
                            colorClass: colorClass
                        })
                    });
                } catch (err) {
                    return;
                }
            });
        });
    }

    const sidebar = document.querySelector(".setting-sidebar");
    const cogOpen = document.querySelector(".cog-click");
    const cogClose = document.querySelector(".cog-close");
    const layoutItems = document.querySelectorAll(".theme-layout li");

    cogOpen.addEventListener('click', function () {
        sidebar.style.right = "0px";
    });

    cogClose.addEventListener('click', function () {
        sidebar.style.right = "-400px";
    });

    layoutItems.forEach(el => {
        el.addEventListener('click', function () {
            document.querySelectorAll(".theme-layout li").forEach(item => {
                item.classList.remove('active');
            });
            this.classList.add("active");
            const themeLayout = this.getAttribute("data-attr");
            document.body.className = themeLayout;
        });
    });

    const bodyClass = [...document.body.classList].find(cls =>
        ['dark-sidebar', 'dark', 'colorfull'].includes(cls)
    ) || '';

    layoutItems.forEach(item => {
        const attr = item.getAttribute('data-attr');

        if (attr === bodyClass) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    /*=====================
      Pin box
    ==========================*/
    document.querySelectorAll('.ti-pin2').forEach(el => {
        el.addEventListener('click', function () {
            this.closest('.chat-box').classList.toggle('pined');
        });
    });

    /*=====================
      set wallpaper onclick
    ==========================*/
    const chatBackgroundTarget = document.getElementById('chatting');

    document.querySelectorAll('.wallpaper li.bg-color').forEach(el => {
        el.addEventListener('click', function () {
            const color = window.getComputedStyle(this).backgroundImage;

            document.querySelectorAll('.wallpaper li').forEach(item => {
                item.classList.remove('active');
            });

            this.classList.add("active");

            chatBackgroundTarget.style.cssText = `
            background-image: ${color};
            background-blend-mode: unset;
        `;
        });
    });

    // Handle background image selection
    document.querySelectorAll('.wallpaper li.bg-size').forEach(el => {
        el.addEventListener('click', function () {
            const imgSrc = this.querySelector(".bg-img").getAttribute('src');
            if (!imgSrc) return;

            document.querySelectorAll('.wallpaper li').forEach(item => {
                item.classList.remove('active');
            });

            this.classList.add("active");

            chatBackgroundTarget.style.backgroundImage = `url(${imgSrc})`;
            chatBackgroundTarget.style.backgroundColor = 'transparent';
            chatBackgroundTarget.style.backgroundSize = 'cover';
            chatBackgroundTarget.style.backgroundPosition = 'center';
        });
    });

    /*=====================
      profile open close
    ==========================*/
    document.querySelectorAll('.menu-trigger, .close-profile').forEach(el => {
        el.addEventListener('click', function (e) {
            document.body.classList.toggle('menu-active');
            document.querySelector('.chitchat-main').classList.toggle("small-sidebar");

            if (window.innerWidth <= 1440) {
                document.querySelector('.chitchat-container').classList.toggle('sidebar-overlap');
                document.querySelector('.chitchat-main').classList.add("small-sidebar");
            }

            if (document.body.classList.contains('menu-active')) {
                document.body.classList.add('sidebar-active');
                document.body.classList.add('main-page');
                document.querySelector('.app-sidebar').classList.remove('active');
                document.querySelector('.chitchat-main').classList.remove("small-sidebar");
            }
        });
    });

    /*=====================
      Profile Edit js
    ==========================*/

    document.addEventListener('click', function (e) {
        const editButton = e.target.closest('#edit-profile');

        if (editButton) {
            e.preventDefault();

            const profileContainer = document.getElementById("user-avatar");
            const nameInput = document.getElementById("new-name");
            const bioInput = document.getElementById("new-bio");
            let isEditMode = profileContainer.classList.contains("open");

            if (!isEditMode) {
                profileContainer.classList.add("open");
                editButton.innerHTML = '<i data-feather="save"></i>';
                feather.replace();
            } else {
                const newName = nameInput.value.trim();
                const newBio = bioInput.value.trim();

                if (newName && newName !== nameInput.defaultValue || newBio && newBio !== newBio.defaultValue) {
                    fetch("/user/update-profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: newName, bio: newBio }),
                        credentials: "include",
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                const nameElement = document.getElementById("profile-name");
                                if (nameElement) nameElement.textContent = newName;

                                const bioElement = document.getElementById("user-bio");
                                if (bioElement) bioElement.textContent = newBio;

                                document.querySelectorAll(".replies .contact-name").forEach(contact => {
                                    const firstH5 = contact.querySelector("h5:first-child");
                                    if (firstH5) firstH5.textContent = newName;
                                });
                            }
                        })
                        .catch(error => {
                            nameInput.value = nameInput.defaultValue;
                            bioInput.value = bioInput.defaultValue;
                        });
                }
                profileContainer.classList.remove("open");
                editButton.innerHTML = '<i data-feather="edit"></i>';
                feather.replace();
            }
        }

        if (e.target.closest('#profile-pic')) {
            e.preventDefault();
            document.getElementById("new-pic")?.click();
        }
    });

    // Avatar file input change
    document.getElementById("new-pic")?.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const formData = new FormData();
            formData.append("file", file);

            fetch("/user/update-profile", {
                method: "POST",
                credentials: "include",
                body: formData,
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.avatar) {
                        const timestamp = Date.now();
                        const newAvatarUrl = `${data.avatar}?t=${timestamp}`;
                        const currentAvatar = document.getElementById("user-avatar");
                        const avatarDiv = document.getElementById("profile-pic");

                        currentAvatar.src = newAvatarUrl;
                        avatarDiv.style.backgroundImage = `url('${newAvatarUrl}')`;

                        document.querySelectorAll(".replies .bg-img").forEach(img => {
                            img.src = newAvatarUrl;
                        });
                    }
                })
                .catch(error => {
                    return;
                });
        }
    });

    /*=====================
          Avatar Toggle js
    ==========================*/

    document.addEventListener('click', async function (e) {
        const headerProfile = e.target.closest('#header-profile');
        const slideMenu = document.querySelector('#slide-menu');

        const updateContactTop = (userData) => {
            const contactTop = slideMenu.querySelector('.contact-top');
            if (!contactTop) return;

            contactTop.innerHTML = '';
            contactTop.classList.remove('avatar-circle');

            if (userData.avatar) {
                const img = document.createElement('img');
                img.src = `${userData.avatar}?t=${Date.now()}`;
                img.alt = userData.name || 'User avatar';
                img.className = 'bg-img';
                contactTop.appendChild(img);

                contactTop.style.backgroundImage = `url('${userData.avatar}')`;
                contactTop.dataset.avatarUrl = `${userData.avatar}?t=${Date.now()}`;
            } else {
                const initial = userData.name?.charAt(0).toUpperCase() || '?';
                contactTop.classList.add('avatar-circle');
                contactTop.innerHTML = `<span class="initial-latter">${initial}</span>`;
            }
        };

        const updateContactInfo = (userData) => {
            const [phoneEl, emailEl, usernameEl] = slideMenu.querySelectorAll('.status.other li a');
            if (!userData.contact_info) return;

            if (phoneEl) {
                phoneEl.innerHTML = userData.contact_info.phone
                    ? `<i data-feather="smartphone"></i>${userData.country_code} ${userData.contact_info.phone}`
                    : '';
            }

            if (emailEl && userData.contact_info.email) {
                emailEl.href = `mailto:${userData.contact_info.email}`;
                emailEl.innerHTML = `<i data-feather="mail"></i>${userData.contact_info.email}`;
            }

            if (usernameEl && userData.username) {
                usernameEl.innerHTML = `<i data-feather="user"></i>${userData.username}`;
            }
        };

        const updateDocuments = (userData) => {
            const docsContainer = slideMenu.querySelector('.document-list');
            const docCountBadge = document.getElementById('document-count');
            if (!docsContainer) return;

            docsContainer.innerHTML = '';
            const docs = userData.shared_documents || [];

            if (docs.length === 0) {
                docsContainer.innerHTML = '<div class="empty-msg">No shared documents</div>';
                if (docCountBadge) docCountBadge.textContent = '0';
                return;
            }

            const iconMap = {
                pdf: 'fa fa-file-pdf-o font-danger',
                doc: 'fa fa-file-word-o font-primary',
                docx: 'fa fa-file-word-o font-primary',
                xls: 'fa fa-file-excel-o font-success',
                xlsx: 'fa fa-file-excel-o font-success',
                ppt: 'fa fa-file-powerpoint-o font-warning',
                pptx: 'fa fa-file-powerpoint-o font-warning',
                zip: 'fa fa-file-archive-o font-secondary',
                rar: 'fa fa-file-archive-o font-secondary',
                txt: 'fa fa-file-text-o font-secondary',
                default: 'fa fa-file-text-o font-secondary'
            };
            const previewableTypes = ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx'];

            docs.forEach(doc => {
                const extension = doc.name.split('.').pop().toLowerCase();
                const li = document.createElement('li');
                li.innerHTML = `
                    <i class="${iconMap[extension] || iconMap.default}"></i>
                    <h5 title="${doc.name}">${doc.name.substring(0, 20)}...</h5>
                `;
                if (previewableTypes.includes(extension)) {
                    li.style.cursor = 'pointer';
                    li.addEventListener('click', () => window.open(doc.url, '_blank'));
                }
                docsContainer.appendChild(li);
            });

            if (docCountBadge) docCountBadge.textContent = docs.length;
        };

        const updateMedia = (userData) => {
            const mediaContainer = slideMenu.querySelector('.share-media');
            const mediaCountBadge = document.getElementById('media-count');
            if (!mediaContainer) return;

            mediaContainer.innerHTML = '';
            const images = userData.shared_images || [];

            if (images.length === 0) {
                mediaContainer.innerHTML = '<div class="empty-msg">No shared images</div>';
                if (mediaCountBadge) mediaCountBadge.textContent = '0';
                return;
            }

            if (mediaCountBadge) mediaCountBadge.textContent = images.length;

            // Group by date
            const grouped = images.sort((a, b) => new Date(b.date) - new Date(a.date))
                .reduce((acc, img) => {
                    const date = new Date(img.date).toLocaleDateString();
                    (acc[date] ||= []).push(img);
                    return acc;
                }, {});

            Object.entries(grouped).forEach(([date, imgs]) => {
                const dateCol = document.createElement('div');
                dateCol.className = 'col-12';
                dateCol.innerHTML = `<h6 class="mb-2 mt-2" data-date="${date}">${date}</h6>`;
                mediaContainer.appendChild(dateCol);

                imgs.forEach(img => {
                    const col = document.createElement('div');
                    col.className = 'col-4';
                    col.innerHTML = `
                        <div class="media-small isotopeSelector filter">
                            <div class="overlay">
                                <div class="border-portfolio">
                                    <a href="${img.url}" class="bg-size" target="_blank" style="background-image:url(${img.url});">
                                        <div class="overlay-background"><i class="ti-plus"></i></div>
                                        <img class="img-fluid bg-img" src="${img.url}" alt="shared-image">
                                    </a>
                                </div>
                            </div>
                        </div>
                    `;
                    mediaContainer.appendChild(col);
                });
            });
        };

        const updateStarred = (userData) => {
            const starredContainer = slideMenu.querySelector('.str-msg');
            const starredCounter = document.getElementById('starred-count');
            if (!starredContainer) return;

            starredContainer.innerHTML = '';
            const msgs = userData.starred_messages || [];

            if (msgs.length === 0) {
                starredContainer.innerHTML = '<div class="empty-msg">No starred messages</div>';
                starredCounter.textContent = '0';
                return;
            }

            if (starredCounter) starredCounter.textContent = msgs.length;

            msgs.forEach(msg => {
                const li = document.createElement('li');
                const time = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const initial = msg.sender.name?.charAt(0).toUpperCase() || '?';
                const avatarUrl = `${msg.sender.avatar}?t=${Date.now()}`;

                li.innerHTML = `
                    <div class="d-flex replied" data-msg-id="${msg.id}" data-rplmsg-id="${msg.id}">
                        <div class="profile starred-profile me-4">
                            ${msg.sender.avatar ?
                        `<img class="bg-img" src="${avatarUrl}" alt="${msg.sender.name}" />` :
                        `<span class="initial-latter">${initial}</span>`
                    }
                        </div>
                        <div class="flex-grow-1">
                            <div class="contact-name">
                                <h5>${msg.sender.name}</h5>
                                <h6>${time}</h6>
                                <ul class="msg-box">
                                    <li>
                                        <h5>${msg.content}</h5>
                                        ${msg.reply_to ? `<small class="text-muted">Replying to #${msg.reply_to}</small>` : ''}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `;
                starredContainer.appendChild(li);
            });
        };

        if (headerProfile) {
            e.preventDefault();
            e.stopPropagation();

            const receiverId = document.querySelector('.contact-details')?.dataset.receiverId;
            if (!receiverId) return;

            try {
                const response = await fetch(`/user/${receiverId}/profile`, { credentials: "include" });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const userData = await response.json();

                updateContactTop(userData);
                slideMenu.querySelector('.name h3').textContent = userData.name || 'Unknown User';
                slideMenu.querySelector('.name h6').textContent = userData.bio || "Hey! I'm using Chitchat.";
                updateContactInfo(userData);
                updateDocuments(userData);
                updateMedia(userData);
                updateStarred(userData);

                if (window.feather) feather.replace();
            } catch (err) {
                document.body.classList.remove('menu-active');
            }
            document.body.classList.toggle('menu-active');
            return;
        }

        if (
            document.body.classList.contains('menu-active') &&
            !e.target.closest('#header-profile') &&
            !e.target.closest('#slide-menu') &&
            !document.body.classList.contains('modal-open')
        ) {
            document.body.classList.remove('menu-active');
        }
    });

    /*=====================
      dropdown
    ==========================*/
    document.querySelectorAll('.dropdown').forEach(el => {
        el.addEventListener('click', function () {
            this.setAttribute('tabindex', '1');
            this.focus();
            this.classList.toggle('active');
            const dropdownMenu = this.querySelector('.dropdown-menu');
            if (dropdownMenu.style.display === 'block') {
                dropdownMenu.style.display = 'none';
            } else {
                dropdownMenu.style.display = 'block';
            }
        });

        el.addEventListener('focusout', function () {
            this.classList.remove('active');
            this.querySelector('.dropdown-menu').style.display = 'none';
        });
    });

    document.querySelectorAll('.dropdown .dropdown-menu li').forEach(el => {
        el.addEventListener('click', function () {
            const dropdown = this.closest('.dropdown');
            dropdown.querySelector('span').textContent = this.textContent;
            dropdown.querySelector('input').setAttribute('value', this.getAttribute('id'));
        });
    });

    // Toggle sticker
    document.querySelectorAll('.toggle-sticker').forEach(el => {
        el.addEventListener('click', function (e) {
            e.stopPropagation();

            this.classList.toggle("active");
            document.querySelector('.sticker-contain')?.classList.toggle("open");
            document.querySelector('.emojis-contain')?.classList.remove("open");

            document.querySelectorAll(".toggle-emoji").forEach(item => {
                item.classList.remove("active");
            });

            const pollContent = document.querySelector('.contact-poll-content');
            if (pollContent) pollContent.style.display = 'none';
        });
    });

    // Toggle emoji
    document.querySelectorAll('.toggle-emoji').forEach(el => {
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            this.classList.toggle("active");
            document.querySelector('.emojis-contain').classList.toggle("open");
            document.querySelector(".sticker-contain").classList.remove("open");
            document.querySelector(".toggle-sticker").classList.remove("active");
            document.querySelector('.contact-poll-content').style.display = 'none';
        });
    });

    document.querySelectorAll(".emojis-sub-contain ul li").forEach(el => {
        el.addEventListener('click', function () {
            const number = this.innerHTML;
            const messageInput = document.getElementById("message-input");
            messageInput.focus();
            messageInput.value = messageInput.value + number;
        });
    });

    // Toggle poll
    document.querySelectorAll('.contact-poll').forEach(el => {
        el.addEventListener('click', function (e) {
            e.stopPropagation();

            const pollContent = document.querySelector('.contact-poll-content');
            if (pollContent) {
                const isVisible = pollContent.style.display !== 'none' && pollContent.style.display !== '';
                pollContent.style.display = isVisible ? 'none' : 'block';
            }

            document.querySelector('.emojis-contain')?.classList.remove('open');
            document.querySelectorAll('.toggle-emoji, .toggle-sticker').forEach(toggle => {
                toggle.classList.remove('active');
            });
        });
    });

    // Outside click
    document.addEventListener('click', function (e) {
        const outsideSpace = document.querySelector(".outside");
        if (outsideSpace && !outsideSpace.contains(e.target)) {
            document.querySelector(".sticker-contain").classList.remove("open");
            document.querySelector(".emojis-contain").classList.remove("open");
            document.querySelectorAll(".toggle-emoji, .toggle-sticker").forEach(item => {
                item.classList.remove("active");
            });
            document.querySelector('.contact-poll-content').style.display = 'none';
        }
    });

    document.querySelectorAll(".mode").forEach(el => {
        el.addEventListener("click", function () {
            const icon = this.querySelector('i');
            icon.classList.toggle("fa-moon-o");
            icon.classList.toggle("fa-lightbulb-o");
            document.body.classList.toggle("dark");
        });
    });

    document.querySelectorAll(".mainnav").forEach(el => {
        el.addEventListener("click", function () {
            document.querySelectorAll('.theme-title .icon-btn').forEach(item => {
                item.classList.toggle("btn-outline-light");
                item.classList.toggle("btn-outline-primary");
            });
            document.querySelector('.main-nav').classList.toggle("on");
        });
    });

    document.querySelectorAll(".close-panel").forEach(el => {
        el.addEventListener("click", function () {
            document.querySelectorAll('.dynemic-sidebar, .button-effect.active, .sidebar-top > li > a').forEach(item => {
                item.classList.remove("active");
            });

            document.querySelector('.recent-default').classList.add("active");
            const chatTab = document.querySelector('#chat-tab');
            const chatTabPane = document.querySelector('#chat');

            if (chatTab && chatTabPane) {
                document.querySelectorAll('.nav-link, .tab-pane').forEach(item => {
                    item.classList.remove('active', 'show');
                });

                chatTab.classList.add('active');
                chatTabPane.classList.add('active', 'show');

                const tab = new bootstrap.Tab(chatTab);
                tab.show();
            }
        });
    });

    // mobile menu click class
    document.addEventListener("click", (e) => {
        if (e.target.closest("#mobile-menu")) {
            e.preventDefault();
            document.body.classList.add("chat-active");
        }

        if (e.target.closest("#mb-sidebar")) {
            e.preventDefault();
            document.body.classList.remove("chat-active");
        }

        if (e.target.closest("#icon-back")) {
            e.preventDefault();
            document.getElementById('left-sidebar').classList.toggle("on");
        }

        const mobileChatEl = e.target.closest(".mobile-chat");

        if (mobileChatEl) {
            e.preventDefault();
            if (!document.body.classList.contains('chat-active')) {
                document.body.classList.add('chat-active');
            }
        }

        if (e.target.closest(".chat-deactive")) {
            e.preventDefault();

            if (document.body.classList.contains('chat-active')) {
                document.body.classList.remove('chat-active');
            }
        }
    });

    // Display spinner in form submission
    const forms = document.querySelectorAll("form");
    forms.forEach((form) => {
        form.addEventListener('click', function (e) {
            const submitButton = form.querySelector('button[type="submit"]');

            if (e.target.closest('button[type="submit"]')) {
                submitButton.disabled = true;

                if (!submitButton.dataset.originalText) {
                    submitButton.dataset.originalText = submitButton.textContent.trim();
                }

                submitButton.textContent = submitButton.dataset.originalText;

                let spinner = submitButton.querySelector(".btn-spinner");
                if (!spinner) {
                    spinner = document.createElement("span");
                    spinner.className = "btn-spinner spinner-border spinner-border-sm ms-2";
                    spinner.setAttribute("role", "status");
                    spinner.setAttribute("aria-hidden", "true");

                    submitButton.appendChild(spinner);
                }

                this.submit();
            }
        });
    });
});

// Toggle Setting
document.querySelectorAll('.setting-block .media-right').forEach(item => {
    item.addEventListener('click', (e) => {
        const block = e.target.closest('.setting-block').querySelector('.block');
        block.classList.toggle('open');
    });
});

// Toggle setting According
document.querySelectorAll('.theme-according .card-header').forEach(header => {
    header.addEventListener('click', (e) => {
        const collapse = document.querySelector(header.getAttribute('data-bs-target'));

        const isOpen = collapse.classList.contains('show');
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const dropdown = document.querySelector('.country-code-dropdown');
    const toggle = document.getElementById('countryCodeToggle');
    const menu = document.getElementById('countryCodeMenu');
    const searchInput = document.getElementById('countrySearch');
    const optionsContainer = document.getElementById('optionsContainer');
    const selectedCountryCode = document.getElementById('selectedCountryCode');
    const countryCodeInput = document.getElementById('countryCodeInput');
    const phoneInput = document.getElementById('phone');
    if (!optionsContainer) {
        return
    }
    const options = optionsContainer.querySelectorAll('.option:not(.no-data)');

    let isOpen = false;
    let filteredOptions = Array.from(options);
    let focusedIndex = -1;

    const initialCode = '<%= old?.countryCode || "+1" %>';
    const initialOption = Array.from(options).find(option => option.dataset.code === initialCode);
    if (initialOption) {
        updateSelectedOption(initialOption);
    }

    toggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!dropdown.contains(e.target)) {
            closeDropdown();
        }
    });

    // Search functionality
    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        filterOptions(searchTerm);
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', handleKeyNavigation);
    toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            openDropdown();
            searchInput.focus();
        }
    });

    // Option selection
    options.forEach(option => {
        option.addEventListener('click', function () {
            selectOption(this);
        });
    });

    function toggleDropdown() {
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    function openDropdown() {
        menu.classList.add('show');
        toggle.classList.add('active');
        searchInput.value = '';
        searchInput.focus();
        filterOptions('');
        isOpen = true;
        focusedIndex = -1;
    }

    function closeDropdown() {
        menu.classList.remove('show');
        toggle.classList.remove('active');
        isOpen = false;
        focusedIndex = -1;
    }

    function filterOptions(searchTerm) {
        filteredOptions = [];
        options.forEach(option => {
            const country = option.dataset.country.toLowerCase();
            const code = option.dataset.code.toLowerCase();

            if (country.includes(searchTerm) || code.includes(searchTerm)) {
                option.style.display = 'flex';
                filteredOptions.push(option);
            } else {
                option.style.display = 'none';
            }
        });

        focusedIndex = -1;
        updateFocus();
    }

    function selectOption(option) {
        updateSelectedOption(option);
        countryCodeInput.value = option.dataset.code;
        closeDropdown();
        phoneInput.focus();
    }

    function updateSelectedOption(option) {
        const flag = selectedCountryCode.querySelector('.flag');
        const code = selectedCountryCode.querySelector('.code');

        flag.textContent = option.dataset.flag;
        code.textContent = option.dataset.code;

        options.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
    }

    function handleKeyNavigation(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                focusedIndex = Math.min(focusedIndex + 1, filteredOptions.length - 1);
                updateFocus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                focusedIndex = Math.max(focusedIndex - 1, -1);
                updateFocus();
                break;
            case 'Enter':
                e.preventDefault();
                if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
                    selectOption(filteredOptions[focusedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeDropdown();
                toggle.focus();
                break;
        }
    }

    function updateFocus() {
        filteredOptions.forEach((option, index) => {
            option.classList.toggle('focused', index === focusedIndex);
        });

        if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            filteredOptions[focusedIndex].scrollIntoView({
                block: 'nearest'
            });
        }
    }

    // Form submission with loading state
    const form = document.getElementById('registerForm');
    const submitButton = document.getElementById('registerButton');
    const spinner = submitButton.querySelector('.btn-spinner');

    form.addEventListener('submit', function () {
        submitButton.disabled = true;
        spinner.classList.remove('d-none');
        submitButton.querySelector('span:not(.btn-spinner)') ?
            submitButton.querySelector('span:not(.btn-spinner)').textContent = 'Creating Account...' :
            submitButton.childNodes[0].textContent = 'Creating Account...';
    });

    // Auto-format phone number
    phoneInput.addEventListener('input', function () {
        let value = this.value.replace(/\D/g, '');

        if (value.length > 15) {
            value = value.substring(0, 15);
        }

        this.value = value;
    });
});

// Message Time Formatter - Client-side timezone handling
class MessageTimeFormatter {
    constructor() {
        this.init();
    }

    init() {
        // Format times when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.formatAllMessageTimes());
        } else {
            this.formatAllMessageTimes();
        }

        // Observe for new messages added dynamically
        this.observeNewMessages();
    }

    formatAllMessageTimes() {
        const timeElements = document.querySelectorAll('.msg-time[data-timestamp]');
        timeElements.forEach(element => {
            this.formatTimeElement(element);
        });
    }

    formatTimeElement(element) {
        const timestamp = element.getAttribute('data-timestamp');
        if (!timestamp) return;

        try {
            const date = new Date(timestamp);

            // Format time in user's local timezone
            const formattedTime = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).replace(/\./g, '').toUpperCase();

            element.textContent = formattedTime;

            // Add tooltip with full date/time if needed
            element.setAttribute('title', date.toLocaleString());
        } catch (error) {
            console.error('Error formatting time:', error);
            element.textContent = '--:--';
        }
    }

    observeNewMessages() {
        // Use MutationObserver to watch for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const timeElements = node.querySelectorAll ?
                            node.querySelectorAll('.msg-time[data-timestamp]') : [];
                        timeElements.forEach(element => this.formatTimeElement(element));

                        // If the added node itself is a time element
                        if (node.classList && node.classList.contains('msg-time') &&
                            node.hasAttribute('data-timestamp')) {
                            this.formatTimeElement(node);
                        }
                    }
                });
            });
        });

        // Start observing
        const chatContainer = document.querySelector('.msg-box') || document.body;
        if (chatContainer) {
            observer.observe(chatContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    // Method to format a single timestamp (useful for new messages)
    formatTimestamp(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).replace(/\./g, '').toUpperCase();
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return '--:--';
        }
    }
}

// Initialize the time formatter
const messageTimeFormatter = new MessageTimeFormatter();

// Also make it available globally for other scripts
window.formatMessageTime = (timestamp) => messageTimeFormatter.formatTimestamp(timestamp);