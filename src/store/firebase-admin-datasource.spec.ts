/**
 * @jest-environment node
 */
import dns from 'node:dns'
import { DocumentChange, Model, Persistent, Query, Store, TransactionConflictError } from 'entropic-bond'
import { FirebaseAdminDatasource } from './firebase-admin-datasource'
import { FirebaseAdminHelper } from '../firebase-admin-helper'
import { TestUser, DerivedUser, SubClass } from '../mocks/test-user'
import mockData from '../mocks/mock-data.json'

dns.setDefaultResultOrder('ipv4first')
process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:9080'

async function loadTestData( model: Model<TestUser> ) {
	const users = Object.values( mockData.TestUser )
	await Promise.all(
		users.map( userObj => {
			const user = Persistent.createInstance<TestUser>( userObj as any )
			return model.save( user )
		})
	)
}

async function captureFailure( run: () => Promise< unknown > ): Promise< any > {
	try {
		await run()
	}
	catch( error ) {
		return error
	}
	throw new Error( 'Expected the transaction to fail' )
}

describe( 'Firestore Model', ()=>{
	let model: Model<TestUser>
	let testUser: TestUser

	FirebaseAdminHelper.setFirebaseConfig({
		projectId: "demo-test",
	})
	
	beforeEach( async ()=>{
		Store.useDataSource( new FirebaseAdminDatasource() )

		testUser = new TestUser()
		testUser.name = {
			firstName: 'testUserFirstName',
			lastName: 'testUserLastName'
		}
		testUser.age = 35
		testUser.skills = [ 'lazy', 'dirty' ]

		model = Store.getModel<TestUser>( 'TestUser' )

		await loadTestData( model )
	})

	afterEach( async ()=>{
		await fetch( 'http://localhost:9080/emulator/v1/projects/demo-test/databases/(default)/documents', {
			method: 'DELETE'
		})
	})

	it( 'should find document by id', async ()=>{
		await model.save( testUser )

		const user = await model.findById( testUser.id )

		expect( user ).toBeInstanceOf( TestUser )
		expect( user?.id ).toEqual( testUser.id )
		expect( user?.name?.firstName ).toEqual( 'testUserFirstName' )
	})

	it( 'should write a document', async ()=>{
		await model.save( testUser )
		const newUser = await model.findById( testUser.id )

		expect( newUser?.name ).toEqual({
			firstName: 'testUserFirstName',
			lastName: 'testUserLastName'
		})
	})

	it( 'should delete a document by id', async ()=>{
		await model.save( testUser )

		const newUser = await model.findById( testUser.id )
		expect( newUser?.age ).toBe( 35 )

		await model.delete( testUser.id )

		const deletedUser = await model.findById( testUser.id )
		expect( deletedUser ).toBeUndefined()
	})

	it( 'should not throw if a document id doesn\'t exists', async ()=>{
		await expect( model.findById( 'nonExistingId' ) ).resolves.toBeUndefined()
	})

	it( 'should return undefined if a document id doesn\'t exists', async ()=>{
		expect( await model.findById( 'nonExistingId' ) ).toBeUndefined()
	})

	it( 'should retrieve array fields', async ()=>{
		await model.save( testUser )
		const newUser = await model.findById( testUser.id )

		expect( Array.isArray( newUser?.skills ) ).toBeTruthy()
		expect( newUser?.skills ).toEqual( expect.arrayContaining([ 'lazy', 'dirty' ]) )
	})

	it( 'should retrieve object fields', async ()=>{
		await model.save( testUser )
		const newUser = await model.findById( testUser.id )

		expect( newUser?.name ).toEqual({
			firstName: 'testUserFirstName',
			lastName: 'testUserLastName'
		})
	})

	describe( 'Generic find', ()=>{
		it( 'should query all admins with query object', async ()=>{
			testUser.admin = true
			await model.save( testUser )

			const admins = await model.query({
				operations: [{
					property: 'admin',
					operator: '==',
					value: true
				}]
			})

			expect( admins.length ).toBeGreaterThanOrEqual( 1 )
			expect( admins[ 0 ] ).toBeInstanceOf( TestUser )
		})

		it( 'should find all admins with where methods', async ()=>{
			const admins = await model.find().where( 'admin', '==', true ).get()

			expect( admins.length ).toBeGreaterThanOrEqual( 1 )
			expect( admins[ 0 ] ).toBeInstanceOf( TestUser )
		})

		it( 'should find admins with age less than 56', async ()=>{
			const admins = await model.find()
				.where( 'admin', '==', true )
				.where( 'age', '<', 50 )
				.get()

			expect( admins.length ).toBeGreaterThanOrEqual( 1 )
			expect( admins[ 0 ]?.age ).toBeLessThan( 50 )
		})

		it( 'should query by subproperties', async ()=>{
			const users = await model.query({
				operations: [
					{
						property: 'name',
						operator: '==',
						value: { firstName: 'userFirstName3' }
					},
					{ property: 'age', operator: '!=', value: 134	}
				]
			})

			expect( users[0]?.id ).toBe( 'user3' )
		})

		it( 'should find by subproperties', async ()=>{
			const users = await model.find()
				.where( 'name', '==', { firstName: 'userFirstName3' })
				.get()

			expect( users[0]?.id ).toBe( 'user3' )
		})
		
		it( 'should find by property path', async ()=>{
			const users = await model.find()
				.whereDeepProp( 'name.firstName', '==', 'userFirstName3' )
				.get()

				expect( users[0]?.id ).toBe( 'user3' )
		})
		
		it( 'should find by superdeep property path', async ()=>{
			const users = await model.find()
				.whereDeepProp( 'name.ancestorName.father', '==', 'user3Father')
				.get()

			expect( users[0]?.id ).toEqual( 'user3' )
		})

		it( 'should find by swallow property path', async ()=>{
			const users = await model.find()
				.whereDeepProp( 'age', '==', 21 )
				.get()

			expect( users[0]?.id ).toEqual( 'user2' )
		})

		it( 'should count documents in collection', async ()=>{
			expect(	await model.find().count() ).toBe( 6 )
		})
		
	})

	describe( 'Compound queries', ()=>{
		it( 'should find documents using `AND` compound query', async ()=>{
			const admins = await model.find()
				.where( 'admin', '==', true )
				.where( 'age', '<', 50 )
				.get()

			expect( admins ).toHaveLength( 1 )
			expect( admins[0]?.age ).toBeLessThan( 50 )
		})

		it( 'should find using `OR` query', async ()=>{
			const docs = await model.find().or( 'age', '==', 23 ).or( 'age', '==', 41 ).get()

			expect( docs ).toHaveLength( 2 )
			expect( docs ).toEqual( expect.arrayContaining([
				expect.objectContaining({ id: 'user1', age: 23 }),
				expect.objectContaining({ id: 'user5', age: 41 })
			]))
		})

		it( 'should find combining `OR` query and `where` query', async ()=>{
			const docs = await model.find().where( 'age', '>', 50 ).or( 'age', '==', 23 ).or( 'age', '==', 41 ).get()

			expect( docs ).toHaveLength( 3 )
			expect( docs ).toEqual( expect.arrayContaining([
				expect.objectContaining({ id: 'user1', age: 23 }),
				expect.objectContaining({ id: 'user5', age: 41 }),
				expect.objectContaining({ id: 'user3', age: 56 })
			]))
		})

		it( 'should find combining `OR` query and `where` query in a range', async ()=>{
			const docs = await model.find().where( 'age', '<', 22 ).or( 'age', '>', 50 ).get()

			expect( docs ).toHaveLength( 2 )
			expect( docs ).toEqual( expect.arrayContaining([
				expect.objectContaining({ id: 'user2', age: 21 }),
				expect.objectContaining({ id: 'user3', age: 56 })
			]))
		})

		it( 'should throw if a `where` query is used after an `or` query', ()=>{
			expect( 
				()=> model.find().or( 'age', '==', 23 ).where( 'age', '>', 50 )
			).toThrow( Model.error.invalidQueryOrder )
		})
	})

	describe( 'Searchable array property', ()=>{

		it( 'should find documents using `containsAny` operator', async ()=>{
			const colleague1 = new TestUser( 'colleague1' )
			const colleague2 = new TestUser( 'colleague2' )
			const docs = await model.find().where( 'colleagues', 'containsAny', [ colleague1, colleague2 ]).get()

			expect( docs ).toHaveLength( 3 )
			expect( docs ).toEqual( expect.arrayContaining([
				expect.objectContaining({ id: 'user2' }),
				expect.objectContaining({ id: 'user4' }),
				expect.objectContaining({ id: 'user6' })
			]))
		})

		it( 'should find documents using `contains` operator', async ()=>{
			const colleague2 = new TestUser( 'colleague2' )
			const docs = await model.find().where( 'colleagues', 'contains', colleague2 ).get()

			expect( docs ).toHaveLength( 2 )
			expect( docs ).toEqual([
				expect.objectContaining({ id: 'user4' }),
				expect.objectContaining({ id: 'user6' })
			])
		})

	})

	describe( 'Derived classes should fit on parent collection', ()=>{

		it( 'should save derived object in parent collection', async ()=>{
			const derived = new DerivedUser()
			derived.name = { firstName: 'Fulanito', lastName: 'Derived' }
			derived.salary = 3900

			await model.save( derived )

			const newUser = await model.findById( derived.id ) as DerivedUser
			expect( newUser ).toBeInstanceOf( DerivedUser )
			expect( newUser.salary ).toBe( 3900 )
			expect( newUser.className ).toEqual( 'DerivedUser' )
		})
	})

	describe( 'References to documents', ()=>{
		let ref1: SubClass, ref2: SubClass

		beforeEach( async ()=>{
			testUser.documentRef = new SubClass()
			testUser.documentRef.year = 2045
			ref1 = new SubClass(); ref1.year = 2081
			ref2 = new SubClass(); ref2.year = 2082
			testUser.manyRefs.push( ref1 )
			testUser.manyRefs.push( ref2 )
			testUser.derived = new DerivedUser()
			testUser.derived.salary = 1350
			testUser.manyDerived = [ new DerivedUser(), new DerivedUser() ]
			testUser.manyDerived[ 0 ]!.salary = 990
			testUser.manyDerived[ 1 ]!.salary = 1990

			await model.save( testUser )
		})

		it( 'should save a document as a reference', async ()=>{
			const subClassModel = Store.getModel( 'SubClass' )
			expect( subClassModel ).toBeDefined()

			const newDocument = await subClassModel.findById( testUser.documentRef!.id ) as SubClass

			expect( newDocument ).toBeInstanceOf( SubClass )
			expect( newDocument.year ).toBe( 2045 )
		})

		it( 'should read a swallow document reference', async ()=>{
			const loadedUser = await model.findById( testUser.id )

			expect( loadedUser?.documentRef ).toBeInstanceOf( SubClass )
			expect( loadedUser?.documentRef?.id ).toBeDefined()
			expect( loadedUser?.documentRef?.year ).toBeUndefined()
		})

		it( 'should fill data of swallow document reference', async ()=>{
			const loadedUser = await model.findById( testUser.id )

			await Store.populate( loadedUser!.documentRef! )
			expect( loadedUser?.documentRef?.id ).toBeDefined()
			expect( loadedUser?.documentRef?.year ).toBe( 2045 )
		})


		it( 'should save and array of references', async ()=>{
			const subClassModel = Store.getModel( 'SubClass' )

			const newDocument = await subClassModel.findById( testUser.documentRef!.id ) as SubClass

			expect( newDocument ).toBeInstanceOf( SubClass )
			expect( newDocument.year ).toBe( 2045 )
		})

		it( 'should read an array of references', async ()=>{
			const loadedUser = await model.findById( testUser.id )
			
			expect( loadedUser?.manyRefs ).toHaveLength( 2 )
			expect( loadedUser?.manyRefs[0] ).toBeInstanceOf( SubClass )
			expect( loadedUser?.manyRefs[0]?.id ).toEqual( testUser.manyRefs[0]!.id )
			expect( loadedUser?.manyRefs[0]?.year ).toBeUndefined()
			expect( loadedUser?.manyRefs[1] ).toBeInstanceOf( SubClass )
			expect( loadedUser?.manyRefs[1]?.id ).toEqual( testUser.manyRefs[1]!.id )
			expect( loadedUser?.manyRefs[1]?.year ).toBeUndefined()
		})

		it( 'should fill array of refs', async ()=>{
			const loadedUser = await model.findById( testUser.id )
			await Store.populate( loadedUser!.manyRefs )

			expect( loadedUser!.manyRefs[ 0 ]?.year ).toBe( 2081 )
			expect( loadedUser!.manyRefs[ 1 ]?.year ).toBe( 2082 )
		})

		it( 'should save a reference when declared @persistentAt', async ()=>{
			const loadedUser = await model.findById( testUser.id )

			expect( loadedUser?.derived?.id ).toEqual( testUser.derived!.id )
			expect( loadedUser?.derived?.salary ).toBeUndefined()

			await Store.populate( loadedUser!.derived! )

			expect( loadedUser?.derived?.salary ).toBe( 1350 )
			expect( loadedUser?.derived?.id ).toBe( testUser.derived!.id )
		})

		it( 'should populate from special collection when declared with @persistentRefAt', async ()=>{
			const loadedUser = await model.findById( 'user6' )
			await Store.populate( loadedUser!.derived! )

			expect( loadedUser?.derived?.salary ).toBe( 2800 )
			expect( loadedUser?.derived?.id ).toBe( 'user4' )
		})
		
		it( 'should save a reference when declared @persistentAt as array', async ()=>{
			const loadedUser = await model.findById( testUser.id )

			expect( loadedUser?.manyDerived?.[0]?.id ).toEqual( testUser.manyDerived![0]!.id )
			expect( loadedUser?.manyDerived?.[0]?.salary ).toBeUndefined()
			expect( loadedUser?.manyDerived?.[1]?.salary ).toBeUndefined()

			await Store.populate( loadedUser!.manyDerived! )

			expect( loadedUser?.manyDerived?.[0]?.salary ).toBe( 990 )
			expect( loadedUser?.manyDerived?.[0]?.id ).toBe( testUser.manyDerived![0]!.id )
			expect( loadedUser?.manyDerived?.[1]?.salary ).toBe( 1990 )
			expect( loadedUser?.manyDerived?.[1]?.id ).toBe( testUser.manyDerived![1]!.id )
		})

		it( 'should not overwrite not filled ref in collection', async ()=>{
			const loadedUser = await model.findById( 'user6' )
			await model.save( loadedUser! )
			const refInCollection = await model.findById<DerivedUser>( 'user4' )

			expect( refInCollection?.salary ).toBe( 2800 )
		})

		it( 'should save loaded ref with assigned new instance', async ()=>{
			const loadedUser = await model.findById( 'user6' )
			loadedUser!.derived = new DerivedUser()
			loadedUser!.derived.salary = 345
			await model.save( loadedUser! )

			const refInCollection = await model.findById<DerivedUser>( loadedUser!.derived.id )
			expect( refInCollection?.salary ).toBe( 345 )
		})

		it( 'should save loaded ref with modified ref data', async ()=>{
			const loadedUser = await model.findById( 'user6' )
			await Store.populate( loadedUser!.derived! )
			loadedUser!.derived!.salary = 1623
			await model.save( loadedUser! )

			const refInCollection = await model.findById<DerivedUser>( 'user4' )
			expect( refInCollection?.salary ).toBe( 1623 )
		})
	})

	describe( 'Operations on queries', ()=>{
		it( 'should limit the result set', async ()=>{
			const unlimited = await model.find().get()
			const limited = await model.find().limit( 2 ).get()

			expect( unlimited.length ).not.toBe( limited.length )
			expect( limited ).toHaveLength( 2 )
		})

		it( 'should sort ascending the result set', async ()=>{
			const docs = await model.find().orderBy( 'age' ).get()

			expect( docs[ 0 ]?.id ).toEqual( 'user2' )
			expect( docs[ 1 ]?.id ).toEqual( 'user1' )
		})

		it( 'should sort descending the result set', async ()=>{
			const docs = await model.find().orderBy( 'age', 'desc' ).get()

			expect( docs[ 0 ]?.id ).toEqual( 'user3' )
			expect( docs[ 1 ]?.id ).toEqual( 'user5' )
		})

		it( 'should sort by deep property path', async ()=>{
			const docs = await model.find().orderByDeepProp( 'name.firstName', 'desc' ).get()

			expect( docs[ 0 ]?.id ).toEqual( 'user6' )
			expect( docs[ 1 ]?.id ).toEqual( 'user5' )
		})

		it( 'should sort by swallow property path', async ()=>{
			const docs = await model.find().orderByDeepProp( 'age' ).get()

			expect( docs[ 0 ]?.id ).toEqual( 'user2' )
			expect( docs[ 1 ]?.id ).toEqual( 'user1' )
		})

		describe( 'Data Cursors', ()=>{
			
			it( 'should get next result set', async ()=>{
				await model.find().get( 2 )
				const docs = await model.next()
				const mockDataArr = Object.values( mockData.TestUser )
				
				expect( docs ).toHaveLength( 2 )
				expect( docs[0]?.id ).toEqual( mockDataArr[2]!.id )
				expect( docs[ 0 ]?.id ).toEqual( 'user3' )
			})
			
			it( 'should not go beyond the end of result set', async ()=>{
				await model.find().get( 2 )
				await model.next()
				await model.next()
				const docs = await model.next()
				expect( docs ).toHaveLength( 0 )
			})

			it( 'should get empty array if no more results', async ()=>{
				await model.find().get( 20 )
				const docs = await model.next()
				expect( docs ).toHaveLength( 0 )
			})

			it( 'should get empty array if no more results with limit in next', async ()=>{
				await model.find().get( 20 )
				const docs = await model.next( 20 )
				expect( docs ).toHaveLength( 0 )
			})

			it( 'should not throw', async ()=> {
				expect.assertions( 1 )
				let res = await model.find().get( 20 )
				const allRes: TestUser[] = []
				while( res.length > 0 ) {
					allRes.push( ...res )
					res = await model.next( 20 )
				}
				expect( allRes ).toHaveLength( 6 )
			})

			it( 'should work with only one result set', async ()=>{
				const firstRes = await model.find().where( 'id', '==', 'user1' ).get( 20 )
				expect( firstRes ).toHaveLength( 1 )
				const docs = await model.next( 20 )
				expect( docs ).toHaveLength( 0 )
			})

			it( 'should work with no result set', async ()=>{
				const firstRes = await model.find().where( 'id', '==', '****' ).get( 20 )
				expect( firstRes ).toHaveLength( 0 )
				const docs = await model.next( 20 )
				expect( docs ).toHaveLength( 0 )
			})

			it( 'should keep each result set when two models interleave queries on one collection', async ()=>{
				const modelA = Store.getModel<TestUser>( 'TestUser' )
				const modelB = Store.getModel<TestUser>( 'TestUser' )

				const firstA = await modelA.find().get( 2 )
				const firstB = await modelB.find().get( 3 )

				expect( firstA.map( user => user.id )).toEqual([ 'user1', 'user2' ])
				expect( firstB.map( user => user.id )).toEqual([ 'user1', 'user2', 'user3' ])

				const nextA = await modelA.next()
				const nextB = await modelB.next()

				expect( nextA.map( user => user.id )).toEqual([ 'user3', 'user4' ])
				expect( nextB.map( user => user.id )).toEqual([ 'user4', 'user5', 'user6' ])
			})

			it( 'should not mix result sets when two collections interleave queries', async ()=>{
				const subModel = Store.getModel<SubClass>( 'SubClass' )
				await subModel.save( new SubClass( 'sub1' ) )
				await subModel.save( new SubClass( 'sub2' ) )
				await subModel.save( new SubClass( 'sub3' ) )

				const firstUsers = await model.find().get( 2 )
				const firstSubs = await subModel.find().get( 1 )

				expect( firstUsers.map( user => user.id )).toEqual([ 'user1', 'user2' ])
				expect( firstSubs.map( sub => sub.id )).toEqual([ 'sub1' ])

				const nextUsers = await model.next()
				expect( nextUsers.map( user => user.id )).toEqual([ 'user3', 'user4' ])
			})

			it( 'should reset pagination for a model when it re-runs its query', async ()=>{
				const modelA = Store.getModel<TestUser>( 'TestUser' )
				const modelB = Store.getModel<TestUser>( 'TestUser' )

				await modelA.find().get( 2 )
				await modelB.find().get( 2 )
				await modelA.find().get()

				const nextB = await modelB.next()
				expect( nextB.map( user => user.id )).toEqual([ 'user3', 'user4' ])
			})

			it( 'should not disturb an in-progress cursor when counting', async ()=>{
				await model.find().get( 2 )
				expect( await model.find().count() ).toBe( 6 )

				const docs = await model.next()
				expect( docs.map( user => user.id )).toEqual([ 'user3', 'user4' ])
			})

		})

		describe( 'Concurrency-safe pagination cursor [REQ-1] [REQ-2] [REQ-3] [REQ-4]', ()=>{

			it( 'Overlapping next calls receive consecutive pages. [REQ-1]', async ()=>{
				await model.find().get( 2 )

				const [ pageA, pageB, pageC ] = await Promise.all([ model.next(), model.next(), model.next() ])

				expect( pageA.map( user => user.id )).toEqual([ 'user3', 'user4' ])
				expect( pageB.map( user => user.id )).toEqual([ 'user5', 'user6' ])
				expect( pageC ).toHaveLength( 0 )
			})

			it( 'returns consecutive pages when concurrent calls cross the end of the result set', async ()=>{
				await model.find().get( 4 )

				const [ pageA, pageB ] = await Promise.all([ model.next(), model.next() ])

				expect( pageA.map( user => user.id )).toEqual([ 'user5', 'user6' ])
				expect( pageB ).toHaveLength( 0 )
			})

			it( 'Concurrent next calls past the end of the result set all resolve to empty pages. [REQ-2]', async ()=>{
				await model.find().get( 20 )

				const pages = await Promise.all([ model.next(), model.next(), model.next() ])

				pages.forEach( page => expect( page ).toEqual( [] ))
			})

			it( 'An overlapping next call sizes its own page with its limit argument. [REQ-3]', async ()=>{
				await model.find().get( 2 )

				const [ pageA, pageB ] = await Promise.all([ model.next( 1 ), model.next( 1 ) ])

				expect( pageA.map( user => user.id )).toEqual([ 'user3' ])
				expect( pageB.map( user => user.id )).toEqual([ 'user4' ])
			})

			it( 'Each next call retrieves at most one page from the server. [REQ-4]', async ()=>{
				await model.find().get( 2 )

				const pages = await Promise.all([ model.next(), model.next(), model.next() ])

				pages.forEach( page => expect( page.length ).toBeLessThanOrEqual( 2 ))
			})

		})
	})

	describe( 'SubCollections', ()=>{
		let model: Model<SubClass>
	
		beforeEach(()=>{
			model = Store.getModelForSubCollection( testUser, 'SubClass' )
		})
	
		it( 'should retrieve from subcollection', async ()=>{
			const subClass = new SubClass()
			subClass.year = 3452

			await model.save( subClass )

			const loaded = await model.findById( subClass.id )

			expect( loaded?.year ).toBe( 3452 )
		})
	})

	describe( 'Transactions', ()=>{
		it( 'should read and save a document within a transaction', async ()=>{
			await model.runTransaction( async handle => {
				const user = await handle.findById( 'user1' )
				expect( user ).toBeInstanceOf( TestUser )
				user!.age = 99
				await handle.save( user! )
				return user!
			})

			const updated = await model.findById( 'user1' )
			expect( updated?.age ).toBe( 99 )
		})

		it( 'should resolve with the callback result', async ()=>{
			const result = await model.runTransaction( async handle => {
				const user = await handle.findById( 'user2' )
				return user!
			})

			expect( result.age ).toBe( 21 )
		})

		it( 'should return undefined for a non existing document', async ()=>{
			const result = await model.runTransaction( async handle => {
				return ( await handle.findById( 'nonExistingId' ) ) as TestUser
			})

			expect( result ).toBeUndefined()
		})

		it( 'should delete a document within a transaction', async ()=>{
			await model.runTransaction( async handle => {
				const user = await handle.findById( 'user1' )
				await handle.delete( user! )
				return user!
			})

			expect( await model.findById( 'user1' ) ).toBeUndefined()
		})

		it( 'should merge saved fields into an existing document', async ()=>{
			await model.runTransaction( async handle => {
				const user = await handle.findById( 'user1' )
				user!.age = 55
				await handle.save( user! )
				return user!
			})

			const updated = await model.findById( 'user1' )
			expect( updated?.age ).toBe( 55 )
		})

		it( 'A commit failure that cannot succeed on a retry keeps its own error. [REQ-1]', async ()=>{
			const tooBig = await model.findById( 'user1' )
			tooBig!.skills = [ 'x'.repeat( 1_200_000 ) ]

			const failure = await captureFailure(() => model.runTransaction( async handle => {
				await handle.save( tooBig! )
				return tooBig!
			}))

			expect( failure ).not.toBeInstanceOf( TransactionConflictError )
			expect( failure.code ).toBe( 3 )
			expect( failure.message ).toMatch( /longer than/i )
		})

		it( 'A failure raised by the transaction callback keeps its own error. [REQ-2]', async ()=>{
			const applicationError = new Error( 'callback boom' )

			const failure = await captureFailure(() => model.runTransaction( async ()=>{
				throw applicationError
			}))

			expect( failure ).toBe( applicationError )
			expect( failure ).not.toBeInstanceOf( TransactionConflictError )
		})
	})

	describe( 'Firestore listeners report changes in the core change vocabulary (gh-issue-1)', ()=>{
		let unsubscribe: (()=> void) | undefined

		afterEach(()=>{
			unsubscribe?.()
			unsubscribe = undefined
		})

		const QUIET_PERIOD = 1000

		const settle = ( ms: number )=> new Promise( resolve => setTimeout( resolve, ms ) )

		async function expectQuiet( listener: ReturnType< typeof vi.fn > ) {
			await settle( QUIET_PERIOD )
			expect( listener ).not.toHaveBeenCalled()
		}

		async function expectOnlyOne( listener: ReturnType< typeof vi.fn > ) {
			await settle( QUIET_PERIOD )
			expect( listener ).toHaveBeenCalledTimes( 1 )
		}

		const ids = ( documents: TestUser[] )=> documents.map( document => document.id )

		const isChange = ( type: DocumentChange<TestUser>[ 'type' ], id: string )=>( change: DocumentChange<TestUser> )=>
			change.type === type && change.after?.id === id

		function listenToCollection( query: Query<TestUser> ) {
			const listener = vi.fn()
			unsubscribe = model.onCollectionChange( query, listener )
			return listener
		}

		function listenToDocument( documentId: string ) {
			const listener = vi.fn()
			unsubscribe = model.onDocumentChange( documentId, listener )
			return listener
		}

		async function awaitFirstNotification( listener: ReturnType< typeof vi.fn > ) {
			await vi.waitFor(()=> expect( listener ).toHaveBeenCalled(), { timeout: 5000 } )
		}

		async function listenToSeededCollection( query: Query<TestUser> ) {
			const listener = listenToCollection( query )
			await awaitFirstNotification( listener )
			listener.mockClear()
			return listener
		}

		async function listenToSeededDocument( documentId: string ) {
			const listener = listenToDocument( documentId )
			await awaitFirstNotification( listener )
			listener.mockClear()
			return listener
		}

		async function awaitNotification(
			listener: ReturnType< typeof vi.fn >,
			predicate: ( change: DocumentChange<TestUser> )=> boolean,
		): Promise< [ DocumentChange<TestUser>[], TestUser[] ] > {
			let notification: [ DocumentChange<TestUser>[], TestUser[] ] | undefined

			await vi.waitFor(()=>{
				notification = listener.mock.calls.find(([ changes ])=> changes.some( predicate )) as [ DocumentChange<TestUser>[], TestUser[] ] | undefined
				expect( notification ).toBeDefined()
			}, { timeout: 5000 })

			return notification!
		}

		async function awaitDocumentNotification(
			listener: ReturnType< typeof vi.fn >,
			predicate: ( change: DocumentChange<TestUser> )=> boolean,
		): Promise< DocumentChange<TestUser> > {
			let notification: DocumentChange<TestUser> | undefined

			await vi.waitFor(()=>{
				notification = listener.mock.calls.map(([ change ])=> change as DocumentChange<TestUser> ).find( predicate )
				expect( notification ).toBeDefined()
			}, { timeout: 5000 })

			return notification!
		}

		function newUser( id: string, age: number ) {
			const user = new TestUser( id )
			user.name = { firstName: 'New', lastName: id }
			user.age = age
			return user
		}

		async function changeAge( id: string, age: number ) {
			const user = await model.findById( id )
			user!.age = age
			await model.save( user! )
		}

		const allUserIds = [ 'user1', 'user2', 'user3', 'user4', 'user5', 'user6' ]

		it( 'Subscribing seeds the listener with the current matching documents. [REQ-1]', async ()=>{
			const listener = listenToCollection( model.find() )

			await awaitFirstNotification( listener )
			await expectOnlyOne( listener )

			const [ changes, snapshot ] = listener.mock.calls[ 0 ] as [ DocumentChange<TestUser>[], TestUser[] ]
			expect( changes ).toHaveLength( 6 )
			expect( changes.every( change => change.type === 'create' )).toBe( true )
			expect( changes.every( change => change.before === undefined )).toBe( true )
			expect( changes.every( change => change.after?.age !== undefined )).toBe( true )
			expect( changes.map( change => change.after?.id ).sort() ).toEqual( allUserIds )
			expect( ids( snapshot ).sort() ).toEqual( allUserIds )
		})

		it( 'A newly matching document is reported as a create change. [REQ-2]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )

			await model.save( newUser( 'user7', 30 ) )

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'create', 'user7' ))
			expect( changes ).toHaveLength( 1 )
			expect( changes[ 0 ]).toEqual( expect.objectContaining({
				type: 'create',
				after: expect.objectContaining({ id: 'user7', age: 30 }),
			}))
			expect( ids( snapshot )).toContain( 'user7' )
		})

		it( 'An updated document that still matches is reported as an update change. [REQ-3]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )

			await changeAge( 'user1', 24 )

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'update', 'user1' ))
			expect( changes ).toHaveLength( 1 )
			expect( changes[ 0 ]).toEqual( expect.objectContaining({
				type: 'update',
				after: expect.objectContaining({ id: 'user1', age: 24 }),
			}))
			expect( snapshot.find( document => document.id === 'user1' )?.age ).toBe( 24 )
		})

		it( 'An updated document that no longer matches is reported as a delete change. [REQ-4]', async ()=>{
			const listener = await listenToSeededCollection( model.find().where( 'age', '>=', 20 ))

			await changeAge( 'user1', 10 )

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'delete', 'user1' ))
			expect( changes ).toEqual([ expect.objectContaining({ type: 'delete', before: undefined })] )
			expect( ids( snapshot )).not.toContain( 'user1' )
		})

		it( 'A deleted matching document is reported as a delete change. [REQ-5]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )

			await model.delete( 'user3' )

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'delete', 'user3' ))
			expect( changes ).toHaveLength( 1 )
			expect( changes[ 0 ]).toEqual( expect.objectContaining({
				type: 'delete',
				after: expect.objectContaining({ id: 'user3', age: 56 }),
			}))
			expect( ids( snapshot )).not.toContain( 'user3' )
		})

		it( 'Writing or deleting a document that does not match is not reported. [REQ-6]', async ()=>{
			const listener = await listenToSeededCollection( model.find().where( 'age', '>=', 30 ))

			await changeAge( 'user1', 24 )
			await model.delete( 'user2' )

			await expectQuiet( listener )
		})

		it( 'A limited and sorted query observes only its window. [REQ-7]', async ()=>{
			const listener = listenToCollection( model.find().orderBy( 'age', 'asc' ).limit( 3 ))

			await awaitFirstNotification( listener )

			const [ changes, snapshot ] = listener.mock.calls[ 0 ] as [ DocumentChange<TestUser>[], TestUser[] ]
			expect( changes.map( change => `${ change.type }:${ change.after?.id }` ))
				.toEqual([ 'create:user2', 'create:user1', 'create:user4' ])
			expect( ids( snapshot )).toEqual([ 'user2', 'user1', 'user4' ])
		})

		it( 'A write that pushes a document out of a limited window is reported as a delete change. [REQ-8]', async ()=>{
			const listener = await listenToSeededCollection( model.find().orderBy( 'age', 'asc' ).limit( 3 ))

			await changeAge( 'user2', 100 )

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'delete', 'user2' ))
			expect( changes.filter( change => change.type === 'delete' ).map( change => change.after?.id )).toEqual([ 'user2' ])
			expect( ids( snapshot )).toEqual([ 'user1', 'user4', 'user6' ])
		})

		it( 'A document deleted inside a transaction is reported as a delete change. [REQ-9]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )

			await model.runTransaction( async handle => {
				const user6 = await handle.findById( 'user6' )
				await handle.delete( user6! )
				return user6!
			})

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'delete', 'user6' ))
			expect( changes ).toHaveLength( 1 )
			expect( ids( snapshot )).not.toContain( 'user6' )
		})

		it( 'An unsubscribed listener is not notified by later writes. [REQ-10]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )
			unsubscribe!()
			unsubscribe = undefined

			await model.save( newUser( 'user7', 30 ) )
			await model.delete( 'user3' )

			await expectQuiet( listener )
		})

		it( 'Every reported change uses the core vocabulary and names its collection. [REQ-11]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )
			const user7 = newUser( 'user7', 30 )

			await model.save( user7 )
			await awaitNotification( listener, isChange( 'create', 'user7' ))

			user7.age = 31
			await model.save( user7 )
			await awaitNotification( listener, isChange( 'update', 'user7' ))

			await model.delete( 'user7' )
			await awaitNotification( listener, isChange( 'delete', 'user7' ))

			const reportedChanges = listener.mock.calls.flatMap(([ changes ])=> changes ) as DocumentChange<TestUser>[]
			expect( reportedChanges.map( change => change.type )).toEqual([ 'create', 'update', 'delete' ])
			reportedChanges.forEach( change => {
				expect( change.collectionPath ).toBe( 'TestUser' )
				expect( change.before ).toBeUndefined()
			})
		})

		it( 'A query matching no documents notifies once with an empty result. [REQ-12]', async ()=>{
			const listener = listenToCollection( model.find().where( 'age', '>=', 200 ))

			await awaitFirstNotification( listener )
			await expectOnlyOne( listener )

			const [ changes, snapshot ] = listener.mock.calls[ 0 ] as [ DocumentChange<TestUser>[], TestUser[] ]
			expect( changes ).toEqual( [] )
			expect( snapshot ).toEqual( [] )
		})

		it( 'The documents delivered to a model listener are model instances. [REQ-13]', async ()=>{
			const listener = await listenToSeededCollection( model.find() )

			await model.save( newUser( 'user7', 30 ) )

			const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'create', 'user7' ))
			expect( changes[ 0 ]?.after ).toBeInstanceOf( TestUser )
			expect( snapshot ).toHaveLength( 7 )
			expect( snapshot.every( document => document instanceof TestUser )).toBe( true )
		})

		it( 'Subscribing to an existing document reports an update with the document. [REQ-14]', async ()=>{
			const listener = listenToDocument( 'user1' )

			await awaitFirstNotification( listener )
			await expectOnlyOne( listener )

			expect( listener ).toHaveBeenCalledWith({
				type: 'update',
				before: undefined,
				after: expect.objectContaining({ id: 'user1' }),
				params: expect.objectContaining({ exists: true }),
				collectionPath: 'TestUser',
			})
		})

		it( 'Subscribing to a missing document stays silent until it is created. [REQ-15]', async ()=>{
			const listener = listenToDocument( 'user7' )

			await expectQuiet( listener )

			await model.save( newUser( 'user7', 30 ) )

			const reported = await awaitDocumentNotification( listener, change => change.after?.id === 'user7' )
			expect( reported ).toEqual( expect.objectContaining({
				type: 'update',
				after: expect.objectContaining({ id: 'user7' }),
				params: expect.objectContaining({ exists: true }),
			}) )
			await expectOnlyOne( listener )
		})

		it( 'Changing the observed document is reported as an update. [REQ-16]', async ()=>{
			const listener = await listenToSeededDocument( 'user6' )

			await changeAge( 'user6', 77 )

			const reported = await awaitDocumentNotification( listener, change => change.after?.age === 77 )
			expect( reported ).toEqual( expect.objectContaining({
				type: 'update',
				after: expect.objectContaining({ id: 'user6', age: 77 }),
				params: expect.objectContaining({ exists: true }),
			}) )
			await expectOnlyOne( listener )
		})

		it( 'Deleting the observed document is reported as a delete. [REQ-17]', async ()=>{
			const listener = await listenToSeededDocument( 'user6' )

			await model.delete( 'user6' )

			const reported = await awaitDocumentNotification( listener, change => change.type === 'delete' )
			expect( reported ).toEqual( expect.objectContaining({
				type: 'delete',
				after: undefined,
				before: undefined,
				params: expect.objectContaining({ exists: false }),
			}) )
			await expectOnlyOne( listener )
		})

		it( 'An unsubscribed document listener is not notified by later writes. [REQ-18]', async ()=>{
			const listener = await listenToSeededDocument( 'user6' )
			unsubscribe!()
			unsubscribe = undefined

			await changeAge( 'user6', 77 )
			await model.delete( 'user6' )

			await expectQuiet( listener )
		})

		it( 'A document change delivered to a model listener carries a model instance. [REQ-19]', async ()=>{
			const listener = await listenToSeededDocument( 'user6' )

			await changeAge( 'user6', 77 )

			const reported = await awaitDocumentNotification( listener, change => change.after?.age === 77 )
			expect( reported.type ).toBe( 'update' )
			expect( reported.after ).toBeInstanceOf( TestUser )
			await expectOnlyOne( listener )
		})

		describe( 'Listener edge cases', ()=>{
			it( 'reports an update inside a limited window without dropping the document from the snapshot', async ()=>{
				const listener = await listenToSeededCollection( model.find().orderBy( 'age', 'asc' ).limit( 3 ))

				await changeAge( 'user4', 36 )

				const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'update', 'user4' ))
				expect( changes.filter( isChange( 'delete', 'user4' ))).toHaveLength( 0 )
				expect( ids( snapshot )).toEqual([ 'user2', 'user1', 'user4' ])
			})

			it( 'reports the documents entering and leaving a limited window in the same notification', async ()=>{
				const listener = await listenToSeededCollection( model.find().orderBy( 'age', 'asc' ).limit( 3 ))

				await model.save( newUser( 'user7', 18 ) )

				const [ changes, snapshot ] = await awaitNotification( listener, isChange( 'create', 'user7' ))
				expect( changes.filter( change => change.type === 'create' ).map( change => change.after?.id )).toEqual([ 'user7' ])
				expect( changes.filter( change => change.type === 'delete' ).map( change => change.after?.id )).toEqual([ 'user4' ])
				expect( ids( snapshot )).toEqual([ 'user7', 'user2', 'user1' ])
			})
		})
	})
})

