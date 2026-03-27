# Lap-belt Bung
![lapbelt-bung](img/lapbelt-bung.jpg)

A nice bung which covers the grot trap of an ugly lapbelt hole and is now printed out of Carbon-Fibre ASA.  

Have I got good news for you!

![cap-carbon](img/cap-carbon.jpg)

![cap-carbon](img/cap.jpg)

The threads have cuts to clear out grot as you screw it in. 
screw it gently in a couple of times to clear the thread then just tweak it up and don't overtighten it and it should stay where it is for years to come as the plastic is pretty solid. you can always loctite it if needed. 

£20 delivered

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER')">Buy – £20 delivered</button>

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
