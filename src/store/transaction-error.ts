/**
 * Status codes the Firestore backend uses for a transaction that was aborted
 * because of concurrent modification. GAXIOS may report the same abort as the
 * HTTP `409` conflict status.
 */
const abortedStatusCodes = [ 10, 409 ]

/** `INVALID_ARGUMENT` carrying this message means the transaction id expired. */
const expiredTransactionMessage = /transaction has expired/i

/**
 * Tells whether a transaction failure means "the transaction could not commit
 * because of concurrent modification", the only case core services turn into a
 * `TransactionConflictError` so the caller retries the compare-and-set.
 *
 * Transport failures (`UNAVAILABLE`, `DEADLINE_EXCEEDED`, `INTERNAL`…) and
 * permanent failures (`PERMISSION_DENIED`, an oversized document…) are not
 * contention: the Firestore client already retried the retryable ones before
 * surfacing them, and the caller must see them as they are.
 */
export function isTransactionContention( error: unknown ): boolean {
	const failure = error as { code?: unknown, message?: unknown } | undefined

	if ( abortedStatusCodes.includes( failure?.code as number )) return true

	return failure?.code === 3 && expiredTransactionMessage.test( String( failure.message ?? '' ))
}
