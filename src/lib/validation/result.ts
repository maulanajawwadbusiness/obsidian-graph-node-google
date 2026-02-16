import type { ValidationError } from './errors';

export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; errors: ValidationError[] };

export function ok<T>(value: T): Result<T> {
    return { ok: true, value };
}

export function err<T = never>(errors: ValidationError | ValidationError[]): Result<T> {
    return { ok: false, errors: Array.isArray(errors) ? errors : [errors] };
}

export function mapResult<T, U>(input: Result<T>, mapper: (value: T) => U): Result<U> {
    if (!input.ok) return input;
    return ok(mapper(input.value));
}

export function chainResult<T, U>(input: Result<T>, mapper: (value: T) => Result<U>): Result<U> {
    if (!input.ok) return input;
    return mapper(input.value);
}
