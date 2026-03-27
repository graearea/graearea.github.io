## Darth Schrader:
_"I find your lack of dust-caps disturbing"_
<br/>
I HATE dust caps that you have to screw on your fingers get filthy so I just chuck em. These are push fit so miiiiiiiles better and
![darth](img/darth.webp)<br/>
£12

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER')">Buy – £12</button>

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
