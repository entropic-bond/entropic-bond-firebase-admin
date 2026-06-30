import { ServerAuth } from 'entropic-bond'
import { FirebaseAdminHelper } from '../firebase-admin-helper'
import { FirebaseServerAuth } from './firebase-server-auth'

describe( 'Firebase Server Auth', ()=>{
	FirebaseAdminHelper.setFirebaseConfig({
		projectId: "demo-test",
	})

	beforeEach(()=>{
		ServerAuth.useServerAuthService( new FirebaseServerAuth() )
	})

	it( 'should not throw if user not found', async ()=>{
		expect.assertions( 1 )
		await expect( 
			ServerAuth.instance.getUser( 'non-existing-user-id' )
		).resolves.toBeUndefined()
	})

	it( 'should not throw if user not found in deleteUser', async ()=>{
		expect.assertions( 1 )
		await expect( 
			ServerAuth.instance.deleteUser( 'non-existing-user-id' )
		).resolves.toBeUndefined()
	})

})