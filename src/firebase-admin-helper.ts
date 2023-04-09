import admin from 'firebase-admin'
import { AppOptions } from 'firebase-admin/app'

export class FirebaseAdminHelper {
	
	static setFirebaseConfig( config?: AppOptions ) {
		FirebaseAdminHelper._firebaseConfig = config
	}

	private constructor() {
		admin.initializeApp( FirebaseAdminHelper._firebaseConfig )
	}

	static get instance() {
		return this._instance || ( this._instance = new FirebaseAdminHelper() )
	}

	firestore() {
		return admin.firestore()
	}

	auth() {
		return admin.auth()
	}

	private static _instance: FirebaseAdminHelper
	private static _firebaseConfig: AppOptions | undefined
}
