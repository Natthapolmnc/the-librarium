/**
 * Obsidian's `requestUrl` has no abort/signal support, so an in-flight HTTP
 * call to Ollama can't truly be killed once it's been sent. Cancellation
 * here is therefore cooperative: long-running operations are built as a
 * sequence of discrete steps (chunks, layers, search rounds), and each step
 * checks a shared token before starting the next one. Clicking "cancel"
 * can't stop whichever single call is already in flight, but it does stop
 * any further calls from being queued up behind it — which is what
 * actually matters for not surging more requests at Ollama than the user
 * still wants.
 */
export interface CancellationToken {
	isCancelled(): boolean;
}

export class CancelledError extends Error {
	constructor() {
		super("Cancelled");
		this.name = "CancelledError";
	}
}

export function isCancelledError(err: unknown): err is CancelledError {
	return err instanceof CancelledError;
}

export class CancellationSource {
	private _cancelled = false;

	cancel(): void {
		this._cancelled = true;
	}

	get isCancelled(): boolean {
		return this._cancelled;
	}

	readonly token: CancellationToken = {
		isCancelled: () => this._cancelled,
	};
}

/** Throws CancelledError if the token has been cancelled — call between steps of a multi-step operation. */
export function throwIfCancelled(token?: CancellationToken): void {
	if (token?.isCancelled()) throw new CancelledError();
}
