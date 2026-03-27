# Jamaican Bacon Clip
![plugs](img/bacon.jpg)

- Precision quick release clip for post-trail-line smashing or road-beer sipping
- Tested and proven to cope with riding Sheet trails and Sandwich trails
- Comes with a strip of VHB to stop it moving about laterally whilst 2 zipties take the weight
- Or can fit standard bottle cage mounts.
- Rear is curved to fit snugly to 34mm tube but will happily cope with BMX seattube or slightly bigger.
- Secure hold of your favourite 330ml/440ml drink (also Guinness cans but they are weird sized due to widget.)
- Any colour that I have the filament for, so just ask
- If you say "bacon" in a Jamaican accent ...

# How secure is it?
this is midair over sheet trails last jump which has a 6 foot takeoff:
![sheet](img/Beer%20can%20jump.jpg)
which is from this video:
<iframe width="560" height="315" src="https://www.youtube.com/embed/Dp522QPF-HY?si=Jwde1ShAq1-ExYmz" frameborder="0" allowfullscreen></iframe>

First time I finished the line, I smashed a beer! 

So decide:
- with or without bottle boss holes
- colour
- 330: £12 + £3 p&p
- 440: £14 + £3 p&p

discount for multiples (including delivery):
- 1=£15
- 2=£25
- 3=£33
- 4=£39

but you really don't need 4 :D (ridiculous maybe, but I needed to test them)
![too-many](img/too-many-beers.jpeg)

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER_330')">Buy 330ml – £15 delivered</button>
<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER_440')">Buy 440ml – £17 delivered</button>

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