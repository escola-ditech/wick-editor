// Tests saving projects to a user's account, and the rules in firestore.rules,
// against the Firestore emulator. Run with: npm run test:cloud

import { readFileSync } from 'fs';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Bytes, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import {
  MAX_PROJECTS,
  MAX_PROJECT_SIZE,
  deleteCloudProject,
  listCloudProjects,
  loadCloudProject,
  newCloudProjectId,
  saveCloudProject,
} from './cloudProjects';

// The functions under test use the database exported by ./firebase. Here it is
// replaced by a database of the emulator, signed in as the user set by actAs.
const current = vi.hoisted(() => ({ db: null }));
vi.mock('./firebase', () => ({
  get db() {
    return current.db;
  },
}));

// These tests need the Firestore emulator, so they are skipped in a plain `npm test`.
const withEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

const ALICE = 'alice';
const BOB = 'bob';

let testEnv;

/** Makes the functions under test act as the given signed in user (or as nobody). */
function actAs(uid) {
  const context = uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext();
  const db = context.firestore();
  current.db = db;
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

/** A project document that the rules accept. */
function validProject() {
  return { name: 'Ok', size: 10, updatedAt: serverTimestamp(), saveId: 's1', chunkCount: 1 };
}

/** Creates a project the way the rules require: together with the count of projects of the account. */
function createCounted(db, uid, projectId, projectCount) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'projects', projectId), validProject());
  batch.set(doc(db, 'users', uid), { projectCount, lastProjectId: projectId });
  return batch.commit();
}

async function accountCount(db, uid) {
  const account = (await getDoc(doc(db, 'users', uid))).data();
  return account ? account.projectCount : undefined;
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

withEmulator('project count', () => {
  test('saving and deleting keep the count of the account up to date', async () => {
    const db = actAs(ALICE);
    const first = newCloudProjectId(ALICE);
    const second = newCloudProjectId(ALICE);

    await saveCloudProject(ALICE, first, 'One', new Blob([makeBytes(10, 20)]));
    await saveCloudProject(ALICE, second, 'Two', new Blob([makeBytes(10, 21)]));
    await saveCloudProject(ALICE, first, 'One again', new Blob([makeBytes(10, 22)]));
    expect(await accountCount(db, ALICE)).toBe(2);

    await deleteCloudProject(ALICE, first);
    expect(await accountCount(db, ALICE)).toBe(1);

    // Deleting a project that is already gone changes nothing.
    await deleteCloudProject(ALICE, first);
    expect(await accountCount(db, ALICE)).toBe(1);
  });

  test('a project cannot be created or deleted without counting it', async () => {
    const db = actAs(ALICE);
    const project = (id) => doc(db, 'users', ALICE, 'projects', id);

    await assertFails(setDoc(project('p1'), validProject()));
    await assertSucceeds(createCounted(db, ALICE, 'p1', 1));
    await assertFails(deleteDoc(project('p1')));

    // Counting more or less than the one project that was created is refused.
    await assertFails(createCounted(db, ALICE, 'p2', 1));
    await assertFails(createCounted(db, ALICE, 'p2', 3));
    await assertSucceeds(createCounted(db, ALICE, 'p2', 2));
  });

  test('the count cannot be changed on its own', async () => {
    const db = actAs(ALICE);
    const account = doc(db, 'users', ALICE);
    await createCounted(db, ALICE, 'p1', 1);
    await createCounted(db, ALICE, 'p2', 2);

    await assertFails(setDoc(account, { projectCount: 0, lastProjectId: 'p1' }));
    await assertFails(setDoc(account, { projectCount: 1, lastProjectId: 'p1' }));
    await assertFails(setDoc(account, { projectCount: 3, lastProjectId: 'p3' }));
    await assertFails(deleteDoc(account));
    expect(await accountCount(db, ALICE)).toBe(2);
  });

  test('the rules refuse a project above the limit, even if the editor is bypassed', async () => {
    const db = actAs(ALICE);
    for (let i = 1; i <= MAX_PROJECTS; i++) {
      await createCounted(db, ALICE, 'p' + i, i);
    }

    await assertFails(createCounted(db, ALICE, 'extra', MAX_PROJECTS + 1));
    await assertFails(createCounted(db, ALICE, 'extra', MAX_PROJECTS));
  });

  test('projects saved before the count existed can still be saved, opened and deleted', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'users', ALICE, 'projects', 'old1'), { ...validProject(), size: 3 });
      await setDoc(doc(admin, 'users', ALICE, 'projects', 'old1', 'chunks', 's1_0'), {
        saveId: 's1', index: 0, data: Bytes.fromUint8Array(makeBytes(3, 23)),
      });
      await setDoc(doc(admin, 'users', ALICE, 'projects', 'old2'), validProject());
    });
    const db = actAs(ALICE);

    expect((await loadCloudProject(ALICE, 'old1')).size).toBe(3);
    await saveCloudProject(ALICE, 'old1', 'Old, saved again', new Blob([makeBytes(5, 24)]));
    expect(await accountCount(db, ALICE)).toBeUndefined();

    // A new project starts the count. Deleting the old ones then never takes it below zero.
    const created = newCloudProjectId(ALICE);
    await saveCloudProject(ALICE, created, 'New', new Blob([makeBytes(5, 25)]));
    await deleteCloudProject(ALICE, 'old1');
    await deleteCloudProject(ALICE, 'old2');
    expect(await accountCount(db, ALICE)).toBe(0);
    await deleteCloudProject(ALICE, created);

    expect(await listCloudProjects(ALICE)).toHaveLength(0);
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
    const valid = validProject();

    await assertSucceeds(createCounted(db, ALICE, 'p1', 1));
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
