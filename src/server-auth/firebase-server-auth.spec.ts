import { ServerAuth } from 'entropic-bond'
import { FirebaseAdminHelper } from '../firebase-admin-helper'
import { FirebaseServerAuth } from './firebase-server-auth'

describe.skip( 'Firebase Server Auth', ()=>{
	FirebaseAdminHelper.setFirebaseConfig({
		projectId: "demo-test",
	})

	beforeEach(()=>{
		ServerAuth.useServerAuthService( new FirebaseServerAuth() )
	})

	it( 'should not throw if user not found', ( done )=>{
		expect.assertions( 1 )
		expect( 
			()=> ServerAuth.instance.getUser( 'non-existing-user-id' ).finally( done ) 
		).not.toThrow()
	})
})