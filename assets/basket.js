const WORKER_URL = 'https://autumn-bread-f290.uber-niche-parts.workers.dev/';

function getBasket() {
  try { return JSON.parse(localStorage.getItem('basket') || '[]'); }
  catch { return []; }
}

function saveBasket(basket) {
  localStorage.setItem('basket', JSON.stringify(basket));
  renderBasketCount();
  renderBasketItems();
}

function addToBasket(priceId, name, price, label) {
  const basket = getBasket();
  const existing = basket.find(i => i.priceId === priceId);
  if (existing) {
    existing.quantity++;
  } else {
    basket.push({ priceId, name, price, label: label || '', quantity: 1 });
  }
  saveBasket(basket);
  openBasket();
}

function removeFromBasket(priceId) {
  saveBasket(getBasket().filter(i => i.priceId !== priceId));
}

function updateQuantity(priceId, delta) {
  const basket = getBasket();
  const item = basket.find(i => i.priceId === priceId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) { removeFromBasket(priceId); return; }
  saveBasket(basket);
}

function renderBasketCount() {
  const badge = document.getElementById('basket-count');
  if (!badge) return;
  const count = getBasket().reduce((sum, i) => sum + i.quantity, 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function renderBasketItems() {
  const list = document.getElementById('basket-items');
  const totalEl = document.getElementById('basket-total');
  if (!list) return;

  const basket = getBasket();

  if (basket.length === 0) {
    list.innerHTML = '<p class="basket-empty">Your basket is empty.</p>';
    if (totalEl) totalEl.textContent = '';
    const btn = document.getElementById('basket-checkout-btn');
    if (btn) btn.disabled = true;
    return;
  }

  list.innerHTML = basket.map(item => `
    <div class="basket-item">
      <div class="basket-item-info">
        <span class="basket-item-name">${item.name}${item.label ? ' &ndash; ' + item.label : ''}</span>
        <span class="basket-item-price">£${(item.price * item.quantity).toFixed(2)}</span>
      </div>
      <div class="basket-item-controls">
        <button onclick="updateQuantity('${item.priceId}', -1)" class="basket-qty-btn">&#8722;</button>
        <span class="basket-qty">${item.quantity}</span>
        <button onclick="updateQuantity('${item.priceId}', 1)" class="basket-qty-btn">+</button>
        <button onclick="removeFromBasket('${item.priceId}')" class="basket-remove" title="Remove">&#10005;</button>
      </div>
    </div>
  `).join('');

  const total = basket.reduce((sum, i) => sum + i.price * i.quantity, 0);
  if (totalEl) totalEl.textContent = `£${total.toFixed(2)}`;
  const btn = document.getElementById('basket-checkout-btn');
  if (btn) btn.disabled = false;
}

function openBasket() {
  document.getElementById('basket-drawer')?.classList.add('open');
  document.getElementById('basket-overlay')?.classList.add('open');
  renderBasketItems();
}

function closeBasket() {
  document.getElementById('basket-drawer')?.classList.remove('open');
  document.getElementById('basket-overlay')?.classList.remove('open');
}

async function checkout() {
  const basket = getBasket();
  if (basket.length === 0) return;

  const btn = document.getElementById('basket-checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Loading\u2026';

  try {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: basket.map(i => ({ priceId: i.priceId, quantity: i.quantity })) }),
    });
    const { url, warning } = await res.json();
    if (url) {
      if (warning && !confirm(warning + '\n\nContinue to checkout?')) {
        btn.disabled = false;
        btn.textContent = 'Checkout';
        return;
      }
      localStorage.removeItem('basket');
      window.location.href = url;
    } else {
      throw new Error('No URL');
    }
  } catch {
    alert('Something went wrong, please try again.');
    btn.disabled = false;
    btn.textContent = 'Checkout';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderBasketCount();
  document.getElementById('basket-overlay')?.addEventListener('click', closeBasket);
});
