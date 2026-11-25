# Dealcheck

A Claude Code plugin that tells you whether a startup idea, or a business you want to buy, is worth it.

Give it an idea or a listing link. Claude researches the market on the web and scores it on ten factors: urgency, market size, pricing potential, acquisition cost, delivery cost, uniqueness, speed, upfront investment, upsell potential and evergreen potential. Every score has a reason and a source link. The report opens in a pane beside the chat.

## Install

**Full plugin, with the pane (Claude Code).** In a Claude Code terminal session:

```
/plugin install dealcheck --marketplace vsheshjain/dealcheck
```

Answer `y` to add the marketplace, then pick the **user** scope to have it in every project. Run it as `/dealcheck:dealcheck`.

**Skill only, any agent (no pane).** The skill is one file, `skills/dealcheck/SKILL.md`, in the open Agent Skills format. Install it globally for the agents you use:

```
URL=https://raw.githubusercontent.com/vsheshjain/dealcheck/main/skills/dealcheck/SKILL.md

# Claude Code (Cursor also loads skills from this folder)
mkdir -p ~/.claude/skills/dealcheck && curl -fsSL $URL -o ~/.claude/skills/dealcheck/SKILL.md

# Codex, Gemini CLI and GitHub Copilot CLI (one shared folder)
mkdir -p ~/.agents/skills/dealcheck && curl -fsSL $URL -o ~/.agents/skills/dealcheck/SKILL.md
```

Or use the [skills](https://github.com/vercel-labs/skills) installer, which knows the folders of many agents:

```
npx skills add vsheshjain/dealcheck -g
```

Restart the agent, then run `/dealcheck` or ask it to "dealcheck" an idea or a listing. Without the pane, the report comes back in the chat as a table.

## Use

```
/dealcheck:dealcheck A Chrome extension that schedules LinkedIn posts for agencies
/dealcheck:dealcheck https://trustmrr.com/startup/some-startup
/dealcheck:dealcheck https://acquire.com/startup/...
```

With the skill-only install, use `/dealcheck` instead. Claude decides whether you gave it an **idea** or a **business for sale** and adjusts two factors to match:

- **Speed:** for an idea, how fast you can ship something to sell; for a business, how fast a new owner can improve it.
- **Upfront investment:** for an idea, the cost to launch; for a business, whether the asking price is fair compared with similar deals.

A check runs 10 to 25 web lookups and takes a few minutes.

## What you see

While Claude researches, the pane lists each search it runs. When it finishes, the pane shows the report:

```
PostPilot (example)
45/100  Walk away  · acquisition

Walk away unless it's very cheap. Few customers, no proven acquisition
channel and strong free competition from big design platforms.

███░░░░░░░  3 Urgency · medium
Making social posts faster is nice to have; cheaper substitutes exist.
↳ Leading design tools bundle AI features for about $15/month
███████░░░  7 Market size · medium
AI social media tools are a multi-billion-dollar market growing 20–30% a year.
↳ AI in social media market estimated at several billion dollars in 2026
...

Red flags
• Only a dozen paying subscribers after about 18 months.
• The founder says they are moving on.

Ask the seller
• What is the asking price, and would you take part as an earn-out?
• Can I see Stripe MRR, churn and refunds month by month?

[p] Older   [n] Newer   1 of 3
```

Each `↳` line links to its source. In the chat, Claude replies with one short paragraph.

| Score | For an idea | For a business |
|---|---|---|
| Under 50 | Drop it | Walk away |
| 50 to 75 | Test before building | Negotiate with care |
| Over 75 | Worth building | Promising buy |

A 0 on any one factor can sink it on its own, so the pane flags it.

Past reports stay in the pane for the session; press `p` and `n` to page through them. In a terminal narrower than about 110 columns, the pane waits until you widen the window.

## How it works

The plugin is a skill plus a Claude Code mod (`hooks/register.tsx`). It adds:

- the `dealcheck` skill (`skills/dealcheck/SKILL.md`), which holds the research brief and starts the check as soon as you run `/dealcheck:dealcheck`;
- a `submit_report` tool, which checks the report has all ten factors, adds up the total and stores it;
- the Dealcheck pane, which draws the progress and the report.

Research uses Claude Code's own web search and runs on your Claude account. Nothing is sent anywhere else.

## Develop

```
claude --plugin-dir .
claude plugin validate .
claude plugin test .
```

## Credits

The ten factors come from "10 Ways to Evaluate a Market" in
[The Personal MBA](https://personalmba.com/10-ways-to-evaluate-a-market/)
by Josh Kaufman. Dealcheck is an independent project, not affiliated with him.

## Disclaimer

AI research can be wrong. This is not financial or legal advice. Verify before you build or buy.

## License

MIT
