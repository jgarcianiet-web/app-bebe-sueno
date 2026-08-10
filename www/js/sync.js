/**
 * Sincronización familiar.
 *
 * Guarda una copia compartida de los datos en jsonblob.com (almacén JSON
 * gratuito y anónimo). Cada familia tiene un documento identificado por un
 * código aleatorio imposible de adivinar; quien tiene el código puede leer
 * y escribir, así que solo debe compartirse con la familia.
 *
 * El almacén remoto es un complemento: los datos siempre viven también en
 * el dispositivo (localStorage), de modo que si el servicio no está
 * disponible la app sigue funcionando y se sincroniza más tarde.
 */

const SYNC_API_BASE = "https://jsonblob.com/api/jsonBlob";

async function syncCreateRemote(doc) {
  const res = await fetch(SYNC_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(doc)
  });
  if (!res.ok) throw new Error(`No se pudo crear el documento compartido (HTTP ${res.status})`);
  const location = res.headers.get("Location") || res.headers.get("location");
  if (!location) throw new Error("El servicio no devolvió el identificador del documento");
  const id = location.split("/").pop();
  if (!id) throw new Error("Identificador de documento no válido");
  return id;
}

async function syncFetchRemote(id) {
  const res = await fetch(`${SYNC_API_BASE}/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" }
  });
  if (res.status === 404) {
    const err = new Error("El documento compartido ya no existe");
    err.notFound = true;
    throw err;
  }
  if (!res.ok) throw new Error(`No se pudo leer el documento compartido (HTTP ${res.status})`);
  return res.json();
}

async function syncPushRemote(id, doc) {
  const res = await fetch(`${SYNC_API_BASE}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(doc)
  });
  if (res.status === 404) {
    const err = new Error("El documento compartido ya no existe");
    err.notFound = true;
    throw err;
  }
  if (!res.ok) throw new Error(`No se pudo guardar el documento compartido (HTTP ${res.status})`);
}

/**
 * Combina el estado local y el remoto sin perder registros de ninguno:
 * - sesiones y tomas: unión por id, descartando las borradas en cualquiera
 *   de los dos lados (lista de tombstones `deleted`)
 * - perfil y recordatorio: gana el que se haya modificado más recientemente
 */
function mergeStates(local, remote) {
  const deleted = [...new Set([...(local.deleted || []), ...(remote.deleted || [])])];
  const deletedSet = new Set(deleted);

  function mergeRecords(a, b) {
    const byId = new Map();
    for (const r of [...(a || []), ...(b || [])]) {
      if (r && r.id && !deletedSet.has(r.id)) byId.set(r.id, r);
    }
    return [...byId.values()];
  }

  const localBaby = local.baby || {};
  const remoteBaby = remote.baby || {};
  const localReminder = local.reminder || {};
  const remoteReminder = remote.reminder || {};

  return {
    baby: (remoteBaby.updatedAt || 0) > (localBaby.updatedAt || 0) ? remoteBaby : localBaby,
    reminder:
      (remoteReminder.updatedAt || 0) > (localReminder.updatedAt || 0)
        ? remoteReminder
        : localReminder,
    sessions: mergeRecords(local.sessions, remote.sessions),
    feedings: mergeRecords(local.feedings, remote.feedings),
    deleted
  };
}

function buildSharedDoc(state) {
  return {
    v: 1,
    baby: state.baby,
    reminder: state.reminder,
    sessions: state.sessions,
    feedings: state.feedings,
    deleted: state.deleted || [],
    updatedAt: Date.now()
  };
}
