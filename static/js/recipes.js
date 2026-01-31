/**
 * Recipes Logic for CraftLLC
 */

let currentPage = 1;
let filteredCards = [];
const recipesPerPage = 5;
let countdownIntervals = {};
let cheatCodesUsed = JSON.parse(localStorage.getItem('cheatCodesUsed')) || {};

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById('recipeSearch');
    const sortSelect = document.getElementById('recipeSort');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    if (searchInput) {
        loadRecipes().then(() => {
            searchInput.addEventListener('keyup', filterAndSortRecipes);
            sortSelect.addEventListener('change', filterAndSortRecipes);

            if (prevButton) {
                prevButton.addEventListener('click', () => {
                    if (currentPage > 1) {
                        currentPage--;
                        displayPage(currentPage);
                    }
                });
            }

            if (nextButton) {
                nextButton.addEventListener('click', () => {
                    const totalPages = Math.ceil(filteredCards.length / recipesPerPage);
                    if (currentPage < totalPages) {
                        currentPage++;
                        displayPage(currentPage);
                    }
                });
            }
        });
    }

    // Modal UI for standalone view
    if (!isInIframe()) {
        setupCheatCodeModals();
    }
});

function isInIframe() {
    try { return window.self !== window.top; } catch (e) { return true; }
}

async function loadRecipes() {
    try {
        const response = await fetch('list.json');
        const recipes = await response.json();
        const recipesContainer = document.getElementById('recipesContainer');
        if (!recipesContainer) return;

        recipesContainer.innerHTML = '';
        recipes.forEach((recipe, index) => {
            const card = generateRecipeCard(recipe, index);
            recipesContainer.appendChild(card);
        });

        processRecipeCards();
        filterAndSortRecipes();
    } catch (e) {
        console.error("Failed to load recipes:", e);
    }
}

function generateRecipeCard(recipe, index) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.recipetype = recipe.recipe_type;
    card.dataset.tags = (recipe.keywords || []).join(', ');
    if (recipe.excluded_queries) card.dataset.blocklistedqueries = recipe.excluded_queries.join(',');
    if (recipe.recipe_unchecked) card.dataset.recipeunchecked = true;
    if (recipe.date) card.dataset.date = recipe.date;
    if (recipe.cheat_code) card.dataset.cheatcode = recipe.cheat_code;

    let videoHtml = '';
    if (recipe.video_id) {
        videoHtml = `<div class="card__vid-placeholder" data-videoid="${recipe.video_id}"></div>`;
    } else if (recipe.video_src) {
        videoHtml = `<video class="card__vid" src="${recipe.video_src}" preload controls></video>`;
    }

    let ingredientsHtml = '';
    (recipe.ingredients || []).forEach(group => {
        ingredientsHtml += `<br>${group._name ? 'Інградієнти для ' + group._name : 'Інградієнти'}:<br>`;
        for (const [name, amount] of Object.entries(group)) {
            if (name !== '_name') ingredientsHtml += `${name} - ${amount || ''}<br>`;
        }
    });

    let propsHtml = '';
    if (recipe.properties) {
        propsHtml += '<br>Властивості:<br>';
        if (recipe.properties.temperature) propsHtml += `Температура: ${recipe.properties.temperature}°C<br>`;
        if (recipe.properties.time) propsHtml += `Час: ${recipe.properties.time}<br>`;
        if (recipe.properties.mdiam) propsHtml += `Діаметр: ${recipe.properties.mdiam}<br>`;
    }

    let linkHref = recipe.video_id ? `https://youtube.com/watch?v=${recipe.video_id}` : (recipe.video_link || recipe.video_src || '#');

    card.innerHTML = `
        ${videoHtml}
        <div class="card__body">
            <a href="${linkHref}" class="card__title" target="_blank">${recipe.name}</a>
            <div class="card__desc">
                ${recipe.description || ''}
                ${propsHtml}
                ${ingredientsHtml}
            </div>
        </div>
    `;

    card.addEventListener('dblclick', () => {
        if (isInIframe()) {
            parent.postMessage({ type: 'openCheatCodeModal' }, '*');
        } else {
            const modal = document.getElementById('cheatCodeModal');
            if (modal) modal.style.display = 'flex';
        }
    });

    return card;
}

