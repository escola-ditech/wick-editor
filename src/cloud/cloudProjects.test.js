/**
 * @jest-environment node
 */

// Tests saving projects to a user's account, and the rules in firestore.rules,
// against the Firestore emulator. Run with: npm run test:cloud

// The test environment hides the globals of newer Node versions that the Firebase
// SDK needs (streams, Blob, File...), so they are copied in before it is loaded.
// This is also why the modules below are loaded with require instead of import.
const nodeGlobals = require('vm').runInThisContext('globalThis');
for (const name of Object.getOwnPropertyNames(nodeGlobals)) {
  if (name in global) continue;
  try {
    global[name] = nodeGlobals[name];
  } catch (e) {
    // Not available in this Node version.
  }
}

const { readFileSync } = require('fs');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const { Bytes, collection, doc, getDocs, serverTimestamp, setDoc } = require('firebase/firestore');
const {
  MAX_PROJECTS,
  MAX_PROJECT_SIZE,
  deleteCloudProject,
  listCloudProjects,
  loadCloudProject,
  newCloudProjectId,
  saveCloudProject,
} = require('./cloudProjects');

jest.mock('./firebase', () => ({ __esModule: true, db: null }));

// These tests need the Firestore emulator, so they are skipped in a plain `npm test`.
const withEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

jest.setTimeout(60000);

const ALICE = 'alice';
const BOB = 'bob';

let testEnv;

/** Makes the functions under test act as the given signed in user (or as nobody). */
function actAs(uid) {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  const db = context.firestore();
  jest.requireMock('./firebase').db = db;
  return db;
}

/** Creates file contents that are easy to tell apart. */
function makeBytes(length, seed) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = (i * 31 + seed) % 251;
  }
  return bytes;
}

async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

async function countChunks(db, uid, projectId) {
  return (await getDocs(collection(db, 'users', uid, 'projects', projectId, 'chunks'))).size;
}

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-wick-editor',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  testEnv && await testEnv.cleanup();
});

beforeEach(async () => {
  testEnv && await testEnv.clearFirestore();
});

withEmulator('saving and opening', () => {
  test('a small project comes back identical', async () => {
    actAs(ALICE);
    const bytes = makeBytes(1234, 1);
    const id = newCloudProjectId(ALICE);

    await saveCloudProject(ALICE, id, 'My Project', new Blob([bytes]));
    const file = await loadCloudProject(ALICE, id);

    expect(file.name).toBe('My Project.wick');
    expect(Buffer.from(await readBytes(file)).equals(Buffer.from(bytes))).toBe(true);
  });

  test('a project larger than one document is split and comes back identical', async () => {
    const db = actAs(ALICE);
    const bytes = makeBytes(2.5 * 1024 * 1024, 2);
    const id = newCloudProjectId(ALICE);

    await saveCloudProject(ALICE, id, 'Big', new Blob([bytes]));

    expect(await countChunks(db, ALICE, id)).toBe(3);
    const file = await loadCloudProject(ALICE, id);
    expect(Buffer.from(await readBytes(file)).equals(Buffer.from(bytes))).toBe(true);
  });

  test('an empty file can be saved', async () => {
    actAs(ALICE);
    const id = newCloudProjectId(ALICE);

    await saveCloudProject(ALICE, id, 'Empty', new Blob([]));

    expect((await loadCloudProject(ALICE, id)).size).toBe(0);
  });

  test('saving again replaces the project and leaves no old data behind', async () => {
    const db = actAs(ALICE);
    const id = newCloudProjectId(ALICE);
    const second = makeBytes(500, 4);

    await saveCloudProject(ALICE, id, 'First name', new Blob([makeBytes(2 * 1024 * 1024, 3)]));
    // Saves are told apart by the time they were made.
    await new Promise(resolve => setTimeout(resolve, 5));
    await saveCloudProject(ALICE, id, 'Second name', new Blob([second]));

    const projects = await listCloudProjects(ALICE);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ cloud: true, id, name: 'Second name', size: 500 });
    expect(projects[0].date).toBeInstanceOf(Date);
    expect(await countChunks(db, ALICE, id)).toBe(1);

    const file = await loadCloudProject(ALICE, id);
    expect(Buffer.from(await readBytes(file)).equals(Buffer.from(second))).toBe(true);
  });

  test('projects with the same name are kept apart by id', async () => {
    actAs(ALICE);
    const first = newCloudProjectId(ALICE);
    const second = newCloudProjectId(ALICE);

    await saveCloudProject(ALICE, first, 'Same', new Blob([makeBytes(10, 5)]));
    await saveCloudProject(ALICE, second, 'Same', new Blob([makeBytes(20, 6)]));

    expect(first).not.toBe(second);
    expect(await listCloudProjects(ALICE)).toHaveLength(2);
    expect((await loadCloudProject(ALICE, first)).size).toBe(10);
    expect((await loadCloudProject(ALICE, second)).size).toBe(20);
  });

  test('deleting removes the project and its data', async () => {
    const db = actAs(ALICE);
    const id = newCloudProjectId(ALICE);
    await saveCloudProject(ALICE, id, 'Gone', new Blob([makeBytes(2 * 1024 * 1024, 7)]));

    await deleteCloudProject(ALICE, id);

    expect(await listCloudProjects(ALICE)).toHaveLength(0);
    expect(await countChunks(db, ALICE, id)).toBe(0);
    await expect(loadCloudProject(ALICE, id)).rejects.toThrow('Project not found.');
  });

  test('long names are cut to the allowed length', async () => {
    actAs(ALICE);
    const id = newCloudProjectId(ALICE);

    await saveCloudProject(ALICE, id, 'x'.repeat(500), new Blob([makeBytes(10, 8)]));

    expect((await listCloudProjects(ALICE))[0].name).toHaveLength(200);
  });
});

