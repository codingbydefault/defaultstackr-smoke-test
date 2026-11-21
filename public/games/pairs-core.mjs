// Memory matching game logic (classic memory-style). Pure and deterministic when
// a random function is injected.

export const SYMBOLS = 8;

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function newPairs(random = Math.random) {
  const deck = [];
  for (let symbol = 0; symbol < SYMBOLS; symbol += 1) {
    deck.push({ symbol, flipped: false, matched: false }, { symbol, flipped: false, matched: false });
  }
  return {
    cards: shuffle(deck, random),
    first: null,
    second: null,
    locked: false,
    moves: 0,
    matches: 0,
    score: 0,
    over: false
  };
}

export function flipCard(state, index) {
  if (state.over || state.locked) return { changed: false };
  const card = state.cards[index];
  if (!card || card.flipped || card.matched) return { changed: false };

  card.flipped = true;
  if (state.first === null) {
    state.first = index;
    return { changed: true };
  }

  state.second = index;
  state.moves += 1;
  const first = state.cards[state.first];
  if (first.symbol === card.symbol) {
    first.matched = true;
    card.matched = true;
    state.matches += 1;
    state.score += 10;
    state.first = null;
    state.second = null;
    return {
      changed: true,
      match: true,
      complete: state.matches === SYMBOLS
    };
  }

  state.locked = true;
  state.score = Math.max(0, state.score - 1);
  return { changed: true, match: false };
}

export function hideMismatch(state) {
  if (state.first === null || state.second === null) return;
  state.cards[state.first].flipped = false;
  state.cards[state.second].flipped = false;
  state.first = null;
  state.second = null;
  state.locked = false;
}

export function finishPairs(state) {
  state.over = true;
}
