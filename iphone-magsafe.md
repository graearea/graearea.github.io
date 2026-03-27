# Magsafe Phone Mount for iPhone

![maglock-dash](img/magsafe-dash.jpeg)
 it uses 3M VHB tape to fix to the scuttle. this can be removed cleanly using dental floss, but otherwise it is going nowhere.

[Video here of what it looks like](https://youtu.be/bOc9bqDt7ds)
Video here from the Karussell. if that doesn't make your phone drop off, nothing will. click on it:

[![ROCK SOLID](https://img.youtube.com/vi/1NCZ1FxKUE0/0.jpg)](https://youtu.be/1NCZ1FxKUE0)

£25 +£3 p+p +3 for non-black colours

![maglock](img/maglock.jpeg)

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER')">Buy – £25+P&P</button>

<script>
async function checkout(btn, priceId) {
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = 'Loading...';
  const res = await fetch('https://autumn-bread-f290.uber-niche-parts.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId })
  });
  const { url } = await res.json();
  if (url) {
    window.location.href = url;
  } else {
    alert('Something went wrong, please try again.');
    btn.disabled = false;
    btn.textContent = orig;
  }
}
</script>

{% include_relative delivery.md %}