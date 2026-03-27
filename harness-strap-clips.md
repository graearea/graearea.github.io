# Harness-Strap clips
![clip](img/multicolour-strap.jpeg)

Do your harness straps flap about in the wind and annoy you? They certainly annoyed my friend Colin, so he asked me to make these!
![clip folded](img/fold-clip.jpeg) 

I can also print them in multiple colours (not all shown here) in ABS. +3 quid for non-black 
![side clip](img/chest-strap.jpeg)

They tightly fit the standard Caterham (Luke?) 3" harness top straps. They are designed with arms that pinch the straps and with teeth in the arms that will hold nice and tight.

£30 for 2 pairs + £3 p+p (+£3 for different colours)

<button onclick="checkout(this, 'price_1SPU67Ahb23PF7gKUp5OYxAd')">Buy – £25+P&P</button>

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

please note, the finish of this has to be flat as pictured, not carbon-fibre effect.  

{% include_relative delivery.md %}
