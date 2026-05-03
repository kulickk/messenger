import { useState, useEffect, useRef } from 'react';

/**
 * Downloads a TDLib File and returns an object-URL for it.
 * Handles the case where the file is already downloaded.
 * Cleans up the blob URL on unmount.
 */
export function useTDLibFile(file, td, mimeType = 'image/jpeg') {
    const [url, setUrl] = useState(null);
    const urlRef = useRef(null);

    useEffect(() => {
        if (!file || !td) return;

        const makeBlobUrl = (bytes) => {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            urlRef.current = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
            setUrl(urlRef.current);
        };

        // Already on disk?
        if (file.local?.is_downloading_completed && file.local.path) {
            const bytes = td.readFileBytes(file.local.path);
            if (bytes) makeBlobUrl(bytes);
            return;
        }

        // Request download; result arrives via updateFile
        td.downloadFile(file.id, 1).catch(() => {});

        const handler = (update) => {
            if (update['@type'] !== 'updateFile' || update.file.id !== file.id) return;
            const f = update.file;
            if (f.local?.is_downloading_completed && f.local.path) {
                const bytes = td.readFileBytes(f.local.path);
                if (bytes) makeBlobUrl(bytes);
            }
        };
        td.on('update', handler);
        return () => td.off('update', handler);
    }, [file?.id, td, mimeType]);

    // Revoke on unmount
    useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

    return url;
}
