# AirGap · demo script (final, ~3:00)

Record on https://main.d3cvwqcst393r5.amplifyapp.com (hard-refresh first), full-screen Chrome (F11), Accuracy and Placement pages opened once beforehand, timeline on today, view on PM2.5, scrolled to top. Win+Alt+R to start and stop. One take; if you fumble, pause a beat and keep going.

Numbers in [brackets]: read what the screen shows that day. Check the Brahmapur card once before recording.

---

**0:00 · Hero. Hold still until the name.**

> Three hundred and sixty-eight districts in India have no public PM2.5 monitor within fifty kilometres. That's at least eighty-five million people in towns alone, plus all of rural India, who can't find out what they're breathing today, let alone when it's safe to send a child outside. So I built the answer for every one of those districts. This is AirGap.

**0:15 · Click "Check your air". Type "Brahmapur" in the search, pick it. Click "Child at home".**

> Take Brahmapur in Odisha. Three hundred and fifty thousand people, and the nearest air monitor is a hundred and forty-seven kilometres away. Until today, a parent there with an asthmatic kid had no number at all. Now there is one: [read it], with an error bar, and plain advice from CPCB's health guidance for a child: [read the advice title]. Breathing this all day is about [read it] cigarettes.

**0:40 · Point at the hourly bars. Click "Tomorrow", then "Today". Click "Share on WhatsApp", let the sheet appear, close it.**

> And the part that parent would use every morning: the cleanest and worst three hours today and tomorrow, so the kid plays outside at [cleanest window], not at [worst window]. One tap shares it to the school WhatsApp group with a link to the district. The next three days are forecast by the same model.

**1:00 · Tap हिंदी. Hold two seconds. Tap English.**

> And it speaks Hindi, because most of the people this is for don't read air-quality sites in English.

**1:07 · Click "Show on the map". Press Play, let it run about 8 seconds. Click "Monitor gap". Hold. Then click "PM2.5", scroll-zoom into Brahmapur until streets appear, hover a monitor dot.**

> Every district in the country. Press play and ninety-two days roll across India, into the forecast. (let it play) Now switch the view. The darker the district, the farther it is from any monitor. (slow down) Three hundred sixty-eight districts. Nobody measuring. Zoom in and it's a street-level map. The dots are real monitors coloured by what they measured; everything between them is inferred, and we say so. When a district is pinned, the browser calls a Lambda function on AWS that fetches today's satellite and weather data for that exact point and runs the model live.

**1:48 · Click "Accuracy". Pause on the four tiles for four seconds. Scroll to the scatter, then the per-city table.**

> How wrong is it where there's no monitor? We hide whole cities, train on the rest, and predict them cold, five times over. On cities it never saw, the mean error is 10.2 micrograms. The raw satellite model we build on, Copernicus CAMS, scored on the same days, is at 16. That's 36 percent lower, we win every fold, and the error bars are calibrated: the sixty-eight percent interval covers sixty-eight percent of real values. Every city, both numbers, no cherry-picking. Everything the model infers is labelled as inferred, with an error bar you can check.

**2:25 · Click "Next 20 monitors". Hover sites 1, 2, 3.**

> Then, for the people who decide where monitors go. Every town over fifty thousand with no monitor within twenty-five kilometres: 640 of them. Scored by people, by how unsure the model is, by distance to the nearest monitor, picked so they spread out. These twenty cover 3.85 million people. Number one: Brahmapur.

**2:42 · Click "Method & data". Scroll slowly to the architecture box. (Skip this segment if the take is running long.)**

> All open data: OpenAQ, Copernicus CAMS and ERA5 via Open-Meteo, geoBoundaries. One Python pipeline regenerates everything. LightGBM, leave-cities-out validation. Hosted on AWS: Amplify for the site, Lambda for live predictions.

**2:52 · Click "Map". Stay on the hero.**

> AirGap doesn't replace monitors. It tells the rest of India what to do today, shows its error, and says where the next monitor earns its keep. Thank you.

---

## Before recording

- [ ] Live site hard-refreshed; Brahmapur card checked so the bracketed numbers match
- [ ] Accuracy and Placement opened once so they're cached
- [ ] Timeline on today, view on PM2.5, scrolled to top
- [ ] Chrome full screen (F11), zoom 100 %, notifications off, phone on silent
- [ ] Mic enabled in Win+G settings

## After

- YouTube title: `AirGap: PM2.5, best hours and advice for every Indian district | Track 1 Air`
- Description: two lines on what it is, live link, GitHub link
