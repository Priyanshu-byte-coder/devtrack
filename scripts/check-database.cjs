// Runs against disposable PostgreSQL WASM; never connects to the configured live database.
const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");

const MIGRATIONS_DIR = "supabase/migrations";
const BASELINE = "20261011000000_canonical_schema.sql";
// Baseline tables plus those added by later migrations.
const EXPECTED_TABLES = 35;

/**
 * Migrations after the squashed baseline, in version order. schema.sql stays
 * byte-identical to the baseline (it has already been applied to production),
 * so new schema changes live only in these files.
 */
function laterMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f) && f > BASELINE)
    .sort()
    .map((f) => ({ name: f, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8") }));
}

/** The full current schema: the baseline, then every later migration in order. */
async function applySchema(db) {
  await db.exec(fs.readFileSync("supabase/schema.sql", "utf8"));
  for (const { sql } of laterMigrations()) await db.exec(sql);
}

async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';`);
  return db;
}
async function main() {
  const db = await createTestDatabase();
  try {
    const schema = fs.readFileSync("supabase/schema.sql", "utf8");
    const migration = fs.readFileSync(
      "supabase/migrations/20261011000000_canonical_schema.sql",
      "utf8"
    );
    assert.equal(
      schema,
      migration,
      "Bootstrap and baseline migration must match"
    );
    await db.exec(schema);
    await db.exec(schema);
    // Later migrations must also be safe to run twice.
    for (const { name, sql } of laterMigrations()) {
      await db.exec(sql);
      await db.exec(sql).catch((err) => {
        throw new Error(`${name} is not repeatable: ${err.message}`);
      });
    }
    const { rows: tables } = await db.query(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
    );
    assert.equal(tables.length, EXPECTED_TABLES);
    for (const table of tables) {
      assert.equal(
        table.rowsecurity,
        true,
        `${table.tablename}: RLS must be enabled`
      );
      const {
        rows: [grants],
      } = await db.query(
        `SELECT has_table_privilege('anon', $1, 'SELECT') AS anon_access,
        has_table_privilege('authenticated', $1, 'SELECT') AS browser_access`,
        [table.tablename]
      );
      assert.equal(grants.anon_access, false);
      assert.equal(grants.browser_access, false);
    }
    await db.exec(`INSERT INTO users(id, github_id, github_login) VALUES ('u1', '101', 'owner');
      INSERT INTO collaboration_rooms(id,name,repo_owner,repo_name,created_by) VALUES ('11111111-1111-1111-1111-111111111111','room','owner','repo','owner');
      INSERT INTO room_invitations(id,room_id,github_username,github_id,invited_by) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','member','202','owner');`);
    const respond = (id) =>
      db.query(
        `SELECT respond_to_room_invitation('22222222-2222-2222-2222-222222222222',$1,true) AS result`,
        [id]
      );
    assert.equal(
      (await respond("999")).rows[0].result,
      null,
      "Display name impersonation must not authorize an invite"
    );
    assert.equal((await respond("202")).rows[0].result.status, "accepted");
    assert.equal(
      (await respond("202")).rows[0].result,
      null,
      "Already accepted invitation cannot be replayed"
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS count FROM room_members"))
        .rows[0].count,
      1
    );
    await assert.rejects(
      db.exec(`SET ROLE anon; SELECT * FROM users;`),
      /permission denied/
    );
    await db.exec("RESET ROLE;");
    await db.exec(`INSERT INTO goals(id,user_id,title,target,current,recurrence,period_start) VALUES ('g1','u1','weekly',10,12,'weekly','2026-09-28');
      SELECT rollover_goals('u1','2026-10-11T12:00:00Z'); SELECT rollover_goals('u1','2026-10-11T12:00:00Z');`);
    const history = (
      await db.query("SELECT * FROM goal_history WHERE goal_id='g1'")
    ).rows;
    assert.equal(
      history.length,
      1,
      "Concurrent/repeated rollovers must not duplicate history"
    );
    assert.equal(history[0].achieved, 12);
    assert.equal(
      (await db.query("SELECT current FROM goals WHERE id='g1'")).rows[0]
        .current,
      0
    );
    await db.exec(`INSERT INTO users(id,github_id,github_login) VALUES ('u2','202','member');
      INSERT INTO room_members(room_id,github_username,github_id,role) VALUES ('11111111-1111-1111-1111-111111111111','owner','101','owner');
      INSERT INTO collaboration_rooms(id,name,repo_owner,repo_name,created_by) VALUES ('33333333-3333-3333-3333-333333333333','other','member','repo','member');
      INSERT INTO room_members(room_id,github_username,github_id,role) VALUES ('33333333-3333-3333-3333-333333333333','member','202','owner');
      INSERT INTO room_messages(room_id,sender_username,sender_github_id,content) VALUES ('33333333-3333-3333-3333-333333333333','old-handle','101','remove'),('33333333-3333-3333-3333-333333333333','member','202','keep');`);
    const deleteUser = (githubId) =>
      db.query("SELECT delete_app_user('u1',$1) AS deleted", [githubId]);
    assert.equal(
      (await deleteUser("202")).rows[0].deleted,
      false,
      "A different stable ID cannot delete this account"
    );
    await db.exec(`CREATE FUNCTION reject_test_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
      CREATE TRIGGER reject_deletion BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION reject_test_deletion();`);
    await assert.rejects(deleteUser("101"), /test failure/);
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM collaboration_rooms"))
        .rows[0].n,
      2,
      "Failed deletion rolls back the earlier room deletion"
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM room_messages")).rows[0]
        .n,
      2,
      "Failed deletion rolls back authored message removal"
    );
    await db.exec(
      "DROP TRIGGER reject_deletion ON users; DROP FUNCTION reject_test_deletion();"
    );
    assert.equal((await deleteUser("101")).rows[0].deleted, true);
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
      1
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM goals")).rows[0].n,
      0
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM goal_history")).rows[0].n,
      0
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM collaboration_rooms"))
        .rows[0].n,
      1
    );
    assert.equal(
      (await db.query("SELECT sender_github_id FROM room_messages")).rows[0]
        .sender_github_id,
      "202"
    );
    assert.equal(
      (
        await db.query(
          "SELECT has_function_privilege('anon', 'delete_app_user(text,text)', 'EXECUTE') AS allowed"
        )
      ).rows[0].allowed,
      false
    );
    console.log(
      `Database checks passed: repeatable ${EXPECTED_TABLES}-table bootstrap, RLS, browser grants, stable identity, atomic invitations, rollover and account deletion with rollback.`
    );
  } finally {
    await db.close();
  }
}
async function checkLegacyUpgrade() {
  const db = await createTestDatabase();
  try {
    const legacy = fs.readFileSync("supabase/legacy-schema.sql", "utf8");
    await db.exec(legacy);
    await db.exec(`INSERT INTO users(id,github_id,github_login) VALUES ('11111111-1111-1111-1111-111111111111','999','legacy');
    INSERT INTO goals(id,user_id,title,target,current) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','preserve',10,4);
    DROP TABLE goal_history; -- empty disposable fixture, emulate the older variant
    CREATE TABLE goal_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,goal_id uuid NOT NULL,period_start date NOT NULL,period_end date NOT NULL,target numeric NOT NULL,achieved numeric NOT NULL,completed boolean NOT NULL,created_at timestamptz DEFAULT now());
    INSERT INTO goal_history(user_id,goal_id,period_start,period_end,target,achieved,completed) VALUES('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','2026-09-01','2026-09-30',10,4,false);
    CREATE TABLE milestones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,title text NOT NULL,description text DEFAULT '',target_value integer NOT NULL,current_value integer DEFAULT 0,unit text DEFAULT 'units',target_date date NOT NULL,category text DEFAULT 'custom',created_at timestamptz DEFAULT now());
    INSERT INTO milestones(user_id,title,target_value,target_date) VALUES('11111111-1111-1111-1111-111111111111','preserve',10,'2026-12-01');`);
    await applySchema(db);
    await applySchema(db);
    assert.equal(
      (await db.query("SELECT achieved FROM goal_history")).rows[0].achieved,
      4
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM milestones")).rows[0].n,
      1
    );
    assert.equal(
      (await db.query("SELECT current FROM goals WHERE title='preserve'"))
        .rows[0].current,
      4
    );
    assert.equal(
      (
        await db.query(
          "SELECT data_type FROM information_schema.columns WHERE table_name='milestones' AND column_name='user_id'"
        )
      ).rows[0].data_type,
      "text"
    );
    console.log(
      "Legacy upgrade checks passed: existing users, goals, UUID history and milestones preserved."
    );
  } finally {
    await db.close();
  }
}
async function checkGamification() {
  const db = await createTestDatabase();
  try {
    await applySchema(db);
    const uid = "33333333-3333-3333-3333-333333333333";
    await db.exec(`INSERT INTO users(id,github_id,github_login) VALUES ('${uid}','777','player');
      INSERT INTO user_progress(user_id,xp,level,tier,best_tier,best_rank) VALUES ('${uid}',5000,12,'gold','gold',3);`);

    // Progress never regresses, even if a later update reports less.
    await db.exec(`UPDATE user_progress SET xp=100, level=2, tier='bronze', best_tier='bronze', best_rank=9 WHERE user_id='${uid}'`);
    let row = (await db.query(`SELECT * FROM user_progress WHERE user_id='${uid}'`)).rows[0];
    assert.equal(Number(row.xp), 5000, "xp must not decrease");
    assert.equal(row.level, 12, "level must not decrease");
    assert.equal(row.best_rank, 3, "best_rank keeps the best (lowest) rank");
    assert.equal(row.best_tier, "gold", "best_tier must not regress");
    assert.equal(row.tier, "bronze", "current tier may fall");

    // ...but it does move forward.
    await db.exec(`UPDATE user_progress SET xp=9000, level=18, best_tier='diamond', best_rank=1 WHERE user_id='${uid}'`);
    row = (await db.query(`SELECT * FROM user_progress WHERE user_id='${uid}'`)).rows[0];
    assert.equal(Number(row.xp), 9000);
    assert.equal(row.best_rank, 1);
    assert.equal(row.best_tier, "diamond");

    // Constraints reject impossible values.
    await assert.rejects(
      db.exec(`INSERT INTO leaderboard_snapshots(user_id,period,captured_on,rank,score_v2,tier) VALUES ('${uid}','week','2026-11-01',1,1001,'gold')`),
      "score_v2 above 1000 must be rejected"
    );
    await assert.rejects(
      db.exec(`INSERT INTO season_results(season,user_id,rank,score_v2,tier) VALUES ('2026-13','${uid}',1,500,'gold')`),
      "an invalid season month must be rejected"
    );

    // Deleting the account removes every gamification row.
    await db.exec(`INSERT INTO leaderboard_snapshots(user_id,period,captured_on,rank,score_v2,tier) VALUES ('${uid}','week','2026-11-01',1,640,'platinum');
      INSERT INTO season_results(season,user_id,rank,score_v2,tier) VALUES ('2026-10','${uid}',1,640,'platinum');`);
    await db.query("SELECT delete_app_user($1,$2)", [uid, "777"]);
    for (const table of ["user_progress", "leaderboard_snapshots", "season_results"]) {
      const { rows } = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE user_id=$1`, [uid]);
      assert.equal(rows[0].n, 0, `${table} rows must be removed with the account`);
    }
    console.log(
      "Gamification checks passed: progress never regresses, constraints hold, account deletion cascades."
    );
  } finally {
    await db.close();
  }
}

module.exports = { createTestDatabase, applySchema, laterMigrations };
if (require.main === module)
  main()
    .then(checkLegacyUpgrade)
    .then(checkGamification)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
