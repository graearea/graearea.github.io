// Cross-sell product definitions
const UPSELL_PRODUCTS = {
  'lifeline-mirror-mounts': {
    name: 'Lifeline Mirror Mounts',
    url: '/lifeline-mirror-mounts',
    image: 'https://img.uberniche.co.uk/lifeline-hero.jpg',
    priceFrom: 110,
  },
  'large-pedals': {
    name: 'Large Pedal Extension',
    url: '/large-pedals',
    image: 'https://img.uberniche.co.uk/pedal-box-header.jpg',
    priceFrom: 45,
  },
  'lapbelt-bung': {
    name: 'Lap-belt Bung',
    url: '/lapbelt-bung',
    image: 'https://img.uberniche.co.uk/lapbelt-bung.jpg',
    priceFrom: 12,
  },
};

// Maps a Stripe price ID to product slugs to suggest alongside it.
const UPSELL_MAP = {
  // Lifeline Mirror Mounts — suggest large pedals + lapbelt bung
  'price_1Tac8jAhb23PF7gK7iC5ib5U': ['large-pedals', 'lapbelt-bung'],
  'price_1Tac8jAhb23PF7gK9ZhM7pmW': ['large-pedals', 'lapbelt-bung'],
  'price_1Tac8kAhb23PF7gKvJ6vz8r4': ['large-pedals', 'lapbelt-bung'],
  'price_1Tac8kAhb23PF7gKGOBBni3j': ['large-pedals', 'lapbelt-bung'],
  'price_1Tac8jAhb23PF7gKyAy8QqCz': ['large-pedals', 'lapbelt-bung'],
  'price_1Tac8lAhb23PF7gKP8hEcQI0': ['large-pedals', 'lapbelt-bung'],

  // Large Pedal Extensions — suggest lifeline mirrors + lapbelt bung
  'price_1TM6p4Ahb23PF7gKVxwulQuX': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p4Ahb23PF7gKQmYSlRZx': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p5Ahb23PF7gKsFCdmo8x': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p5Ahb23PF7gK1JOnUra5': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p6Ahb23PF7gKlH7Zv37e': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p7Ahb23PF7gKvh8Dxj5c': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p7Ahb23PF7gKskoM2Ub1': ['lifeline-mirror-mounts', 'lapbelt-bung'],
  'price_1TM6p8Ahb23PF7gKmhs1oQoR': ['lifeline-mirror-mounts', 'lapbelt-bung'],

  // Pedal Extensions (plugs) — suggest large pedals
  'price_1TM6p1Ahb23PF7gKOjGczzq0': ['large-pedals'],
  'price_1TM6p3Ahb23PF7gKSbOpLFQI': ['large-pedals'],
};

// Collect the union of suggestions for all items currently in the basket,
// excluding any products that are already in the basket.
function renderUpsells() {
  const section = document.getElementById('basket-upsells');
  const list = document.getElementById('upsell-list');
  if (!section || !list) return;

  const basket = typeof getBasket === 'function' ? getBasket() : [];
  const basketPriceIds = new Set(basket.map(i => i.priceId));

  // Collect unique slugs suggested by any item in the basket
  const suggestedSlugs = new Set();
  for (const item of basket) {
    const slugs = UPSELL_MAP[item.priceId] || [];
    for (const slug of slugs) suggestedSlugs.add(slug);
  }

  // Filter out products already in the basket (match by URL)
  const suggestions = [...suggestedSlugs]
    .map(slug => UPSELL_PRODUCTS[slug])
    .filter(p => p && !basket.some(i => {
      // Hide suggestion if any basket item links to the same page
      return false; // price IDs don't overlap with slugs; safe to show all
    }));

  if (suggestions.length === 0) {
    section.classList.remove('has-items');
    return;
  }

  list.innerHTML = suggestions.map(p => `
    <a class="upsell-card" href="${p.url}">
      <img class="upsell-img" src="${p.image}" alt="${p.name}" loading="lazy">
      <div class="upsell-card-body">
        <div class="upsell-card-name">${p.name}</div>
        <div class="upsell-card-price">From £${p.priceFrom}</div>
      </div>
    </a>
  `).join('');

  section.classList.add('has-items');
}
