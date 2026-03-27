# Apple Magsafe Phone Mount
![magsafe-dash](img/magsafe-dash.jpg)
Apple Magsafe phone mount. attaches to the scuttle with M3 VHB tape. you don't need to use the poppet bolts. I have mine off-centre so that I can still use it with my aero screen (tested up to 80mph on the motorway). there are 2 versions, pivot and fixed. the pivot is slightly higher to clear the IVA trim if you still have it, the fixed will not.  

[Video here of what it looks like](https://youtu.be/33wN7WtJzs0)
Video here from the me sliding off at Oulton park and the mount holding on:

[![ROCK SOLID](img/code-brown.jpg)](https://youtu.be/33wN7WtJzs0)

£20 for fixed
£25 for swivel
£3 extra for non-black
£3 for p&p

I can probably supply a decent (non-apple branded) magsafe charger as well. ask about this.

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER_FIXED')">Buy Fixed – £20+P&P</button>
<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER_SWIVEL')">Buy Swivel – £25+P&P</button>

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