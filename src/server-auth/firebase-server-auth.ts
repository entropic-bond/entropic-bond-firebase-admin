import { ServerAuthService, UserCredentials, CustomCredentials } from 'entropic-bond'
import { UserRecord } from 'firebase-admin/lib/auth/user-record'
import { FirebaseAdminHelper } from '../firebase-admin-helper'

export class FirebaseServerAuth extends ServerAuthService {

	async getUser<T extends {}>( userId: string ): Promise<UserCredentials<T>> {
		try {
			return this.convertToUserCredentials(
				await FirebaseAdminHelper.instance.auth().getUser( userId )
			)
		} catch ( error ) {
			console.log( error )
			if ( error.code === 'auth/user-not-found' ) return undefined
			else throw new Error( error )
		}
	}

	setCustomCredentials( userId: string, customCredentials: CustomCredentials ): Promise<void> {
		return FirebaseAdminHelper.instance.auth().setCustomUserClaims( userId, customCredentials )
	}

	async updateUser<T extends {}>( userId: string, credentials: UserCredentials<T> ): Promise<UserCredentials<T>> {
		return this.convertToUserCredentials(
			await FirebaseAdminHelper.instance.auth().updateUser( userId, credentials )
		)
	}

	deleteUser( userId: string ): Promise<void> {
		return FirebaseAdminHelper.instance.auth().deleteUser( userId )
	}

	private convertToUserCredentials<T extends {}>( userData: UserRecord ): UserCredentials<T> {
		return {
			id: userData.uid,
			email: userData.email,
			emailVerified: userData.emailVerified,
			creationDate: new Date( userData.metadata.creationTime ).getTime(),
			lastLogin: new Date( userData.metadata.lastSignInTime ).getTime(),
			name: userData.displayName,
			phoneNumber: userData.phoneNumber,
			pictureUrl: userData.photoURL,
			customData: userData.customClaims as T
		}
	}
}