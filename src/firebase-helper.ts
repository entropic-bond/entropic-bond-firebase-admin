import { AppOptions } from 'firebase-admin/app'
import { firestore, initializeApp, auth } from 'firebase-admin'

export class FirebaseHelper {
	
	static setFirebaseConfig( config?: AppOptions ) {
		FirebaseHelper._firebaseConfig = config
	}

	private constructor() {
		initializeApp( FirebaseHelper._firebaseConfig )
	}

	static get instance() {
		return this._instance || ( this._instance = new FirebaseHelper() )
	}

	firestore() {
		return firestore()
	}

	auth() {
		return auth()
	}

	private static _instance: FirebaseHelper
	private static _firebaseConfig: AppOptions
}
