-- Specialist portfolio system: projects a freelancer showcases, their media,
-- and a view-event log used to notify the specialist when a client browses
-- their work. job_id is dropped to nullable first because notifyUser() is
-- already called without a jobId for non-job notification types (e.g.
-- freelancer_match), which has been silently failing against the NOT NULL
-- constraint -- portfolio_view notifications have the same shape.
ALTER TABLE notifications ALTER COLUMN job_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS portfolio_projects (
  id SERIAL PRIMARY KEY,
  specialist_clerk_id VARCHAR(255) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(120),
  skills TEXT,
  project_url VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_specialist
  ON portfolio_projects (specialist_clerk_id, sort_order);

CREATE TABLE IF NOT EXISTS portfolio_media (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES portfolio_projects(id) ON DELETE CASCADE,
  media_url VARCHAR(1000) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_media_project
  ON portfolio_media (project_id, sort_order);

-- viewer_clerk_id and project_id are nullable: a view can in principle be
-- anonymous (defensive, though every current caller is authenticated) and
-- can refer to the portfolio overview rather than one specific project.
CREATE TABLE IF NOT EXISTS portfolio_views (
  id SERIAL PRIMARY KEY,
  specialist_clerk_id VARCHAR(255) NOT NULL,
  viewer_clerk_id VARCHAR(255),
  project_id INTEGER REFERENCES portfolio_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_views_specialist_created
  ON portfolio_views (specialist_clerk_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_views_dedup
  ON portfolio_views (specialist_clerk_id, viewer_clerk_id, created_at DESC);
