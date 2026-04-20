/**
 * Thin singleton wrapper around tdweb's TdClient.
 *
 * All communication with TDLib goes through `tg.send(request)`.
 * Updates are routed to the `onUpdate` callback registered at `init()`.
 */

let client = null

/**
 * @param {(update: object) => void} onUpdate
 * @returns {Promise<void>}
 */
export async function init(onUpdate) {
    if (client) return

    // tdweb workers + WASM are served at /tdweb/ by CopyPlugin
    const workerPath = window.location.origin + '/tdweb/tdweb.js'

    const { default: TdClient } = await import('tdweb')

    client = new TdClient({
        onUpdate,
        instanceName:    'messenger',
        jsVerbosity:     0,
        verbosity:       0,
        useDatabase:     true,
        readOnly:        false,
        isBackground:    false,
        mainWorkerPath:  workerPath,
    })
}

/** Send a TDLib request and return the response promise. */
export function send(req) {
    if (!client) return Promise.reject(new Error('TDLib not initialized'))
    return client.send(req)
}

/** True if the client has been created. */
export function isInitialized() { return !!client }

/** Destroy the client (logout). */
export function destroy() {
    if (client) { client.send({ '@type': 'close' }); client = null }
}
