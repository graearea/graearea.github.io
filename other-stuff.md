# Aeroscreen Stuff

delivery for all these things is £3, so if you've ordered something else, p&p is included

## Increased friction fit for spa mirrors
from 0.00005mm^2 contact
![cup](img/no-cup.jpeg)<br/>
to 10000m^2 contact (lol)
![no-cup](img/cup.jpeg)<br/>
These fit into the crappy Spa and Motamec sockets to increase friction and adjustability<br/>
£15 inc delivery or free with any of my mirror mounts

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER_FRICTION_CUPS')">Buy friction cups – £15 delivered</button>

## Curved shims for Aero Screen mirrors
![gaskets](img/gasket.jpeg)<br/>
![gaskets](img/three-gaskets.jpeg)<br/>
Fitting flat metal mirror brackets to a curved screen doesn't work without putting undue stress on the screen. A selection of these shims relieves that stress. available in black or white<br/>
2 pairs in different curved profiles<br/>
I can make them with the curve lengthways like in the photos, or widthways (be sure to mention which you want)
£15 inc delivery

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER_SHIMS')">Buy curved shims – £15 delivered</button>

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