# AirGap · 3-minute demo script

Presenter: Akshita Biju. Target 2:45, hard stop 3:00. About 430 words; speak at a relaxed pace and let the visuals breathe.
Record the screen at 1080p (Windows: Win+Alt+R, or OBS). Browser at 100 % zoom, no bookmarks bar. Start on the home page, scrolled to the top, timeline on "today".

Numbers in [brackets] are what the site shows on the day of recording; read what's on screen.

---

### 0:00 – 0:25 · The gap (hero on screen, let the haze and particles move)

> Hi, I'm Akshita Biju, and this is AirGap.
>
> India has around 570 public PM2.5 monitors for one point four billion people. Most of our 735 districts have none. So for most Indians, the honest answer to "how bad is the air today" is: nobody is measuring.
>
> AirGap answers for them: a model that estimates PM2.5 for every district, proves how accurate it is, and tells regulators where the next monitor should go.

### 0:25 – 0:50 · My Air (scroll to "Your air"; click "Use my location" or search your town; click "Asthma / heart / 60+")

> It starts with a person. Tell it where you are and who you are; this stays on your device. It finds your district, gives today's estimate with an error bar, and says in plain language what to do, following CPCB's own health advisories. And a number everyone understands: breathing this all day is about [1.4] cigarettes.

### 0:50 – 1:30 · The map (click "Show on the map"; press Play on the timeline; then switch view to "Monitor gap"; back to "PM2.5"; zoom into your district so streets appear; hover a monitor dot)

> Here is every district. Colour is the predicted twenty-four-hour PM2.5. Press play and the last ninety-two days roll across the country: the monsoon keeps the north clean, then October begins to close in.
>
> Switch the view and you see the real problem. The darker the district, the farther it is from any monitor. 368 districts, half the country, are more than fifty kilometres from one.
>
> Zoom in and it's a full street-level map. The dots are the actual monitors, coloured by what they measured; everything between them is inferred, and labelled as inferred.
>
> [If AWS is deployed:] When I pin a district, the browser calls a Lambda function on AWS that fetches today's satellite and weather data for that exact point and runs the model live.

### 1:30 – 2:10 · Accuracy (navigate to Accuracy; pause on the four tiles; scroll to the scatter and the per-city table)

> Any model like this has to answer one question: how wrong is it where there is no monitor? So we don't do a random split. We hide whole cities, train on the rest, and predict the hidden ones cold, five times over.
>
> On cities it never saw, the mean error is [10.2] micrograms. The raw satellite model we build on, Copernicus CAMS, scored on exactly the same days, is at [16.0]. That's 36 percent lower error, we win every fold, and the error bars are calibrated: the sixty-eight percent interval covers [68] percent of real values.
>
> Every city, both numbers, no cherry-picking.

### 2:10 – 2:35 · Next 20 monitors (navigate to "Next 20 monitors"; hover sites 1 to 3)

> Then the useful part. Take every town over fifty thousand people with no monitor within twenty-five kilometres: 640 of them. Score each by people, by how unsure the model is there, and by how far the nearest monitor is. Pick greedily so they spread out.
>
> These twenty sites cover [3.85 million] people who today rely entirely on inference. Number one is Brahmapur, 147 kilometres from the nearest monitor. This is the list I'd hand a state pollution board.

### 2:35 – 2:55 · How it's built (Method page, scroll slowly; end on the architecture box)

> All open data: OpenAQ for ground truth, Copernicus CAMS and ERA5 through Open-Meteo for features, geoBoundaries for districts. One Python pipeline regenerates everything; LightGBM with leave-cities-out validation. The site is static on S3 behind CloudFront, and the live prediction is an AWS Lambda with a Function URL.

### 2:55 – 3:00 · Close (back to the map)

> AirGap doesn't replace monitors. It tells you what the air is probably like where there isn't one, how much to trust that, and where the next monitor earns its keep. Thank you.

---

## Checklist before recording

- [ ] `python ml/run_all.py` has run today; numbers on Accuracy match `public/data/metrics.json`
- [ ] Deployed URL loads over HTTPS and the Lambda panel appears when a district is pinned (or skip that line)
- [ ] Map renders within a few seconds; timeline Play works; view switch works; zoom shows streets and monitor popups
- [ ] "Use my location" permission already granted in the browser (or use search)
- [ ] Browser zoom 100 %, no dev tools, no bookmarks bar, notifications off