function processRecipeCards() {
    const now = new Date();
    document.querySelectorAll('.card').forEach((card, index) => {
        const dateAttr = card.dataset.date;
        const cardId = `card-${index}`;
        const isBypassed = cheatCodesUsed[cardId] === true;

        if (countdownIntervals[cardId]) {
            clearInterval(countdownIntervals[cardId]);
            delete countdownIntervals[cardId];
        }

        if (dateAttr) {
            const [d, m, y] = dateAttr.split('.').map(Number);
            const releaseDate = new Date(y, m - 1, d);
            const timeDiff = releaseDate.getTime() - now.getTime();

            const update = () => {
                const diff = releaseDate.getTime() - new Date().getTime();
                const cardVid = card.querySelector('.card__vid-placeholder, .card__vid');
                const cardTitle = card.querySelector('.card__title');
                const cardDesc = card.querySelector('.card__desc');

                if (!cardTitle.dataset.origTitle) {
                    cardTitle.dataset.origTitle = cardTitle.textContent;
                    cardTitle.dataset.origHref = cardTitle.href;
                    cardTitle.dataset.origDesc = cardDesc.innerHTML;
                }

                if (diff > 0 && !cheatCodesUsed[cardId]) {
                    if (cardVid) cardVid.style.display = 'none';
                    cardTitle.textContent = 'Секрет';
                    cardTitle.removeAttribute('href');
                    cardTitle.style.pointerEvents = 'none';
                    cardDesc.innerHTML = `Цей рецепт недоступний!<br>Він стане доступним: ${dateAttr}<div class="card__timer">${formatCountdown(diff)}</div>`;
                } else {
                    if (cardVid) cardVid.style.display = 'block';
                    cardTitle.textContent = cardTitle.dataset.origTitle;
                    cardTitle.href = cardTitle.dataset.origHref;
                    cardTitle.style.pointerEvents = 'auto';
                    cardDesc.innerHTML = cardTitle.dataset.origDesc;
                    clearInterval(countdownIntervals[cardId]);
                }
            };

            update();
            if (timeDiff > 0 && !isBypassed) {
                countdownIntervals[cardId] = setInterval(update, 1000);
            }
        }
    });
}

function formatCountdown(ms) {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000) % 24;
    const d = Math.floor(ms / 86400000);
    
    let res = '';
    if (d > 0) res += `<span><span class="value">${d}</span><span class="label">днів</span></span>`;
    if (h > 0 || d > 0) res += `<span><span class="value">${h}</span><span class="label">год</span></span>`;
    res += `<span><span class="value">${m}</span><span class="label">хв</span></span>`;
    res += `<span><span class="value">${s}</span><span class="label">с</span></span>`;
    return res;
}

function filterAndSortRecipes() {
    const term = normalizeText(document.getElementById('recipeSearch').value);
    const type = document.getElementById('recipeSort').value;
    const cards = document.querySelectorAll('.card');

    filteredCards = Array.from(cards).filter(card => {
        const matchesType = type === 'all' || card.dataset.recipetype === type;
        if (!matchesType) return false;
        if (!term) return true;

        const content = normalizeText(card.textContent + (card.dataset.tags || ''));
        return content.includes(term);
    });

    currentPage = 1;
    displayPage(1);
}

function normalizeText(text) {
    return text.toLowerCase().replace(/[^\u0400-\u04FFa-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function displayPage(page) {
    const cards = document.querySelectorAll('.card');
    cards.forEach(c => c.style.display = 'none');

    const start = (page - 1) * recipesPerPage;
    const end = start + recipesPerPage;
    const toShow = filteredCards.slice(start, end);

    toShow.forEach(card => {
        card.style.display = 'block';
        loadVideoForCard(card);
    });

    updatePagination();
}

function loadVideoForCard(card) {
    const ph = card.querySelector('.card__vid-placeholder');
    if (ph) {
        const id = ph.dataset.videoid;
        const ifr = document.createElement('iframe');
        ifr.className = 'card__vid';
        ifr.src = `https://youtube.com/embed/${id}?rel=0`;
        ifr.setAttribute('allowfullscreen', '');
        ifr.setAttribute('frameborder', '0');
        ph.replaceWith(ifr);
    }
}

function updatePagination() {
    const total = Math.ceil(filteredCards.length / recipesPerPage);
    const info = document.getElementById('page-info');
    if (info) info.textContent = `Сторінка ${currentPage} з ${total || 1}`;
    
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    if (prev) prev.disabled = currentPage === 1;
    if (next) next.disabled = currentPage === total || total === 0;

    const count = document.getElementById('searchResultsCount');
    if (count) count.textContent = `Знайдено рецептів: ${filteredCards.length}`;
}

// Iframe Communication
window.addEventListener('message', (event) => {
    if (event.data.type === 'UPDATE_RECIPES_DISPLAY') {
        cheatCodesUsed = JSON.parse(localStorage.getItem('cheatCodesUsed')) || {};
        processRecipeCards();
        filterAndSortRecipes();
    } else if (event.data.type === 'SUBMIT_CHEAT_CODE') {
        handleCheatCode(event.data.code);
    }
});

function handleCheatCode(code) {
    let matched = false;
    document.querySelectorAll('.card').forEach((card, index) => {
        const cardCode = card.dataset.cheatcode;
        if (cardCode && cardCode.toLowerCase() === code.toLowerCase()) {
            cheatCodesUsed[`card-${index}`] = true;
            matched = true;
        }
    });

    if (matched) {
        localStorage.setItem('cheatCodesUsed', JSON.stringify(cheatCodesUsed));
        processRecipeCards();
        filterAndSortRecipes();
        if (isInIframe()) parent.postMessage({ type: 'CHEAT_CODE_RESULT', success: true }, '*');
    } else {
        if (isInIframe()) parent.postMessage({ type: 'CHEAT_CODE_RESULT', success: false }, '*');
    }
    return matched;
}

function setupCheatCodeModals() {
    // Logic for standalone page if needed
}
