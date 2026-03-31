-- ============================================================================
-- Migration : Plan de Formation — 5 nouvelles tables + ALTER courses
-- Compatible PostgreSQL 17
-- Généré le 2026-03-25
--
-- Ordre d'exécution :
--   1. CREATE TYPE (enums)
--   2. CREATE TABLE (ordre FK : plans → needs/actions → schedule → assignments)
--   3. ALTER TABLE courses
--   4. CREATE INDEX
--
-- NE PAS exécuter en production sans validation préalable.
-- Appliquer manuellement via CloudShell RDS.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

CREATE TYPE plan_level AS ENUM ('group', 'subsidiary', 'local');
CREATE TYPE plan_status AS ENUM ('draft', 'submitted', 'approved', 'active', 'closed');
CREATE TYPE need_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE need_status AS ENUM ('identified', 'planned', 'completed', 'cancelled');
CREATE TYPE target_type AS ENUM ('individual', 'job', 'level', 'department', 'group');
CREATE TYPE modality AS ENUM ('presentiel', 'distanciel', 'blended', 'elearning');
CREATE TYPE billing_mode AS ENUM ('per_participant', 'per_session', 'forfait');
CREATE TYPE quarter AS ENUM ('T1', 'T2', 'T3', 'T4');
CREATE TYPE schedule_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE assignment_status AS ENUM ('invited', 'confirmed', 'attended', 'absent', 'cancelled');


-- ============================================================================
-- 2. TABLE : training_plans
-- ============================================================================

CREATE TABLE training_plans (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL
                        REFERENCES tenants(id) ON DELETE CASCADE,
    parent_plan_id  INTEGER
                        REFERENCES training_plans(id) ON DELETE SET NULL,

    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    year            INTEGER NOT NULL,
    start_date      DATE,
    end_date        DATE,

    plan_level      plan_level NOT NULL DEFAULT 'local',
    status          plan_status NOT NULL DEFAULT 'draft',

    budget_ceiling  NUMERIC(15, 2),
    currency        VARCHAR(10) DEFAULT 'XOF',

    created_by_id   INTEGER
                        REFERENCES users(id),

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);


-- ============================================================================
-- 3. TABLE : training_needs
-- ============================================================================

CREATE TABLE training_needs (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL
                        REFERENCES tenants(id) ON DELETE CASCADE,

    plan_id         INTEGER NOT NULL
                        REFERENCES training_plans(id) ON DELETE CASCADE,
    employee_id     INTEGER NOT NULL
                        REFERENCES employees(id) ON DELETE CASCADE,

    source          VARCHAR[] ,  -- ARRAY de VARCHAR : 'OKR','Performance','Obligatoire','Manager','Employee'
    skill_target    VARCHAR(255),
    priority        need_priority NOT NULL DEFAULT 'medium',
    year            INTEGER,
    status          need_status NOT NULL DEFAULT 'identified',

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);


-- ============================================================================
-- 4. TABLE : training_plan_actions
-- ============================================================================

CREATE TABLE training_plan_actions (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL
                        REFERENCES tenants(id) ON DELETE CASCADE,

    plan_id         INTEGER NOT NULL
                        REFERENCES training_plans(id) ON DELETE CASCADE,
    course_id       INTEGER
                        REFERENCES courses(id) ON DELETE SET NULL,

    title           VARCHAR(255),  -- utilisé si pas de course lié
    target_type     target_type NOT NULL DEFAULT 'individual',
    target_id       INTEGER,

    is_mandatory    BOOLEAN NOT NULL DEFAULT FALSE,
    modality        modality NOT NULL DEFAULT 'presentiel',

    provider_id     INTEGER
                        REFERENCES training_providers(id) ON DELETE SET NULL,
    unit_cost       NUMERIC(15, 2),
    billing_mode    billing_mode,
    max_participants INTEGER,

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);


-- ============================================================================
-- 5. TABLE : training_schedule
-- ============================================================================

