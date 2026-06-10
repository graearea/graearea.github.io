---
sitemap: false
---
<meta name="robots" content="noindex">

<div id="custom-work-content"></div>

<script>
(function () {
  const params = new URLSearchParams(window.location.search);
  const raw = parseFloat(params.get('amount'));
  const desc = params.get('for') || 'Custom Order';
  const el = document.getElementById('custom-work-content');

  if (!raw || isNaN(raw) || raw <= 0) {
    el.innerHTML = '<h1>Custom Work</h1><p>This page needs an amount in the URL — ask Uber Niche for the right link.</p>';
    return;
  }

  const pence = Math.round(raw * 100);
  const display = '£' + raw.toFixed(2);

  el.innerHTML =
    '<h1>Custom Work</h1>' +
    '<p>' + desc + ' &mdash; ' + display + '</p>' +
    '<button id="cw-btn">Add to basket &ndash; ' + display + '</button>';

  document.getElementById('cw-btn').addEventListener('click', function () {
    addToBasket('custom-work-' + pence, 'Custom Work', raw, desc);
  });
})();
</script>

{% include_relative delivery.md %}
