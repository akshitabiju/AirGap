# AirGap demo script (target 2:30, hard stop 3:00)

Record screen at 1080p with the site open on the map page, scrolled to the hero. Speak slowly; the visuals carry the detail. Numbers in [brackets] come from the live site; read what it shows, not what's written here.

---

**0:00 – 0:20 · The gap** (hero on screen)

> India has about six hundred public PM2.5 monitors for one point four billion people. Most districts have none. So for most Indians, the answer to "how bad is the air today" is: nobody is checking.
>
> AirGap is a model that answers for them, with an error bar, and tells regulators where to put the next monitor.

**0:20 – 1:00 · The map** (click "Explore the live map"; press Play on the timeline and let 92 days roll; then switch to "Monitor gap", back to "PM2.5"; search "Ashoknagar" or any small town; click to pin)

> Every one of India's seven hundred thirty-five districts. Colour is the predicted twenty-four-hour PM2.5 on the CPCB bands, and this is the last ninety-two days playing back: watch the monsoon wash the north clean, then October start to close in.
>
> Switch the view and you see the actual problem: the darker the district, the farther it is from any monitor. Over half the country is more than fifty kilometres from one.
>
> This district has no monitor; the nearest is [118] kilometres away. We say [30], plus or minus [12]; that's about [1.4] cigarettes a day. The satellite model alone said [14]. The sparkline is its last three months.
>
> [If deployed:] When I pin it, the browser calls a Lambda function on AWS that fetches today's satellite and weather data for this exact point and runs the model live.

**0:55 – 1:40 · The proof** (navigate to Accuracy; pause on the four tiles, then the scatter)

> The question for any model like this is: how wrong is it where there's no monitor? So we don't do a random split. We hide whole cities, train on the rest, and predict the hidden ones cold, five times over.
>
> On cities it never saw, mean error is [10.2] micrograms. The raw satellite model we build on, Copernicus CAMS, scored on exactly the same days, is at [16.0]. That's a [36] percent improvement, we win every fold, and the error bars are calibrated: the sixty-eight percent interval covers [68] percent of real values.
>
> (scroll to per-city table) Every city, both numbers, no cherry-picking. Where we lose, you'd see a red cross.

**1:40 – 2:15 · Where to measure next** (navigate to Placement; hover sites 1 to 3)

> Then the useful part. Take every town over fifty thousand people with no monitor within twenty-five kilometres. Score each by people, by how unsure the model is there, and by how far the nearest monitor is. Pick greedily so they spread out.
>
> These twenty sites cover [N] people who today rely entirely on inference. Each one shows its reasoning. This is the list I'd hand a state pollution board.

**2:15 – 2:40 · How it's built** (Method page, scroll slowly; end on the architecture box)

> All open data: OpenAQ for ground truth, Copernicus CAMS and ERA5 through Open-Meteo for features, geoBoundaries for districts. One Python pipeline regenerates everything. LightGBM with leave-cities-out validation.
>
> On AWS: the site is static on S3 behind CloudFront, and the live prediction is a Lambda with a Function URL, a hundred-kilobyte package because the model is evaluated in pure Python.

**2:40 – 2:55 · Close** (back to the map)

> AirGap doesn't replace monitors. It tells you what the air is probably like where there isn't one, how much to trust that, and where the next monitor earns its keep. Thank you.

---

## Checklist before recording

- [ ] `python ml/run_all.py` finished with the full 571 stations; numbers on Accuracy match `public/data/metrics.json`
- [ ] Deployed URL loads over HTTPS; Lambda smoke test returns JSON
- [ ] Map renders within a few seconds (worker file present in `public/`)
- [ ] Search a town, pin a district, hover the scatter, hover a placement site: all respond
- [ ] Browser zoom 100 %, no dev tools, no bookmarks bar
