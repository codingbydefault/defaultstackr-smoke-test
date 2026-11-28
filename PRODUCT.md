# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual retro-gamers on mobile and desktop who want to pick up a classic LCD-era game in seconds. The arcade also serves as a showcase/portfolio piece for what can be built and shipped with DefaultStackr.

## Product Purpose

A playable retro LCD arcade with eight games and a shared global leaderboard. Success means a visitor lands, immediately understands the eight games, starts one with a single tap, and sees their nickname and score on the worldwide ranking.

## Positioning

A curated eight-game LCD-era arcade wrapped in a deep-space mission deck, with one nickname and one leaderboard identity shared across every game. It is not a generic game portal or a storefront.

## Operating Context

Runs in the browser. Mobile-first with swipe and on-screen controls; desktop uses arrow keys, Space/Enter and P. The leaderboard is optional and backed by PostgreSQL; without a database the games remain playable and scores stay local. The interface language is Dutch.

## Capabilities and Constraints

- Eight games: Snake, Space Tetris, Space Impact, Bounce, Pairs, Pole Position, Trap!, Coaster Park.
- Shared nickname + browser token identifies a player across games; no accounts and no payments.
- Highscores are submitted after a run and ranked worldwide per game.
- Local best scores are kept in `localStorage`; the global leaderboard requires `ARCADE_DATABASE_URL`.
- Score validation is basic (session duration and score bounds); this is not cheat-proof competitive infrastructure.
- Dutch UI copy throughout.

## Brand Commitments

- Name: DefaultStackr Arcade · Deep Space Edition.
- Voice: Dutch, retro-arcade, mission/space theme, playful but not childish.
- Visual vibe the user explicitly asked to keep: deep-space violet/purple backdrop, green LCD screens, pixel-art game cards and a physical handheld-console feel.

## Evidence on Hand

Eight implemented games, a working leaderboard API and migration, and an existing deep-space visual system in `public/`. There are no real testimonials, press, customer logos or benchmark claims; future work must not invent them.

## Product Principles

1. Pick up and play in seconds: the game grid is the first useful screen.
2. One identity across all eight games: nickname, token and ranking follow the player.
3. Retro LCD authenticity beats generic modern game UI.
4. The arcade is the showcase; every screen should feel deliberately crafted, not templated.
5. Degrade gracefully: the games stay playable when the leaderboard is unavailable.

## Accessibility & Inclusion

Touch and keyboard input are both first-class. The existing stylesheet honors `prefers-reduced-motion`. Focus states and readable contrast must be preserved.
