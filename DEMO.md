# AirGap · 3-minute demo script (final)

Presenter: Akshita Biju. About 2:45 at a calm pace. Record on https://main.d3cvwqcst393r5.amplifyapp.com
in full-screen Chrome (F11), location permission already granted, Accuracy and Placement pages opened once beforehand.
Timeline on "today", view on "PM2.5", scrolled to the top. Win+Alt+R to start and stop. One take; if you fumble, pause a beat and keep going.

Numbers in [brackets]: read what the screen shows.

---

**0:00 · Hero. Hold still for the first line.**

> I'm Akshita Biju. This is AirGap: today's air, the best hours to go out, and what to do about it, for every district in India, including the ones with no monitor. Let me show you.

**0:08 · Click "Check your air". Click "Use my location". Click "Asthma / heart / 60+".**

> Where are you, who are you. It stays on your device. It finds your district, gives today's number with an error bar, and plain advice from CPCB's health guidance. A number everyone understands: breathing this all day is about [read it] cigarettes.

**0:30 · Point at the hourly bars. Click "Tomorrow", then "Today". Click "Share on WhatsApp", let the share sheet appear, close it.**

> This is the part you'd use every morning: the cleanest and the worst three hours, today and tomorrow. So a parent knows to send the kids out after lunch, not for morning sports. One tap shares it on WhatsApp with a link to your district. The next three days are forecast by the same model.

**0:52 · Tap हिंदी. Hold two seconds. Tap English.**

> And it speaks Hindi, because most of the people this is for don't read air-quality sites in English.

**1:00 · Click "Show on the map". Press Play. Let it run about 8 seconds. Click "Monitor gap". Wait 3 seconds. Click "PM2.5". Scroll-zoom into your district until streets appear. Hover a monitor dot.**

> Every district in the country. Press play and ninety-two days roll across India, into the forecast. (pause while it plays) Now switch the view. The darker the district, the farther it is from any monitor. (hold here, slow) Three hundred sixty-eight districts. Nobody measuring. Zoom in and it's a street-level map. The dots are real monitors coloured by what they measured; everything between them is inferred, and we say so. When a district is pinned, the browser calls a Lambda function on AWS that fetches today's satellite and weather data for that exact point and runs the model live.

**1:40 · Click "Accuracy". Pause on the four tiles for four seconds. Scroll to the scatter, then the per-city table.**

> How wrong is it where there's no monitor? We hide whole cities, train on the rest, and predict them cold, five times over. On cities it never saw, the mean error is 10.2 micrograms. The raw satellite model we build on, Copernicus CAMS, scored on the same days, is at 16. That's 36 percent lower, we win every fold, and the error bars are calibrated: the sixty-eight percent interval covers sixty-eight percent of real values. Every city, both numbers, no cherry-picking. Everything the model infers is labelled as inferred, with an error bar you can check.

**2:15 · Click "Next 20 monitors". Hover sites 1, 2, 3.**

> Then, for the people who decide where monitors go. Every town over fifty thousand with no monitor within twenty-five kilometres: 640 of them. Scored by people, by how unsure the model is, by distance to the nearest monitor, picked so they spread out. These twenty cover 3.85 million people. Number one: Brahmapur, 147 kilometres from a monitor.

**2:32 · Click "Method & data". Scroll slowly to the architecture box.**

> All open data: OpenAQ, Copernicus CAMS and ERA5 via Open-Meteo, geoBoundaries. One Python pipeline regenerates everything. LightGBM, leave-cities-out validation. Hosted on AWS: Amplify for the site, Lambda for live predictions.

**2:42 · Click "Map". Stay on the hero.**

> AirGap doesn't replace monitors. It tells the rest of India what to do today, shows its error, and says where the next monitor earns its keep. Thank you.

---

## Before recording

- [ ] Live site loads; "Use my location" works without a prompt
- [ ] Accuracy and Placement pages opened once so they're cached
- [ ] Timeline on today, view on PM2.5, scrolled to top
- [ ] Chrome full screen (F11), zoom 100 %, notifications off, phone on silent
- [ ] Mic enabled in Win+G settings

## After

- YouTube title: `AirGap: PM2.5, best hours and advice for every Indian district | MakeDevs Track 1 Air`
- Description: two lines on what it is, live link, GitHub link, your name
