# Welcome2 Manifesto Authored Rhythm (Step 0)

Date: 2026-02-07
Scope: Step 0 only (authored rhythm markers in `MANIFESTO_TEXT`), no typing engine, no audio, no behavior changes.

## Source Location

- `MANIFESTO_TEXT` lives in `src/screens/Welcome2.tsx`.
- It is rendered directly in the welcome2 manifesto block (`id="welcome2-manifesto-text"`).

## Markers Inserted

Marker grammar used:
- `{p=220}` short beat
- `{p=900}` long breath / paragraph beat

Exact insertions:
1. `For me, i often feel tired reading paper at 2 am.{p=220}`
Reason: short landing after the opening statement.

2. `I think text is not the most intuitive form of knowledge.{p=900}`
Reason: long breath before transition to the next paragraph.

3. `We have been reading text for more than 50 years.{p=220}`
Reason: short beat after the historical framing line.

4. `One that fit our mind well. One that fit natural nerve in our thought.{p=900}`
Reason: long breath before the final line.

## Rendered Text Preview (Markers Removed)

This is the expected rendered copy after the future typing system strips markers:

For me, i often feel tired reading paper at 2 am.
I think text is not the most intuitive form of knowledge.

We have been reading text for more than 50 years.
If we want to process information intuitively, i think we need to create a new form of information medium for ourselves.
One that fit our mind well. One that fit natural nerve in our thought.

I think it is time for us to think differently.

## Verification Notes

- Wording and meaning of the manifesto copy were not rewritten.
- Only inline pause markers were added.
- No typing logic, parser, cadence config, or audio code was added in this step.
