-- Idempotent baseline; run only on defaultstackr_arcade as PostgreSQL administrator.
-- Requires previously created arcade_owner and arcade_app roles.
BEGIN;
SET LOCAL ROLE arcade_owner;
CREATE TABLE IF NOT EXISTS public.arcade_games(
  code text PRIMARY KEY, title text NOT NULL);
INSERT INTO public.arcade_games(code,title) VALUES
  ('snake','Snake'),('space_tetris','Space Tetris'),
  ('space_impact','Space Impact'),('bounce','Bounce'),
  ('pairs','Pairs'),('pole_position','Pole Position'),
  ('trap','Trap!'),('coaster_park','Coaster Park')
ON CONFLICT (code) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.arcade_players(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname varchar(24) NOT NULL,
  token_hash text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_nickname CHECK(length(btrim(nickname)) BETWEEN 2 AND 24)
);
CREATE TABLE IF NOT EXISTS public.arcade_sessions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.arcade_players(id),
  game_code text NOT NULL REFERENCES public.arcade_games(code),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.arcade_scores(
  session_id uuid PRIMARY KEY REFERENCES public.arcade_sessions(id),
  score bigint NOT NULL CHECK(score >= 0 AND score <= 1000000000),
  verified boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arcade_sessions_game_idx ON public.arcade_sessions(game_code);
CREATE OR REPLACE VIEW public.arcade_leaderboard AS
  SELECT s.game_code,p.id AS player_id,p.nickname,MAX(sc.score) AS best_score
  FROM public.arcade_scores sc
  JOIN public.arcade_sessions s ON s.id=sc.session_id
  JOIN public.arcade_players p ON p.id=s.player_id
  WHERE sc.verified=true
  GROUP BY s.game_code,p.id,p.nickname;
GRANT SELECT ON public.arcade_games TO arcade_app;
GRANT SELECT,INSERT,UPDATE ON public.arcade_players,public.arcade_sessions,public.arcade_scores TO arcade_app;
GRANT SELECT ON public.arcade_leaderboard TO arcade_app;
COMMIT;
