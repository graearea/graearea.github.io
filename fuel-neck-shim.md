Fuel Filler Neck Shims
![fuel-shim.jpeg](img/fuel-shim.jpeg)

my fuel filler neck is not quite angled correctly and it warps the skin around it which makes it look a mess.
![img/warped.jpeg](img/warped.jpeg)

so I created some wedge shaped shims which are 2,4,6mm wide at one edge and 0.2mm at the other. these can then adjust the edge 2-12mm outwards to fix the misaligned fuel filler cap.
they fit between the filler neck and the rear skin and so can't be seen and the rubber seal should still seal the filler cap. 

on my car, the end result is much better (yes, it desperately needs a clean):
![img/fixed.jpg](img/fixed.jpg)

£25 +£3 p+p

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