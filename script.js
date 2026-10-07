/* ==========================================================================
   Hasan Restaurant - Shared JavaScript
   Used by: index.html, menu.html, review.html, login.html, contact.html

   Features
   - Hamburger menu (all pages)
   - Cart with quantities, saved in the browser, cart drawer + checkout (all pages)
   - Login / logout (demo, saved in the browser)
   - Reviews saved in the browser; menu ratings update from them
   - Toast messages instead of alert() popups
   ========================================================================== */

(function () {
    'use strict';

    /* ---------------------------------------------------------------------
       Data
       --------------------------------------------------------------------- */
    const MENU = {
        'Hyderabadi Biryani':    { price: 220, rating: 4.9, count: 128 },
        'Chicken Butter Masala': { price: 260, rating: 4.7, count: 95 },
        'Paneer Tikka':          { price: 180, rating: 4.6, count: 64 }
    };

    const KEYS = {
        cart: 'hr_cart',
        user: 'hr_user',
        reviews: 'hr_reviews',
        orders: 'hr_orders'
    };

    const PAGES = ['index.html', 'menu.html', 'review.html', 'contact.html'];
    const FIRST_ORDER_DISCOUNT = 0.10;
    const MAX_QTY = 20;
    const MAX_SAVED_REVIEWS = 50;
    const REVIEWS_SHOWN = 10;

    /* ---------------------------------------------------------------------
       Storage helpers (fall back to memory if localStorage is blocked)
       --------------------------------------------------------------------- */
    const memoryStore = {};

    function load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            const value = JSON.parse(raw);
            return value === null ? fallback : value;
        } catch (e) {
            return key in memoryStore ? memoryStore[key] : fallback;
        }
    }

    function save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            memoryStore[key] = value;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            delete memoryStore[key];
        }
    }

    /* ---------------------------------------------------------------------
       Small utilities
       --------------------------------------------------------------------- */
    function currentPage() {
        return location.pathname.split('/').pop() || 'index.html';
    }

    function rupees(amount) {
        return '₹' + amount.toLocaleString('en-IN');
    }

    function starsFor(count) {
        const full = Math.max(0, Math.min(5, count));
        return '⭐'.repeat(full) + '☆'.repeat(5 - full);
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /* ---------------------------------------------------------------------
       Toast messages
       --------------------------------------------------------------------- */
    function showToast(message) {
        let box = document.getElementById('toastBox');
        if (!box) {
            box = el('div', 'toast-box');
            box.id = 'toastBox';
            box.setAttribute('aria-live', 'polite');
            document.body.appendChild(box);
        }
        const toast = el('div', 'toast', message);
        box.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('hide');
            setTimeout(function () { toast.remove(); }, 300);
        }, 2600);
    }

    /* ---------------------------------------------------------------------
       User / login
       --------------------------------------------------------------------- */
    function getUser() {
        const user = load(KEYS.user, null);
        if (user && typeof user.mobile === 'string' && /^\d{10}$/.test(user.mobile)) {
            return user;
        }
        return null;
    }

    function maskedMobile(mobile) {
        return '+91 ******' + mobile.slice(-4);
    }

    function logout() {
        remove(KEYS.user);
        showToast('You have been logged out.');
        refreshAll();
    }

    function updateAuthUI() {
        const user = getUser();

        // Navbar link
        const link = document.querySelector('#mainNav a[data-auth], #mainNav a[href="login.html"]');
        if (link) {
            link.dataset.auth = 'true';
            if (user) {
                link.textContent = 'Logout';
                link.setAttribute('href', '#');
                link.title = 'Logged in as ' + maskedMobile(user.mobile);
            } else {
                link.textContent = 'Login';
                link.setAttribute('href', 'login.html');
                link.removeAttribute('title');
            }
        }

        // Home page hero button
        const hero = document.getElementById('heroOrderBtn');
        if (hero) {
            hero.textContent = user ? 'Order Now' : 'Login to Order';
            hero.setAttribute('href', user ? 'menu.html' : 'login.html');
        }

        // Login page panels
        const loginBox = document.getElementById('loginBox');
        const loggedInBox = document.getElementById('loggedInBox');
        if (loginBox && loggedInBox) {
            loginBox.hidden = !!user;
            loggedInBox.hidden = !user;
            const text = document.getElementById('loggedInText');
            if (text && user) text.textContent = 'Logged in as ' + maskedMobile(user.mobile);
        }
    }

    function setupAuth() {
        const navLink = document.querySelector('#mainNav a[href="login.html"]');
        if (navLink) {
            navLink.addEventListener('click', function (e) {
                if (getUser()) {
                    e.preventDefault();
                    logout();
                }
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);

        const form = document.getElementById('loginForm');
        if (!form) return;

        const mobileInput = document.getElementById('mobile');
        const passwordInput = document.getElementById('password');
        const mobileError = document.getElementById('mobileError');
        const passwordError = document.getElementById('passwordError');

        // Allow digits only in the mobile field
        mobileInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 10);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            mobileError.textContent = '';
            passwordError.textContent = '';

            const mobile = mobileInput.value.trim();
            const password = passwordInput.value;
            let valid = true;

            if (!/^\d{10}$/.test(mobile)) {
                mobileError.textContent = 'Please enter a valid 10-digit mobile number.';
                valid = false;
            }
            if (password.length < 6) {
                passwordError.textContent = 'Password must be at least 6 characters.';
                valid = false;
            }
            if (!valid) return;

            // Demo only: there is no server, so any valid number + password works.
            // The password is NOT stored anywhere.
            save(KEYS.user, { mobile: mobile, at: Date.now() });
            form.reset();
            showToast('Login successful! Welcome to Hasan Restaurant.');
            refreshAll();

            // Go back to where the user came from (only to known pages)
            const next = new URLSearchParams(location.search).get('next');
            const target = PAGES.indexOf(next) !== -1 ? next : 'menu.html';
            setTimeout(function () { location.href = target; }, 800);
        });
    }

    /* ---------------------------------------------------------------------
       Cart
       --------------------------------------------------------------------- */
    function getCart() {
        const raw = load(KEYS.cart, []);
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(function (item) {
                return item && MENU[item.name] && Number.isInteger(item.qty) && item.qty > 0;
            })
            .map(function (item) {
                return { name: item.name, qty: Math.min(item.qty, MAX_QTY) };
            });
    }

    function saveCart(cart) {
        save(KEYS.cart, cart);
        updateCartUI();
    }

    function addToCart(name) {
        if (!MENU[name]) return;
        const cart = getCart();
        const found = cart.find(function (i) { return i.name === name; });
        if (found) {
            if (found.qty >= MAX_QTY) {
                showToast('Maximum ' + MAX_QTY + ' of one item per order.');
                return;
            }
            found.qty++;
        } else {
            cart.push({ name: name, qty: 1 });
        }
        saveCart(cart);
        showToast(name + ' added to cart');
    }

    function changeQty(name, delta) {
        const cart = getCart();
        const item = cart.find(function (i) { return i.name === name; });
        if (!item) return;
        item.qty = Math.min(MAX_QTY, item.qty + delta);
        saveCart(cart.filter(function (i) { return i.qty > 0; }));
    }

    function removeFromCart(name) {
        saveCart(getCart().filter(function (i) { return i.name !== name; }));
    }

    function isFirstOrder(user) {
        if (!user) return false;
        const orders = load(KEYS.orders, []);
        return !Array.isArray(orders) || !orders.some(function (o) { return o.mobile === user.mobile; });
    }

    function cartTotals(cart) {
        const subtotal = cart.reduce(function (sum, i) { return sum + MENU[i.name].price * i.qty; }, 0);
        const discount = isFirstOrder(getUser()) ? Math.round(subtotal * FIRST_ORDER_DISCOUNT) : 0;
        return { subtotal: subtotal, discount: discount, total: subtotal - discount };
    }

    function buildCartUI() {
        // Cart button in the header (before the hamburger)
        const header = document.querySelector('header');
        const toggle = document.getElementById('menuToggle');
        if (header && toggle && !document.getElementById('cartBtn')) {
            const btn = el('button', 'cart-btn');
            btn.id = 'cartBtn';
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Open cart');
            btn.innerHTML = '🛒 <span id="cartCount">0</span>';
            header.insertBefore(btn, toggle);
        }

        // Overlay + drawer
        if (!document.getElementById('cartDrawer')) {
            const overlay = el('div', 'cart-overlay');
            overlay.id = 'cartOverlay';

            const drawer = el('aside', 'cart-drawer');
            drawer.id = 'cartDrawer';
            drawer.setAttribute('aria-label', 'Your cart');
            drawer.innerHTML =
                '<div class="cart-head">' +
                    '<h3>Your Cart</h3>' +
                    '<button type="button" class="cart-close" id="cartClose" aria-label="Close cart">✕</button>' +
                '</div>' +
                '<div class="cart-body" id="cartBody"></div>';

            document.body.appendChild(overlay);
            document.body.appendChild(drawer);
        }
    }

    function openCart() {
        const drawer = document.getElementById('cartDrawer');
        if (!drawer) return;
        closeNav();
        updateCartUI();
        drawer.classList.add('open');
        document.getElementById('cartOverlay').classList.add('open');
        document.getElementById('cartClose').focus();
    }

    function closeCart() {
        const drawer = document.getElementById('cartDrawer');
        if (!drawer || !drawer.classList.contains('open')) return;
        drawer.classList.remove('open');
        document.getElementById('cartOverlay').classList.remove('open');
        const btn = document.getElementById('cartBtn');
        if (btn) btn.focus();
    }

    function updateCartUI() {
        const cart = getCart();
        const count = cart.reduce(function (sum, i) { return sum + i.qty; }, 0);

        const badge = document.getElementById('cartCount');
        if (badge) badge.textContent = count;

        const body = document.getElementById('cartBody');
        if (!body || body.dataset.view === 'confirmation') return;
        renderCartBody(body, cart);
    }

    function renderCartBody(body, cart) {
        body.replaceChildren();

        if (cart.length === 0) {
            body.appendChild(el('p', 'cart-empty', 'Your cart is empty.'));
            if (currentPage() !== 'menu.html') {
                const link = el('a', 'btn', 'Browse Menu');
                link.href = 'menu.html';
                body.appendChild(link);
            }
            return;
        }

        const list = el('div', 'cart-items');
        cart.forEach(function (item) {
            const price = MENU[item.name].price;
            const row = el('div', 'cart-row');

            const info = el('div', 'cart-info');
            info.appendChild(el('strong', '', item.name));
            info.appendChild(el('span', 'cart-each', rupees(price) + ' each'));
            row.appendChild(info);

            const qty = el('div', 'qty-controls');
            const minus = el('button', 'qty-btn', '−');
            minus.type = 'button';
            minus.dataset.action = 'dec';
            minus.dataset.name = item.name;
            minus.setAttribute('aria-label', 'Decrease quantity of ' + item.name);
            const num = el('span', 'qty-num', String(item.qty));
            const plus = el('button', 'qty-btn', '+');
            plus.type = 'button';
            plus.dataset.action = 'inc';
            plus.dataset.name = item.name;
            plus.setAttribute('aria-label', 'Increase quantity of ' + item.name);
            qty.append(minus, num, plus);
            row.appendChild(qty);

            row.appendChild(el('div', 'cart-line', rupees(price * item.qty)));

            const del = el('button', 'cart-remove', '🗑');
            del.type = 'button';
            del.dataset.action = 'remove';
            del.dataset.name = item.name;
            del.setAttribute('aria-label', 'Remove ' + item.name);
            row.appendChild(del);

            list.appendChild(row);
        });
        body.appendChild(list);

        const user = getUser();
        const totals = cartTotals(cart);
        const summary = el('div', 'cart-summary');

        function line(label, value, cls) {
            const r = el('div', 'sum-row' + (cls ? ' ' + cls : ''));
            r.append(el('span', '', label), el('span', '', value));
            summary.appendChild(r);
        }
        line('Subtotal', rupees(totals.subtotal));
        if (totals.discount > 0) line('First order discount (10%)', '− ' + rupees(totals.discount), 'sum-discount');
        line('Total', rupees(totals.total), 'sum-total');
        body.appendChild(summary);

        if (!user) {
            body.appendChild(el('p', 'cart-note', 'Log in to place your order and get 10% off your first order.'));
        }

        const checkout = el('button', 'btn cart-checkout', user ? 'Place Order' : 'Login to Checkout');
        checkout.type = 'button';
        checkout.id = 'checkoutBtn';
        body.appendChild(checkout);

        const clear = el('button', 'btn btn-outline cart-clear', 'Clear Cart');
        clear.type = 'button';
        clear.id = 'clearCartBtn';
        body.appendChild(clear);
    }

    function checkout() {
        const cart = getCart();
        if (cart.length === 0) return;

        const user = getUser();
        if (!user) {
            closeCart();
            location.href = 'login.html?next=' + encodeURIComponent(PAGES.indexOf(currentPage()) !== -1 ? currentPage() : 'menu.html');
            return;
        }

        const totals = cartTotals(cart);
        const orders = load(KEYS.orders, []);
        const orderId = 'HR' + String(Date.now()).slice(-6);
        const list = Array.isArray(orders) ? orders : [];
        list.push({
            id: orderId,
            mobile: user.mobile,
            items: cart,
            subtotal: totals.subtotal,
            discount: totals.discount,
            total: totals.total,
            date: new Date().toISOString()
        });
        save(KEYS.orders, list);
        save(KEYS.cart, []);

        // Show confirmation inside the drawer
        const body = document.getElementById('cartBody');
        body.dataset.view = 'confirmation';
        body.replaceChildren();
        body.appendChild(el('div', 'order-done-icon', '✅'));
        body.appendChild(el('h4', 'order-done-title', 'Order placed!'));
        body.appendChild(el('p', 'cart-note', 'Order #' + orderId + ' for ' + rupees(totals.total) + ' has been placed. Thank you for ordering from Hasan Restaurant!'));
        const done = el('button', 'btn', 'Done');
        done.type = 'button';
        done.id = 'orderDoneBtn';
        body.appendChild(done);

        updateCartUI();
        showToast('Order placed successfully!');
    }

    function setupCart() {
        buildCartUI();
        updateCartUI();

        document.addEventListener('click', function (e) {
            const t = e.target;

            if (t.closest('#cartBtn')) { openCart(); return; }
            if (t.closest('#cartClose') || t.id === 'cartOverlay') { closeCart(); return; }

            if (t.closest('#orderDoneBtn')) {
                const body = document.getElementById('cartBody');
                delete body.dataset.view;
                closeCart();
                updateCartUI();
                return;
            }

            if (t.closest('#checkoutBtn')) { checkout(); return; }

            if (t.closest('#clearCartBtn')) {
                saveCart([]);
                showToast('Cart cleared.');
                return;
            }

            const actionBtn = t.closest('[data-action]');
            if (actionBtn && actionBtn.closest('#cartDrawer')) {
                const name = actionBtn.dataset.name;
                if (actionBtn.dataset.action === 'inc') changeQty(name, 1);
                if (actionBtn.dataset.action === 'dec') changeQty(name, -1);
                if (actionBtn.dataset.action === 'remove') removeFromCart(name);
                return;
            }

            const addBtn = t.closest('.add-to-cart');
            if (addBtn) {
                const card = addBtn.closest('[data-dish]');
                if (card) addToCart(card.dataset.dish);
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeCart();
        });
    }

    /* ---------------------------------------------------------------------
       Reviews
       --------------------------------------------------------------------- */
    function getReviews() {
        const raw = load(KEYS.reviews, []);
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (r) {
            return r && MENU[r.dish] && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 &&
                   typeof r.text === 'string';
        });
    }

    function dishStats(dish, reviews) {
        const base = MENU[dish];
        const mine = reviews.filter(function (r) { return r.dish === dish; });
        const sum = mine.reduce(function (s, r) { return s + r.rating; }, 0);
        const count = base.count + mine.length;
        return { avg: (base.rating * base.count + sum) / count, count: count };
    }

    function renderMenuCards() {
        const cards = document.querySelectorAll('.menu-card[data-dish]');
        if (cards.length === 0) return;
        const reviews = getReviews();

        cards.forEach(function (card) {
            const dish = card.dataset.dish;
            if (!MENU[dish]) return;
            const stats = dishStats(dish, reviews);

            // Show a whole-star rating (e.g. 4.7 -> 4 stars, 4.9 -> 5 stars)
            card.querySelector('.stars').textContent = starsFor(Math.floor(stats.avg + 0.1));
            card.querySelector('.rating-value').textContent = stats.avg.toFixed(1) + ' / 5';
            card.querySelector('.review-count').textContent = '(' + stats.count + ' Reviews)';
            card.querySelector('.price-tag').textContent = rupees(MENU[dish].price);
        });
    }

    function renderReviewList() {
        const box = document.getElementById('reviewList');
        if (!box) return;
        box.replaceChildren();

        const reviews = getReviews().slice().reverse().slice(0, REVIEWS_SHOWN);
        if (reviews.length === 0) {
            box.appendChild(el('p', 'cart-empty', 'No reviews yet. Be the first to review!'));
            return;
        }

        reviews.forEach(function (r) {
            const card = el('article', 'review-card');
            const top = el('div', 'review-top');
            top.appendChild(el('span', 'stars', starsFor(r.rating)));
            top.appendChild(el('strong', '', r.dish));
            card.appendChild(top);
            card.appendChild(el('p', 'review-text', r.text));

            const date = new Date(r.date);
            const when = isNaN(date) ? '' : ' · ' + date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            card.appendChild(el('small', 'review-meta', (r.name || 'Guest') + when));
            box.appendChild(card);
        });
    }

    function setupReviewForm() {
        const form = document.getElementById('reviewForm');
        if (!form) return;

        // Pre-fill name for logged-in users is not possible (we only store a mobile number),
        // so the name stays optional.
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const dish = document.getElementById('dishSelect').value;
            const rating = parseInt(document.getElementById('ratingValue').value, 10);
            const text = document.getElementById('userReview').value.trim();
            const name = document.getElementById('reviewName').value.trim();

            if (!MENU[dish] || !(rating >= 1 && rating <= 5)) return;
            if (text.length < 5) {
                showToast('Please write at least 5 characters in your review.');
                return;
            }

            const reviews = getReviews();
            reviews.push({
                dish: dish,
                rating: rating,
                text: text,
                name: name || 'Guest',
                date: new Date().toISOString()
            });
            save(KEYS.reviews, reviews.slice(-MAX_SAVED_REVIEWS));

            form.reset();
            renderReviewList();
            showToast('Thank you! Your ' + rating + '-star review of ' + dish + ' has been submitted.');
        });
    }

    /* ---------------------------------------------------------------------
       Hamburger menu
       --------------------------------------------------------------------- */
    function closeNav() {
        const toggle = document.getElementById('menuToggle');
        const nav = document.getElementById('mainNav');
        if (!toggle || !nav) return;
        nav.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
    }

    function setupMenuToggle() {
        const toggle = document.getElementById('menuToggle');
        const nav = document.getElementById('mainNav');
        if (!toggle || !nav) return;

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            const open = !nav.classList.contains('open');
            nav.classList.toggle('open', open);
            toggle.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        });

        document.addEventListener('click', function (e) {
            if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeNav();
        });
    }

    /* ---------------------------------------------------------------------
       Contact page: open / closed status (Hyderabad time, 11 AM - 11 PM)
       --------------------------------------------------------------------- */
    function setupOpenStatus() {
        const badge = document.getElementById('openStatus');
        if (!badge) return;

        let hour;
        try {
            hour = parseInt(new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23'
            }).format(new Date()), 10);
        } catch (e) {
            hour = new Date().getHours();
        }
        const open = hour >= 11 && hour < 23;
        badge.textContent = open ? '● Open now' : '● Closed now';
        badge.classList.add(open ? 'is-open' : 'is-closed');
    }

    /* ---------------------------------------------------------------------
       Broken images -> friendly placeholder
       --------------------------------------------------------------------- */
    function markBroken(img) {
        const box = img.closest('.image-box');
        if (!box) return;
        img.style.display = 'none';
        box.classList.add('img-missing');
    }

    function setupImageFallback() {
        document.addEventListener('error', function (e) {
            if (e.target && e.target.tagName === 'IMG') markBroken(e.target);
        }, true);

        document.querySelectorAll('.image-box img').forEach(function (img) {
            if (img.complete && img.naturalWidth === 0) markBroken(img);
        });
    }

    /* ---------------------------------------------------------------------
       Start-up
       --------------------------------------------------------------------- */
    function refreshAll() {
        updateAuthUI();
        updateCartUI();
        renderMenuCards();
        renderReviewList();
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupMenuToggle();
        setupCart();
        setupAuth();
        setupReviewForm();
        setupOpenStatus();
        setupImageFallback();
        refreshAll();

        // Keep several open tabs in sync
        window.addEventListener('storage', refreshAll);
    });
})();
