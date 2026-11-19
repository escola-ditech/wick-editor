/**
 * Stores .wick files in the signed in user's account using Firestore.
 *
 * Layout:
 *   users/{uid}/projects/{projectId}                  -> { name, size, updatedAt, saveId, chunkCount }
 *   users/{uid}/projects/{projectId}/chunks/{saveId_i} -> { saveId, index, data }
 *
 * A Firestore document can't be larger than 1 MiB, so the file is split into chunks.
 * Every save writes its chunks under a new saveId and only then points the project
 * document at them, so a save that fails halfway never corrupts the previous one.
 */

import {
  Bytes,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';

const CHUNK_SIZE = 900 * 1024;
const PARALLEL_WRITES = 4;

// Limits per account. firestore.rules enforces the same project size and name length.
export const MAX_PROJECT_SIZE = 50 * 1024 * 1024;
export const MAX_PROJECTS = 50;
const MAX_NAME_LENGTH = 200;

function limitError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function projectsCollection(uid) {
  return collection(db, 'users', uid, 'projects');
}

function projectDoc(uid, projectId) {
  return doc(db, 'users', uid, 'projects', projectId);
}

function chunkDoc(uid, projectId, saveId, index) {
  return doc(db, 'users', uid, 'projects', projectId, 'chunks', saveId + '_' + index);
}

/**
 * Runs the tasks a few at a time.
 * @param {function[]} tasks Functions returning promises.
 */
async function runLimited(tasks) {
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      await tasks[next++]();
    }
  }
  await Promise.all(Array.from({ length: PARALLEL_WRITES }, worker));
}

/**
 * Creates an id for a project that was never saved to the user's account.
 * @param {string} uid User id.
 * @returns {string}
 */
export function newCloudProjectId(uid) {
  return doc(projectsCollection(uid)).id;
}

/**
 * Saves a .wick file to the user's account, replacing any previous save with the same id.
 * Fails with an error with code 'project-too-large' or 'too-many-projects' if a limit is hit.
 * @param {string} uid User id.
 * @param {string} projectId Id to save under, from newCloudProjectId or from a listed project.
 * @param {string} name Project name.
 * @param {Blob} file The .wick file.
 */
export async function saveCloudProject(uid, projectId, name, file) {
  if (file.size > MAX_PROJECT_SIZE) {
    throw limitError('project-too-large', 'Project is too large to be saved.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const saveId = Date.now().toString(36);
  const chunkCount = Math.max(1, Math.ceil(bytes.length / CHUNK_SIZE));

  const previous = (await getDoc(projectDoc(uid, projectId))).data();

  if (!previous) {
    const saved = (await getCountFromServer(projectsCollection(uid))).data().count;
    if (saved >= MAX_PROJECTS) {
      throw limitError('too-many-projects', 'The account has too many saved projects.');
    }
  }

  const writes = [];
  for (let i = 0; i < chunkCount; i++) {
    const data = bytes.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    writes.push(() => setDoc(chunkDoc(uid, projectId, saveId, i), {
      saveId,
      index: i,
      data: Bytes.fromUint8Array(data),
    }));
  }
  await runLimited(writes);

  await setDoc(projectDoc(uid, projectId), {
    name: String(name).slice(0, MAX_NAME_LENGTH),
    size: bytes.length,
    updatedAt: serverTimestamp(),
    saveId,
    chunkCount,
  });

  // The new save is in place, the chunks of the previous one are no longer needed.
  if (previous && previous.saveId !== saveId) {
    const deletes = [];
    for (let i = 0; i < previous.chunkCount; i++) {
      deletes.push(() => deleteDoc(chunkDoc(uid, projectId, previous.saveId, i)));
    }
    await runLimited(deletes).catch(e => console.warn('Could not remove old save data.', e));
  }
}

/**
 * Lists the projects saved in the user's account, most recent first.
 * @param {string} uid User id.
 * @returns {Promise<object[]>} Entries with { cloud, id, name, size, date }.
 */
export async function listCloudProjects(uid) {
  const snapshot = await getDocs(query(projectsCollection(uid), orderBy('updatedAt', 'desc')));
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      cloud: true,
      id: d.id,
      name: data.name,
      size: data.size,
      date: data.updatedAt ? data.updatedAt.toDate() : null,
    };
  });
}

/**
 * Downloads a project saved in the user's account.
 * @param {string} uid User id.
 * @param {string} projectId Id of the project.
 * @returns {Promise<File>} The .wick file.
 */
export async function loadCloudProject(uid, projectId) {
  const project = (await getDoc(projectDoc(uid, projectId))).data();
  if (!project) {
    throw new Error('Project not found.');
  }

  const chunksQuery = query(
    collection(projectDoc(uid, projectId), 'chunks'),
    where('saveId', '==', project.saveId)
  );
  const chunks = (await getDocs(chunksQuery)).docs
    .map(d => d.data())
    .sort((a, b) => a.index - b.index);

  if (chunks.length !== project.chunkCount) {
    throw new Error('Project data is incomplete.');
  }

  return new File(
    chunks.map(chunk => chunk.data.toUint8Array()),
    project.name + '.wick',
    { type: 'application/wick' }
  );
}

/**
 * Deletes a project from the user's account.
 * @param {string} uid User id.
 * @param {string} projectId Id of the project.
 */
export async function deleteCloudProject(uid, projectId) {
  const chunks = await getDocs(collection(projectDoc(uid, projectId), 'chunks'));
  await runLimited(chunks.docs.map(d => () => deleteDoc(d.ref)));
  await deleteDoc(projectDoc(uid, projectId));
}
