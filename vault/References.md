# References

Locked Oct 17. The old gold-border, pixel-font game mocks are retired. Do not build from them.

## Direction

A tech product with pixel art inside it. Pixel art is only the characters and scenes. Everything else is a clean dark SaaS UI.

- Background `#0B0D12`, panels `#14161D` with a faint 1px border, corners 14-16px
- Inter for all text. No pixel fonts (logo excepted if wanted)
- One accent: a restrained technical blue `#5A8FE6` (violet dropped 2026-10-17). The welcome screen uses a white button with black text
- Sprites drawn with `image-rendering: pixelated` at integer scale

## Flow

| Step | Screen | Built from | Mock |
|---|---|---|---|
| 0 | Welcome | Landing-page hero: centered headline, one line, one button. Lab background | https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_143340_40a9aec9-c6ee-4be4-9cc8-1a7d468601f9.png (layout only, use the lab bg below) |
| 1 | Customize your lead | Avatar-editor layout: accordion left, option tiles middle, sprite on glowing pedestal right | https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_142554_de52c0d6-abaf-45c1-bc41-1590e7b786ba.png |
| 2 | Pick your team | "Choose your look": centered row of round avatar chips, multi-select with ring and check, one line describing the focused agent | https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_142555_44bb2a99-e931-406c-95d6-b863ab22a09c.png |
| 3 | Pick a scene and deploy | Three scene cards, bottom summary bar with squad avatars, files to be written, Deploy button | https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_142555_8dcd6961-763d-4a6d-87dd-5717eb1cd518.png |

Text inside mock images is often garbled. Copy layout and spacing, write the real copy in code.

Welcome copy:
- Headline: "Watch your AI team work."
- Sub: "Build a squad of Claude Code agents and see every move they make."
- Button: "Build your squad"
- Top left wordmark "agentsquad", top right link "Docs"

## Welcome background

Monochrome pixel lab, center left dark for the headline. Save as `web/public/art/scenes/welcome-bg.png`:
https://d8j0ntlcm91z4.cloudfront.net/user_3Hn0qEeIrzd8eKu5vKMg5oAY4ej/hf_20261017_143657_1bbcb905-64a5-4adb-94f6-2abd37fe7eb5.png

## Outside references

- Browserbase onboarding (clean card over pixel art): https://mobbin.com/screens/1b7915a3-d0dd-467f-8a29-211dadf76bcd
- SchoolAI "Choose your look": https://mobbin.com/screens/8d998578-98a2-44bc-9e9b-828b0dcba320
- Higgsfield character builder (three-panel editor): https://mobbin.com/screens/87514c14-6e1d-415f-bb72-5d8299c76c0a
- Calendly role step (step progress): https://mobbin.com/screens/1b1c4a66-365f-453f-8609-64c80055df2b

## Scenes and characters

All in `tools/art-sources.json`, pulled by `tools/fetch_art.py`. See `tools/ART.md`.

Scenes: UF Campus (map, buildings open the Library, Lab and Union interiors), Office, Club. Club dropped.

## UF inspiration

- Smathers Library: Collegiate Gothic, 1926, Grand Reading Room with a large mural. Keep any mural generic.
- Reitz Union: game room, esports center, food court, lounge.
- No UF logos or mascot anywhere.