withEmulator('limits', () => {
  test('a project above the size limit is refused before anything is uploaded', async () => {
    const db = actAs(ALICE);
    const id = newCloudProjectId(ALICE);
    const tooLarge = { size: MAX_PROJECT_SIZE + 1, arrayBuffer: () => { throw new Error('should not be read'); } };

    await expect(saveCloudProject(ALICE, id, 'Huge', tooLarge)).rejects.toMatchObject({ code: 'project-too-large' });
    expect(await countChunks(db, ALICE, id)).toBe(0);
  });

  test('a new project is refused when the account is full, but existing ones can still be saved', async () => {
    actAs(ALICE);
    const ids = [];
    for (let i = 0; i < MAX_PROJECTS; i++) {
      ids.push(newCloudProjectId(ALICE));
      await saveCloudProject(ALICE, ids[i], 'Project ' + i, new Blob([makeBytes(10, i)]));
    }

    await expect(
      saveCloudProject(ALICE, newCloudProjectId(ALICE), 'One too many', new Blob([makeBytes(10, 9)]))
    ).rejects.toMatchObject({ code: 'too-many-projects' });

    await saveCloudProject(ALICE, ids[0], 'Project 0 again', new Blob([makeBytes(10, 10)]));
    expect(await listCloudProjects(ALICE)).toHaveLength(MAX_PROJECTS);
  });
});

withEmulator('access rules', () => {
  test('a user cannot list, open, replace or delete the projects of another user', async () => {
    actAs(ALICE);
    const id = newCloudProjectId(ALICE);
    const original = makeBytes(100, 11);
    await saveCloudProject(ALICE, id, 'Private', new Blob([original]));

    actAs(BOB);
    await assertFails(listCloudProjects(ALICE));
    await assertFails(loadCloudProject(ALICE, id));
    await assertFails(saveCloudProject(ALICE, id, 'Stolen', new Blob([makeBytes(10, 12)])));
    await assertFails(deleteCloudProject(ALICE, id));

    actAs(ALICE);
    const file = await loadCloudProject(ALICE, id);
    expect(Buffer.from(await readBytes(file)).equals(Buffer.from(original))).toBe(true);
  });

  test('someone who is not signed in cannot read or write', async () => {
    actAs(ALICE);
    const id = newCloudProjectId(ALICE);
    await saveCloudProject(ALICE, id, 'Private', new Blob([makeBytes(100, 13)]));

    actAs(null);
    await assertFails(listCloudProjects(ALICE));
    await assertFails(loadCloudProject(ALICE, id));
    await assertFails(saveCloudProject(ALICE, id, 'Anonymous', new Blob([makeBytes(10, 14)])));
  });

  test('documents outside the projects of a user cannot be written', async () => {
    const db = actAs(ALICE);

    await assertFails(setDoc(doc(db, 'users', ALICE), { admin: true }));
    await assertFails(setDoc(doc(db, 'users', ALICE, 'other', 'thing'), { a: 1 }));
    await assertFails(setDoc(doc(db, 'anything', 'else'), { a: 1 }));
  });

  test('project documents with an unexpected shape are refused', async () => {
    const db = actAs(ALICE);
    const project = doc(db, 'users', ALICE, 'projects', 'p1');
    const valid = { name: 'Ok', size: 10, updatedAt: serverTimestamp(), saveId: 's1', chunkCount: 1 };

    await assertSucceeds(setDoc(project, valid));
    await assertFails(setDoc(project, { ...valid, extra: 'field' }));
    await assertFails(setDoc(project, { ...valid, name: 'x'.repeat(201) }));
    await assertFails(setDoc(project, { ...valid, size: MAX_PROJECT_SIZE + 1 }));
    await assertFails(setDoc(project, { ...valid, chunkCount: 61 }));
    await assertFails(setDoc(project, { ...valid, updatedAt: new Date(0) }));
    await assertFails(setDoc(project, { name: 'Missing fields' }));
  });

  test('chunk documents with an unexpected shape or size are refused', async () => {
    const db = actAs(ALICE);
    const chunk = (id) => doc(db, 'users', ALICE, 'projects', 'p1', 'chunks', id);
    const data = Bytes.fromUint8Array(makeBytes(10, 15));

    await assertSucceeds(setDoc(chunk('s1_0'), { saveId: 's1', index: 0, data }));
    await assertFails(setDoc(chunk('other'), { saveId: 's1', index: 0, data }));
    await assertFails(setDoc(chunk('s1_60'), { saveId: 's1', index: 60, data }));
    await assertFails(setDoc(chunk('s1_1'), { saveId: 's1', index: 1, data, extra: true }));
    await assertFails(setDoc(chunk('s1_2'), { saveId: 's1', index: 2, data: 'not bytes' }));
    await assertFails(setDoc(chunk('s1_3'), {
      saveId: 's1',
      index: 3,
      data: Bytes.fromUint8Array(makeBytes(921601, 16)),
    }));
  });
});
