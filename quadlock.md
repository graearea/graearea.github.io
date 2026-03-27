# Quadlock

![Quadlock Mount](img/v2-front.jpeg)
![Quadlock Mount](img/v2-back.jpeg)

* Original was a Collaboration with [Chris Leete](https://www.instagram.com/chrisl3ete/) on the design.
* V2 my redesign for easier and stronger printing.
* Printed in PLA to be tough and stiff.
* Slots for fitting a range of bolt dimensions in the scuttle panel and allowing rotation. they are around 57-69mm 
* Or blank (not winkie shaped slots, seriously Chris....) for using VHB tape (my preference).

Please be aware, solidly mounting phones to vehicles can damage them. I've heard of camera stabilisation being destroyed by attaching them to motorbikes. I do know Chris has been using his for a year. 

V2
£25 delivered +3 for non black colours

<button onclick="checkout(this, 'PRICE_ID_PLACEHOLDER')">Buy – £25 delivered</button>

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