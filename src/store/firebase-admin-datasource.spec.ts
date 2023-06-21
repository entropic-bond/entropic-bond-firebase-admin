/**
 * @jest-environment node
 */
import dns from 'node:dns'
import { Model, Persistent, Store } from 'entropic-bond'
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

	it( 'should not throw if a document id doesn\'t exists', ( done )=>{
		expect( ()=>{
			model.findById( 'nonExistingId' )
				.then( done )
				.catch( done )
		}).not.toThrow()
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
			beforeEach( async ()=>{
				await model.find().get( 2 )
			})

			it( 'should get next result set', async ()=>{
				const docs = await model.next()
				const mockDataArr = Object.values( mockData.TestUser )
				
				expect( docs ).toHaveLength( 2 )
				expect( docs[0]?.id ).toEqual( mockDataArr[2]!.id )
				expect( docs[ 0 ]?.id ).toEqual( 'user3' )
			})

			it( 'should not go beyond the end of result set', async ()=>{
				await model.next()
				await model.next()
				const docs = await model.next()
				expect( docs ).toHaveLength( 0 )
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

})