CREATE TABLE training_schedule (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL
                        REFERENCES tenants(id) ON DELETE CASCADE,

    plan_id         INTEGER NOT NULL
                        REFERENCES training_plans(id) ON DELETE CASCADE,
    action_id       INTEGER NOT NULL
                        REFERENCES training_plan_actions(id) ON DELETE CASCADE,

    start_date      DATE,
    end_date        DATE,
    quarter         quarter,
    status          schedule_status NOT NULL DEFAULT 'planned',

    location        VARCHAR(255),
    trainer_id      INTEGER
                        REFERENCES employees(id) ON DELETE SET NULL,
    external_trainer VARCHAR(255),
    max_participants INTEGER,

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);


-- ============================================================================
-- 6. TABLE : training_assignments
-- ============================================================================

CREATE TABLE training_assignments (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL
                        REFERENCES tenants(id) ON DELETE CASCADE,

    schedule_id     INTEGER NOT NULL
                        REFERENCES training_schedule(id) ON DELETE CASCADE,
    employee_id     INTEGER NOT NULL
                        REFERENCES employees(id) ON DELETE CASCADE,

    status          assignment_status NOT NULL DEFAULT 'invited',
    invitation_sent_at TIMESTAMPTZ,
    confirmation_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ
);


-- ============================================================================
-- 7. ALTER TABLE : courses (ajout unit_cost + billing_mode)
-- ============================================================================

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS unit_cost      NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS billing_mode   VARCHAR(20);  -- per_participant, per_session, forfait


-- ============================================================================
-- 8. INDEX — tenant_id (isolation multi-tenant)
-- ============================================================================

CREATE INDEX ix_training_plans_tenant_id
    ON training_plans(tenant_id);

CREATE INDEX ix_training_needs_tenant_id
    ON training_needs(tenant_id);

CREATE INDEX ix_training_plan_actions_tenant_id
    ON training_plan_actions(tenant_id);

CREATE INDEX ix_training_schedule_tenant_id
    ON training_schedule(tenant_id);

CREATE INDEX ix_training_assignments_tenant_id
    ON training_assignments(tenant_id);


-- ============================================================================
-- 9. INDEX — FK principales (accélération des JOIN)
-- ============================================================================

-- training_plans
CREATE INDEX ix_training_plans_parent_plan_id
    ON training_plans(parent_plan_id);

CREATE INDEX ix_training_plans_year
    ON training_plans(year);

CREATE INDEX ix_training_plans_created_by_id
    ON training_plans(created_by_id);

-- training_needs
CREATE INDEX ix_training_needs_plan_id
    ON training_needs(plan_id);

CREATE INDEX ix_training_needs_employee_id
    ON training_needs(employee_id);

CREATE INDEX ix_training_needs_dedup
    ON training_needs(employee_id, skill_target, year);

-- training_plan_actions
CREATE INDEX ix_training_plan_actions_plan_id
    ON training_plan_actions(plan_id);

CREATE INDEX ix_training_plan_actions_course_id
    ON training_plan_actions(course_id);

CREATE INDEX ix_training_plan_actions_provider_id
    ON training_plan_actions(provider_id);

-- training_schedule
CREATE INDEX ix_training_schedule_plan_id
    ON training_schedule(plan_id);

CREATE INDEX ix_training_schedule_action_id
    ON training_schedule(action_id);

CREATE INDEX ix_training_schedule_trainer_id
    ON training_schedule(trainer_id);

CREATE INDEX ix_training_schedule_quarter
    ON training_schedule(quarter);

-- training_assignments
CREATE INDEX ix_training_assignments_schedule_id
    ON training_assignments(schedule_id);

CREATE INDEX ix_training_assignments_employee_id
    ON training_assignments(employee_id);

CREATE INDEX ix_training_assignments_schedule_employee
    ON training_assignments(schedule_id, employee_id);


COMMIT;
