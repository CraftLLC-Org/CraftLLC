/**
 * Common JS for CraftLLC
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Loader Logic
    const loaderWrapper = document.getElementById('loader-wrapper');
    if (loaderWrapper) {
        loaderWrapper.style.display = 'none';
    }
    
    // Hide loader also on window load as backup
    window.addEventListener('load', () => {
        if (loaderWrapper) loaderWrapper.style.display = 'none';
    });

    // 2. Mobile Menu Logic
    const menuToggle = document.querySelector('.menu-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            navMenu.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', !isExpanded);
        });
    }

    // 3. Asset Versioning / Date-based customization
    setSpecialDateAssets();

    // 4. Handle Iframe height messages
    setupIframeHeightHandler();

    // 5. Light mode detection (URL param)
    handleLightMode();
});

function setSpecialDateAssets() {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;

    const favicon = document.getElementById('favicon') || document.querySelector('link[rel="icon"]');
    const headerLogo = document.getElementById('header-logo');
    const bodyLogo = document.getElementById('logo'); // Some pages use 'logo' as ID

    if (month === 1 && day === 1) {
        if (favicon) favicon.href = '/static/img/favicon2.ico';
        if (headerLogo) headerLogo.src = '/static/img/logo2.png';
        if (bodyLogo) bodyLogo.src = '/static/img/logo2.png';
    } 
    else if (month === 3 && day === 8) {
        if (headerLogo) headerLogo.src = '/static/img/logo3.png';
        if (bodyLogo) bodyLogo.src = '/static/img/logo3.png';
    } 
    else if (month === 9 && day === 26) {
        if (favicon) favicon.href = '/static/img/favicon_birthday.ico';
        if (headerLogo) headerLogo.src = '/static/img/logo_birthday.png';
        if (bodyLogo) bodyLogo.src = '/static/img/logo_birthday.png';
    }
    else {
        if (favicon) favicon.href = '/favicon.ico';
        if (headerLogo) headerLogo.src = '/static/img/logo.png';
        if (bodyLogo) bodyLogo.src = '/static/img/logo.png';
    }
}

function adjustAllIframesHeight() {
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach(iframe => {
        try {
            if (iframe.contentWindow && iframe.contentWindow.document && iframe.contentWindow.document.body) {
                const contentHeight = iframe.contentWindow.document.body.scrollHeight;
                if (contentHeight > 0) {
                    iframe.style.height = (contentHeight + 20) + "px";
                }
            }
        } catch (e) {
            // Silence cross-origin errors
        }
    });
}

function setupIframeHeightHandler() {
    if (document.querySelectorAll('iframe').length > 0) {
        window.addEventListener("load", () => {
            adjustAllIframesHeight();
            setInterval(adjustAllIframesHeight, 500);
        });
    }
}

function handleLightMode() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('light') === 'true') {
        document.body.style.background = 'none';
        document.body.style.backgroundColor = '#f4f4f4';
        document.body.style.color = 'black';
        
        const footer = document.getElementById("footerID") || document.querySelector('footer');
        if (footer) footer.style.background = '#e0e0e0';

        document.querySelectorAll('a').forEach(link => {
            link.style.color = 'black';
            try {
                const linkUrl = new URL(link.href, window.location.origin);
                if (linkUrl.origin === window.location.origin && !linkUrl.searchParams.has('light')) {
                    linkUrl.searchParams.set('light', 'true');
                    link.href = linkUrl.toString();
                }
            } catch (e) {}
        });
    }
}

// Session & Auth logic
async function logoutUser() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            window.location.reload();
        } else {
            showModal('Помилка', 'Помилка при виході. Спробуйте ще раз.');
        }
    } catch (error) {
        showModal('Помилка мережі', 'Помилка мережі при виході. Перевірте з\'єднання.');
    }
}

function showModal(title, message) {
    let modal = document.querySelector('.error-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal error-modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <p>${message}</p>
            <button onclick="this.closest('.modal').style.display='none'">Закрити</button>
        </div>
    `;
    modal.style.display = 'flex';
}
