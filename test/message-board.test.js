import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

class MemoryStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes('WHERE session_hash = ?')) {
      return this.database.rows.get(this.values[0]) || null;
    }
    return null;
  }

  async all() {
    return {
      results: [...this.database.rows.values()].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    };
  }

  async run() {
    const [sessionHash, name, email, message, createdAt, updatedAt] = this.values;
    const existing = this.database.rows.get(sessionHash);
    if (existing) {
      existing.name = name;
      existing.email = email;
      existing.message = message;
      existing.updated_at = updatedAt;
    } else {
      this.database.rows.set(sessionHash, {
        session_hash: sessionHash,
        name,
        email,
        message,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    }
    return { success: true };
  }
}

class MemoryD1 {
  constructor() {
    this.rows = new Map();
  }

  prepare(sql) {
    return new MemoryStatement(this, sql);
  }
}

function makeEnv() {
  return { CONFESSIONS_DB: new MemoryD1() };
}

function submission(body, cookie) {
  const headers = {
    origin: 'https://wall.example.test',
    'content-type': 'application/json',
  };
  if (cookie) headers.cookie = cookie;
  return new Request('https://wall.example.test/api/confessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ consent: true, ...body }),
  });
}

async function json(response) {
  return response.json();
}

test('a browser session creates one entry and later submissions update that row', async () => {
  const env = makeEnv();
  const first = await worker.fetch(
    submission({ name: 'Alex', email: 'alex@example.edu', message: 'Hello there.' }),
    env,
  );
  assert.equal(first.status, 200);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  assert.match(first.headers.get('set-cookie'), /HttpOnly/);
  assert.match(first.headers.get('set-cookie'), /Secure/);
  assert.match(cookie, /^__Host-confession-session=/);
  assert.equal(env.CONFESSIONS_DB.rows.size, 1);

  const update = await worker.fetch(
    submission({ name: 'Alex Lee', email: 'alex@example.edu', message: 'Updated note.' }, cookie),
    env,
  );
  assert.equal(update.status, 200);
  assert.equal(env.CONFESSIONS_DB.rows.size, 1);

  const mine = await worker.fetch(
    new Request('https://wall.example.test/api/confessions/mine', {
      headers: { cookie },
    }),
    env,
  );
  const ownRecord = (await json(mine)).confession;
  assert.equal(ownRecord.name, 'Alex Lee');
  assert.equal(ownRecord.email, 'alex@example.edu');
  assert.equal(ownRecord.message, 'Updated note.');
});

test('public wall never returns email addresses or session identifiers', async () => {
  const env = makeEnv();
  await worker.fetch(
    submission({ name: 'Morgan', email: 'morgan@example.edu', message: 'A public note.' }),
    env,
  );
  const response = await worker.fetch(
    new Request('https://wall.example.test/api/confessions'),
    env,
  );
  const data = await json(response);
  assert.equal(data.confessions.length, 1);
  assert.equal(data.confessions[0].name, 'Morgan');
  assert.equal(data.confessions[0].message, 'A public note.');
  assert.equal('email' in data.confessions[0], false);
  assert.equal('session_hash' in data.confessions[0], false);
});

test('separate browser sessions get separate rows', async () => {
  const env = makeEnv();
  const first = await worker.fetch(
    submission({ name: 'One', email: 'one@example.edu', message: 'First.' }),
    env,
  );
  const second = await worker.fetch(
    submission({ name: 'Two', email: 'two@example.edu', message: 'Second.' }),
    env,
  );
  assert.notEqual(first.headers.get('set-cookie'), second.headers.get('set-cookie'));
  assert.equal(env.CONFESSIONS_DB.rows.size, 2);
});

test('invalid submissions and cross-origin posts are rejected', async () => {
  const env = makeEnv();
  const invalid = await worker.fetch(
    submission({ name: ' ', email: 'not-an-email', message: '' }),
    env,
  );
  assert.equal(invalid.status, 400);
  assert.equal(env.CONFESSIONS_DB.rows.size, 0);

  const crossOrigin = new Request('https://wall.example.test/api/confessions', {
    method: 'POST',
    headers: {
      origin: 'https://attacker.example',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'Sam', email: 'sam@example.edu', message: 'Hello.' }),
  });
  const rejected = await worker.fetch(crossOrigin, env);
  assert.equal(rejected.status, 403);
  assert.equal(env.CONFESSIONS_DB.rows.size, 0);
});

test('the server rejects submissions without explicit public-display consent', async () => {
  const env = makeEnv();
  const response = await worker.fetch(
    submission({ name: 'Taylor', email: 'taylor@example.edu', message: 'A note.', consent: false }),
    env,
  );
  assert.equal(response.status, 400);
  assert.equal(env.CONFESSIONS_DB.rows.size, 0);
});
