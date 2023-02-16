# Self Cancelling Indicators

I totally HATE the indicating system on the Caterham. I was forever forgetting to stop the indicator and it was just a matter of time before somebody pulled out on me as they thought I was indicating to turn before them. 

so I had a bit of a think and came up with an idea. 

* an accelerometer to understand when cornering or not 
* some buttons on the wheel
* some logic for handling the on/off state
* an interface with the car

First off, I'm a software developer and so I know _just_ enough to be dangerous with technology. I knew nothing about electronics, hadn't ever used a microcontroller and didn't really know how to do any of this. all of my knowledge came from the ability to use google and youtube :D. 
my first prototype was a breadboard board with some buttons
![img.png](img/proto.jpeg)
this meant that I could proof-of-concept the integration of the buttons, accelerometer and the Tiny2040 microcontroller. this was about 50 lines of python at this point.

next was adding some buttons with LEDs in to get some feedback. then I had to think about where to put it all and power it. the original plan was the steering wheel but I realised pretty quickly that wouldn't work so the first cut was a box taped the dash connected to the wheel with loads of cables. it was pretty horrible but it proved it could work. connecting it to the car was the next hurdle. after a few false starts (lots of fuses blown) trying to use mosfets and transistors, my friend Timur brought a relay over, and we get it working for the first time. from there I replaced the relay with some micro relays with opto-couplers which totally disconnect the car from the electronics and packaged it all a bit better using a really nice maglock connector for the removable wheel.