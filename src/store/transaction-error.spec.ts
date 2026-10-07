import { isTransactionContention } from './transaction-error'

function failure( code?: number, message?: string ) {
	const error = new Error( message ?? '' ) as Error & { code?: number }
	if ( code !== undefined ) error.code = code
	return error
}

describe( 'Transaction failure classification', ()=>{

	it( 'a transaction aborted by contention is reported as a transaction conflict. [REQ-3]', ()=>{
		expect( isTransactionContention( failure( 10, 'The transaction was aborted.' ))).toBe( true )
		expect( isTransactionContention( failure( 409, 'http aborted' ))).toBe( true )
		expect( isTransactionContention( failure( 3, 'The transaction has expired.' ))).toBe( true )
	})

	it( 'any other failure is not a transaction conflict. [REQ-4]', ()=>{
		expect( isTransactionContention( failure( 3, 'The value of property "skills" is longer than 1048487 bytes.' ))).toBe( false )
		expect( isTransactionContention( failure( 7, 'Missing or insufficient permissions.' ))).toBe( false )
		expect( isTransactionContention( failure( 14, 'Unavailable' ))).toBe( false )
		expect( isTransactionContention( failure( 8, 'Resource exhausted' ))).toBe( false )
		expect( isTransactionContention( failure( undefined, 'a plain error without status code' ))).toBe( false )
		expect( isTransactionContention( undefined )).toBe( false )
		expect( isTransactionContention( 'not an error' )).toBe( false )
	})
})
