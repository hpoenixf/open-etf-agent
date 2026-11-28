// Fixed host-side profiles; no request can supply arbitrary parser limits.
export const UPLOADED_PDF_LIMITS=Object.freeze({bytes:1048576,pages:16,pageTextBytes:64000,totalTextBytes:131072});
export const LINKED_PDF_LIMITS=Object.freeze({bytes:8388608,pages:64,pageTextBytes:64000,totalTextBytes:393216});
