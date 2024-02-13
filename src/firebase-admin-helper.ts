import { AppOptions, initializeApp } from 'firebase-admin/app'
import { Auth, getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

export class FirebaseAdminHelper {
	
	static setFirebaseConfig( config?: AppOptions ) {
		FirebaseAdminHelper._firebaseConfig = config
	}

	private constructor() {
		initializeApp( FirebaseAdminHelper._firebaseConfig )
	}

	static get instance() {
		return this._instance || ( this._instance = new FirebaseAdminHelper() )
	}

	firestore() {
		return getFirestore()
	}

	auth(): Auth{
		return getAuth()
	}

	private static _instance: FirebaseAdminHelper
	private static _firebaseConfig: AppOptions | undefined
}
