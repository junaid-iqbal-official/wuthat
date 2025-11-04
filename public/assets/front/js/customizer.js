'use strict';

class Customizer {
  constructor() {
    this.DOM_CACHE = {};
    this.initialized = false;
  }

  removeActiveClass(elements) {
    elements.forEach(el => el.classList.remove('active'));
  }

  async saveSetting(url, data, errorMessage) {
    try {
      const result = await makeApiCall(url, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (!result || !result.success) {
        showNotification(errorMessage || 'Action failed', 'danger');
        return null;
      }
      return result;
    } catch (err) {
      showNotification(err.message || errorMessage || 'Something went wrong', 'danger');
      return null;
    }
  }

  switchBodyClass(removeClasses = [], addClass = '') {
    document.body.classList.remove(...removeClasses);
    if (addClass) document.body.classList.add(addClass);
  }

  // Theme Functions 
  initThemeLayout() {
    const layoutItems = document.querySelectorAll('.theme-layout li');
    if (!layoutItems.length) return;

    layoutItems.forEach(item => {
      item.addEventListener('click', async () => {
        const selectedLayout = item.getAttribute('data-attr') || '';

        this.removeActiveClass(layoutItems);
        item.classList.add('active');

        this.switchBodyClass(['dark-sidebar', 'dark', 'colorfull'], selectedLayout);

        await this.saveSetting('/user/setting/theme-layout', { theme_layout: selectedLayout }, 'Failed to save theme layout');
      });
    });
  }

  initThemeDirection() {
    const rtlToggle = getElement('.rtl-setting');
    if (!rtlToggle) return;

    rtlToggle.addEventListener('click', async () => {
      const isRTL = rtlToggle.classList.toggle('rtl');
      document.body.classList.toggle('rtl', isRTL);
      rtlToggle.textContent = isRTL ? 'LTR' : 'RTL';

      await this.saveSetting('/user/setting/theme-direction', { layout: isRTL ? 'rtl' : 'ltr' }, 'Failed to save layout preference');
    });
  }

  initThemeMode() {
    const modeToggle = getElement('#theme-mode .mode');
    if (!modeToggle) return;

    modeToggle.addEventListener('click', async () => {
      const isDark = document.body.classList.contains('dark');

      const newMode = isDark ? 'dark' : 'light';
      this.switchBodyClass(['dark', 'light'], isDark ? 'dark' : 'light');

      await this.saveSetting('/user/setting/theme-mode', { theme_mode: newMode }, 'Theme mode update failed');
    });
  }

  async applyThemeColor() {
    const colorStylesheet = getElement('#color');
    if (!colorStylesheet) return;

    try {
      const result = await makeApiCall('/user/setting/theme-color');

      if (result?.theme_color) {
        const color = result.theme_color;
        const colorClass = result.color_class || '';

        document.documentElement.style.setProperty('--primary-color', color);
        if (colorClass) document.body.classList.add(colorClass);

        const allColors = document.querySelectorAll('.colors li');
        const activeItem = getElement(`.colors li[data-attr="${color}"]`);
        if (allColors.length && activeItem) {
          this.removeActiveClass(allColors);
          activeItem.classList.add('active');
        }
      }
    } catch (err) {
      showNotification(err.message || 'Error applying theme color', 'danger');
    }
  }

  initSidebarLayout() {
    const sidebarButtons = document.querySelectorAll('.sidebar-setting .two-column, .sidebar-setting .three-column');
    const sidebarItems = document.querySelectorAll('.sidebar-setting li');
    const themeButtons = document.querySelectorAll('.theme-title .icon-btn');
    const mainNav = document.querySelectorAll('.main-nav');

    if (!sidebarButtons.length) return;

    sidebarButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const isTwoColumn = button.classList.contains('two-column');
        const layoutType = isTwoColumn ? 'two-column' : 'three-column';

        this.removeActiveClass(sidebarItems);
        button.classList.add('active');

        themeButtons.forEach(btn => {
          btn.classList.toggle('btn-outline-light', !isTwoColumn);
          btn.classList.toggle('btn-outline-primary', !isTwoColumn);
        });

        mainNav.forEach(nav => nav.classList.toggle('on', !isTwoColumn));

        await this.saveSetting('/user/setting/sidebar-layout', { sidebar_layout: layoutType }, 'Failed to save sidebar layout');
      });
    });
  }

  initChatWallpaper() {
    const wallpaperElements = document.querySelectorAll('.wallpaper li.bg-size, .wallpaper li.bg-color');
    if (!wallpaperElements.length) return;

    const debouncedWallpaperUpdate = debounce(async (wallpaper) => {
      try {
        const result = await makeApiCall('/user/setting/wallpaper', {
            method: 'POST',
            body: JSON.stringify({ chat_wallpaper: wallpaper })
        });

        if (!result.success) {
          showNotification('Failed to save wallpaper','danger');
          return;
        }
      } catch (error) {
        showNotification('Wallpaper update failed','danger');
      }
    }, 500);

    wallpaperElements.forEach(el => {
      el.addEventListener('click', () => {
        const wallpaper = el.getAttribute('data-wallpaper');
        
        if (wallpaper && !wallpaper.includes('gradient')) {
          debouncedWallpaperUpdate(wallpaper);
        } else if(el.classList.contains('bg-default')){
          debouncedWallpaperUpdate('none');
        } else {
          debouncedWallpaperUpdate(wallpaper);
        }
      });
    });
  }

  applyChatWallpaper(chattingEl, wallpaper) {
    if (!wallpaper) return;
    
    const isGradient = wallpaper.startsWith('radial-gradient') || wallpaper.startsWith('linear-gradient');
    
    if (isGradient) {
      chattingEl.style.cssText = `
        background-image: ${wallpaper};
        background-color: transparent;
      `;
    } else if (wallpaper === 'none') {
      chattingEl.style.cssText = `
        background-image: none;
        backgroundBlendMode: unset;
      `;
    } else {
      chattingEl.style.cssText = `
        background-image: url('${wallpaper}');
        background-color: transparent;
        background-size: cover;
        background-position: center center;
      `;
    }
  }

  setActiveWallpaper() {
    const chatContainer = getElement('#chatting');
    if (!chatContainer) return;

    const currentWallpaper = chatContainer.getAttribute('data-wallpaper');
    const wallpaperItems = document.querySelectorAll('.wallpaper li');
    
    if(wallpaperItems){
      wallpaperItems.forEach(item => {
        const itemWallpaper = item.getAttribute('data-wallpaper');
        
        item.classList.remove('active');
        
        if (currentWallpaper === 'none' && item.classList.contains('bg-default')) {
          item.classList.add('active');
        } else if (itemWallpaper === currentWallpaper.split('/').pop()) {
          item.classList.add('active');
        }
      });
    }
  }

  // === Apply Theme on Page Load ===
  async applyTheme() {
    const chattingEl = getElement('#chatting');
    if (chattingEl) {
      const wallpaper = chattingEl.getAttribute('data-wallpaper');
      this.applyChatWallpaper(chattingEl, wallpaper);
    }
    
    this.setActiveWallpaper();
    
    await this.applyThemeColor();

    const sidebarLayout = document.querySelector('.main-nav')?.getAttribute('data-sidebar') || 'three-column';

    document.querySelectorAll('.sidebar-setting li').forEach(li => {
      li.classList.remove('active');
    });

    const activeSidebarOption = document.querySelector(`.sidebar-setting li.${sidebarLayout}`);
    if (activeSidebarOption) {
      activeSidebarOption.classList.add('active');
    }
  }

  initialize() {
    if (this.initialized) return;

    this.initThemeLayout();
    this.initThemeDirection();
    this.initThemeMode();
    this.initSidebarLayout();
    this.initChatWallpaper();
    
    this.initialized = true;
  }
} 