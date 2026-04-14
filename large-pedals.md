---
description: "Wide 3D-printed pedal extension for easier heel-and-toe on Caterham S3 and SV chassis. Track-tested to 20,000 miles. From £45."
---
# Large Pedal Extension
![plugs](https://img.uberniche.co.uk/pedal-box-header.jpg)

## Pedal Extensions to improve heel-and-toeing and comfort
These are 3D printed extensions that fit into your Caterham's pedal to make it wider so that you can more easily "heel and toe". This is especially difficult in SV chassis cars where the gap can be up to 75mm.

The extensions are extended downwards and are wider which makes it easier to twist your foot to hit the accelerator pedal, especially whilst hard on your brake. They come in different sizes to bridge the gap between the your foot and accelerator.

I've done close to 20,000 miles including trips to the nurburgring, the alps and dozens of trackdays and drift days.

In my S3 chassis I have a 45mm gap in which I use a 10mm plug and in my size 8 driving boots, it's perfect. 35mm seems pretty good to me and is about 1/3 of the width of my foot.

To stop the pedal extensions rotating, they have a notch to increase the friction fit, but some loctite won't hurt

![large-pedal-back.jpg](https://img.uberniche.co.uk/large-pedal-back.jpg)
![large-pedal-front.jpg](https://img.uberniche.co.uk/large-pedal-front.jpg)

for an S3 chassis, I recommend a 10 or 15mm extension. for an SV chassis I'd recommend a 20 or 30 or something similar. put your foot on the brake pedal and judge the gap to your pedal.

## How much are they?
£45 + £4 P&P. Extra sizes £10 each — add as many as you like.

<div class="pedal-order">
  <label>Size: <select id="lp-size">
    <option value="price_1TM6p4Ahb23PF7gKVxwulQuX|10mm">10mm — S3 recommended</option>
    <option value="price_1TM6p4Ahb23PF7gKQmYSlRZx|15mm">15mm — S3 recommended</option>
    <option value="price_1TM6p5Ahb23PF7gKsFCdmo8x|20mm">20mm — SV recommended</option>
    <option value="price_1TM6p5Ahb23PF7gK1JOnUra5|30mm">30mm — SV recommended</option>
  </select></label>
  <button onclick="lpAdd()">Add to basket – £45 + £4 P&P</button>
</div>

<div class="pedal-order">
  <label>Extra size (+£10): <select id="lp-extra">
    <option value="">— none —</option>
    <option value="price_1TM6p6Ahb23PF7gKlH7Zv37e|10mm">10mm</option>
    <option value="price_1TM6p7Ahb23PF7gKvh8Dxj5c|15mm">15mm</option>
    <option value="price_1TM6p7Ahb23PF7gKskoM2Ub1|20mm">20mm</option>
    <option value="price_1TM6p8Ahb23PF7gKmhs1oQoR|30mm">30mm</option>
  </select></label>
  <button onclick="lpAddExtra()">Add extra size – £10</button>
</div>

<script>
function lpAdd() {
  const [id, label] = document.getElementById('lp-size').value.split('|');
  addToBasket(id, 'Large Pedal Extension', 45, label);
}
function lpAddExtra() {
  const val = document.getElementById('lp-extra').value;
  if (!val) return;
  const [id, label] = val.split('|');
  addToBasket(id, 'Large Pedal Extension — Extra Size', 10, label);
}
</script>

any problems email john@uberniche.co.uk

## Fitting
* Fit the cap into the right hand side of the pedal (gogo-gadget arms help here)
* fit the main part of the pedal to the left side, slide the bolt into it. 
* squeeze the pedal together and slide the bolt in. 
* tighten the bolt and it should pull the two halves together but don't tighten it yet.
* adjust the pedal angle so that you can push the pedal fully down and it isnt hitting the firewall
* tighten the bolt. once you hear cracking noises, stop. it should be very firmly fit now. if not, tighten some more.
* if it doesn't go together you could use something to squeeze it together like an irwin grip or big channel pliers. 
* if this doesn't work you may need to remove the pedal which isn't a difficult job but will add a good half hour. the pedals sometimes ovalise with use and need a mallet to get the plugs into it. if you damage a plug fitting it, just get in touch and I'll send you another. 

### FAQ
- How strong is it?
  - Strong enough. You're not driving a transit van in steel toecaps, you're wearing ballet shoes. they're printed with a honeycomb infill and 6 layers of PETG walls. tap them, they sound high-pitched cos they're so stiff. I've had no-one return one yet.
- What happens if it snaps and I crash my car
  - This product is used entirely at your own risk. again, it's not your brake pedal.
- I think it's rubbish, I want my money back.
  - OK, send it back, and I'll refund you.
- I want a custom colour.
  - OK. It'll cost you another £5
- I want a custom size width or height
  - get in touch
- I want to give you some feedback
  - please do! just email me at john@uberniche.co.uk I especially like pictures of customers pedals fitted and to know what size they fitted.

{% include_relative delivery.md %}